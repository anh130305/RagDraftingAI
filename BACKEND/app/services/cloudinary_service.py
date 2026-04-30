"""
services.cloudinary_service - Cloudinary SDK integration
"""

import os
import time

import cloudinary
import cloudinary.uploader
import cloudinary.api
import cloudinary.utils
from typing import Optional
from fastapi import UploadFile
from app.core.config import settings

# Configure Cloudinary globally only if the credentials exist
if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_CLOUD_NAME != "YOUR_CLOUD_NAME":
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )


def _resolve_upload_context(file_name: str, content_type: Optional[str], user_id: str, session_id: str) -> dict:
    filename = (file_name or "").strip()
    normalized_name = os.path.basename(filename) if filename else "document"
    lowered_name = normalized_name.lower()
    lowered_content_type = (content_type or "").lower()

    RAW_EXTENSIONS = (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md")
    RAW_CONTENT_TYPES = (
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument",
        "application/vnd.ms-",
        "text/plain",
        "text/markdown",
    )

    if any(lowered_name.endswith(ext) for ext in RAW_EXTENSIONS):
        upload_resource_type = "raw"
    elif any(lowered_content_type.startswith(ct) for ct in RAW_CONTENT_TYPES):
        upload_resource_type = "raw"
    elif lowered_content_type.startswith("image/"):
        upload_resource_type = "image"
    elif lowered_content_type.startswith("video/"):
        upload_resource_type = "video"
    else:
        upload_resource_type = "raw"

    folder_path = f"RagDraftingAI/{user_id}/{session_id}"
    public_id = normalized_name if upload_resource_type == "raw" else normalized_name.rsplit(".", 1)[0]

    return {
        "folder_path": folder_path,
        "public_id": public_id,
        "resource_type": upload_resource_type,
    }


def build_signed_upload_payload(
    *,
    file_name: str,
    content_type: Optional[str],
    user_id: str,
    session_id: str = "general",
) -> dict:
    """Build a signed Cloudinary upload payload for browser-based uploads."""
    if not settings.CLOUDINARY_CLOUD_NAME or settings.CLOUDINARY_CLOUD_NAME == "YOUR_CLOUD_NAME":
        raise ValueError("Cloudinary is not configured. Missing CLOUD_NAME.")
    if not settings.CLOUDINARY_API_KEY or not settings.CLOUDINARY_API_SECRET:
        raise ValueError("Cloudinary is not configured. Missing API credentials.")

    context = _resolve_upload_context(file_name, content_type, user_id, session_id)
    timestamp = int(time.time())

    sign_params = {
        "timestamp": timestamp,
        "folder": context["folder_path"],
        "public_id": context["public_id"],
        "type": "upload",
        "access_mode": "public",
    }
    signature = cloudinary.utils.api_sign_request(sign_params, settings.CLOUDINARY_API_SECRET)

    return {
        "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
        "api_key": settings.CLOUDINARY_API_KEY,
        "upload_url": f"https://api.cloudinary.com/v1_1/{settings.CLOUDINARY_CLOUD_NAME}/{context['resource_type']}/upload",
        "signature": signature,
        "timestamp": timestamp,
        "folder": context["folder_path"],
        "public_id": context["public_id"],
        "resource_type": context["resource_type"],
        "type": "upload",
        "access_mode": "public",
    }

def upload_to_cloudinary(file: UploadFile, user_id: str, session_id: str = "general") -> dict:
    """
    Uploads a file to Cloudinary and returns a dict with 'url', 'public_id', 'resource_type'.
    File is structured as: RagDraftingAI/{user_id}/{session_id}/{filename}

    IMPORTANT: Do NOT pass access_control (ACL list) for raw resources —
    Cloudinary ignores or rejects it silently, keeping the asset restricted.
    Use access_mode="public" only.
    """
    if not settings.CLOUDINARY_CLOUD_NAME or settings.CLOUDINARY_CLOUD_NAME == "YOUR_CLOUD_NAME":
        raise ValueError("Cloudinary is not configured. Missing CLOUD_NAME.")

    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()

    print(f"[Cloudinary] upload filename={filename!r} content_type={content_type!r}")

    context = _resolve_upload_context(file.filename or "", file.content_type, user_id, session_id)
    folder_path = context["folder_path"]
    upload_resource_type = context["resource_type"]

    print(f"[Cloudinary] resolved resource_type={upload_resource_type!r}")

    file_bytes = file.file.read()

    # Cloudinary requires the extension in the public_id for 'raw' assets.
    # For 'image' assets, we typically exclude the extension in public_id.
    actual_public_id = context["public_id"]

    upload_params = {
        "folder": folder_path,
        "public_id": actual_public_id,
        "resource_type": upload_resource_type,
        "use_filename": True,
        "unique_filename": True,
        "type": "upload",
        "access_mode": "public",
        # NOTE: Do NOT include access_control here.
        # Cloudinary does not support access_control for raw resources and
        # will silently keep the asset restricted, causing 401 on delivery.
    }

    response = cloudinary.uploader.upload(file_bytes, **upload_params)

    public_id = response.get("public_id")
    resource_type = response.get("resource_type", upload_resource_type)
    delivery_type = response.get("type", "upload")

    print(f"[Cloudinary] upload response resource_type={resource_type!r} secure_url={response.get('secure_url')!r}")

    # Post-upload: explicitly set access_mode=public via Admin API.
    # This repairs any asset where the upload ACL was not applied correctly.
    if public_id:
        try:
            cloudinary.api.update(
                public_id,
                resource_type=resource_type,
                type=delivery_type,
                access_mode="public",
                # No access_control here either — same reason as above.
            )
            print(f"[Cloudinary] api.update access_mode=public OK for {public_id!r}")
        except Exception as e:
            print(f"[Cloudinary] api.update warning (non-fatal): {e}")

    public_url = response.get("secure_url") or response.get("url")
    if not public_url and public_id:
        public_url, _ = cloudinary.utils.cloudinary_url(
            public_id,
            secure=True,
            resource_type=resource_type,
            type=delivery_type,
        )

    file.file.seek(0)

    return {
        "url": public_url,
        "secure_url": response.get("secure_url"),
        "public_id": public_id,
        "resource_type": resource_type,
        "type": delivery_type,
        "bytes": response.get("bytes", 0),
    }

def upload_local_file_to_cloudinary(
    file_path: str, 
    user_id: str, 
    session_id: str = "generated", 
    filename: Optional[str] = None
) -> dict:
    """
    Uploads a local file (by path) to Cloudinary.
    Useful for AI-generated documents.
    """
    if not settings.CLOUDINARY_CLOUD_NAME or settings.CLOUDINARY_CLOUD_NAME == "YOUR_CLOUD_NAME":
        raise ValueError("Cloudinary is not configured.")

    if not filename:
        filename = os.path.basename(file_path)

    context = _resolve_upload_context(filename, "application/octet-stream", user_id, session_id)
    folder_path = context["folder_path"]
    
    # We treat documents as 'raw' for proper rendering/downloading
    upload_params = {
        "folder": folder_path,
        "public_id": context["public_id"],
        "resource_type": "raw",
        "use_filename": True,
        "unique_filename": True,
        "type": "upload",
        "access_mode": "public",
    }

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    response = cloudinary.uploader.upload(file_bytes, **upload_params)
    
    # Ensure public access
    public_id = response.get("public_id")
    if public_id:
        try:
            cloudinary.api.update(
                public_id,
                resource_type="raw",
                access_mode="public",
            )
        except Exception:
            pass

    return {
        "url": response.get("secure_url") or response.get("url"),
        "public_id": public_id,
        "resource_type": "raw",
        "filename": filename,
        "bytes": response.get("bytes", 0),
    }


def delete_from_cloudinary(public_id: str) -> bool:
    """
    Delete a resource from Cloudinary.
    Try both 'image' and 'raw' resource types since PDFs/Docs are often 'raw'.
    """
    if not settings.CLOUDINARY_CLOUD_NAME or settings.CLOUDINARY_CLOUD_NAME == "YOUR_CLOUD_NAME":
        return False

    try:
        for res_type in ["image", "raw"]:
            result = cloudinary.uploader.destroy(public_id, resource_type=res_type)
            if result.get("result") == "ok":
                return True
        return False
    except Exception as e:
        print(f"Error deleting from Cloudinary: {str(e)}")
        return False


def ensure_public_delivery(public_id: str) -> bool:
    """
    Ensure an existing Cloudinary asset is publicly deliverable.
    Useful to repair older assets uploaded with restrictive access mode.
    """
    if not settings.CLOUDINARY_CLOUD_NAME or settings.CLOUDINARY_CLOUD_NAME == "YOUR_CLOUD_NAME":
        return False

    for res_type in ["raw", "image", "video"]:
        try:
            cloudinary.api.update(
                public_id,
                resource_type=res_type,
                type="upload",
                access_mode="public",
                # No access_control — not supported for raw, causes silent 401.
            )
            return True
        except Exception:
            continue

    return False


def delete_session_folder(user_id: str, session_id: str) -> bool:
    """
    Delete an entire session folder from Cloudinary.
    Deletes all resources (both raw and image types) in the folder, then the folder itself.
    """
    if not settings.CLOUDINARY_CLOUD_NAME:
        return False

    folder_path = f"RagDraftingAI/{user_id}/{session_id}"
    prefix = folder_path + "/"

    try:
        # Delete raw resources (PDFs, DOCX, etc.) — default resource_type is 'image', which misses these.
        try:
            cloudinary.api.delete_resources_by_prefix(prefix, resource_type="raw")
        except Exception as e:
            print(f"Cloudinary raw resource cleanup info: {str(e)}")

        # Delete image resources (screenshots, previews, etc.)
        try:
            cloudinary.api.delete_resources_by_prefix(prefix, resource_type="image")
        except Exception as e:
            print(f"Cloudinary image resource cleanup info: {str(e)}")

        # Delete the now-empty folder.  If it never existed (no files were ever uploaded
        # for this session), Cloudinary returns 404 — treat that as a non-error.
        try:
            cloudinary.api.delete_folder(folder_path)
        except Exception as e:
            err_str = str(e)
            if "404" in err_str or "Can't find folder" in err_str:
                # Folder didn't exist — nothing to clean up, that's fine.
                pass
            else:
                print(f"Cloudinary folder delete warning: {err_str}")

        return True
    except Exception as e:
        print(f"Cloudinary folder cleanup error: {str(e)}")
        return False


def get_health_status() -> dict:
    """Check Cloudinary configuration and connectivity."""
    if not settings.CLOUDINARY_CLOUD_NAME or settings.CLOUDINARY_CLOUD_NAME == "YOUR_CLOUD_NAME":
        return {
            "status": "error",
            "provider": "Cloudinary",
            "error_message": "Cloudinary chưa được cấu hình (Thiếu CLOUD_NAME)."
        }

    try:
        cloudinary.api.ping()
        return {
            "status": "healthy",
            "provider": "Cloudinary",
            "error_message": None
        }
    except Exception as e:
        return {
            "status": "error",
            "provider": "Cloudinary",
            "error_message": f"Lỗi kết nối Cloudinary: {str(e)}"
        }