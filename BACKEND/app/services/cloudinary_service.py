"""
services.cloudinary_service - Cloudinary SDK integration
"""

import cloudinary
import cloudinary.uploader
import cloudinary.api
import cloudinary.utils
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

    folder_path = f"RagDraftingAI/{user_id}/{session_id}"

    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()

    print(f"[Cloudinary] upload filename={filename!r} content_type={content_type!r}")

    RAW_EXTENSIONS = (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md")
    RAW_CONTENT_TYPES = (
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument",
        "application/vnd.ms-",
        "text/plain",
        "text/markdown",
    )

    if any(filename.endswith(ext) for ext in RAW_EXTENSIONS):
        upload_resource_type = "raw"
    elif any(content_type.startswith(ct) for ct in RAW_CONTENT_TYPES):
        upload_resource_type = "raw"
    elif content_type.startswith("image/"):
        upload_resource_type = "image"
    elif content_type.startswith("video/"):
        upload_resource_type = "video"
    else:
        upload_resource_type = "raw"  # safe default: raw accepts all file types

    print(f"[Cloudinary] resolved resource_type={upload_resource_type!r}")

    file_bytes = file.file.read()

    # Cloudinary requires the extension in the public_id for 'raw' assets.
    # For 'image' assets, we typically exclude the extension in public_id.
    actual_public_id = file.filename if upload_resource_type == "raw" else file.filename.rsplit('.', 1)[0]

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
        import os
        filename = os.path.basename(file_path)

    folder_path = f"RagDraftingAI/{user_id}/{session_id}"
    
    # We treat documents as 'raw' for proper rendering/downloading
    upload_params = {
        "folder": folder_path,
        "public_id": filename,
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
    Deletes all resources in the folder, then deletes the folder itself.
    """
    if not settings.CLOUDINARY_CLOUD_NAME:
        return False

    folder_path = f"RagDraftingAI/{user_id}/{session_id}"

    try:
        cloudinary.api.delete_resources_by_prefix(folder_path + "/")
        cloudinary.api.delete_folder(folder_path)
        return True
    except Exception as e:
        print(f"Cloudinary folder cleanup info: {str(e)}")
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