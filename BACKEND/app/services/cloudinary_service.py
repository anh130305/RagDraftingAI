"""
services.cloudinary_service - Cloudinary SDK integration
"""

import cloudinary
import cloudinary.uploader
import cloudinary.api
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
    Uploads a file to Cloudinary and returns a dict with 'url' and 'public_id'.
    File is structured as: RagDraftingAI/{user_id}/{session_id}/{filename}
    """
    if not settings.CLOUDINARY_CLOUD_NAME or settings.CLOUDINARY_CLOUD_NAME == "YOUR_CLOUD_NAME":
        raise ValueError("Cloudinary is not configured. Missing CLOUD_NAME.")
        
    folder_path = f"RagDraftingAI/{user_id}/{session_id}"
    
    file_bytes = file.file.read()
    
    response = cloudinary.uploader.upload(
        file_bytes,
        folder=folder_path,
        public_id=file.filename.rsplit('.', 1)[0],
        resource_type="auto",
        use_filename=True,
        unique_filename=True
    )
    
    file.file.seek(0)
    
    return {
        "url": response.get("secure_url"),
        "public_id": response.get("public_id")
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


def delete_session_folder(user_id: str, session_id: str) -> bool:
    """
    Delete an entire session folder from Cloudinary.
    Deletes all resources in the folder, then deletes the folder itself.
    """
    if not settings.CLOUDINARY_CLOUD_NAME:
        return False
        
    folder_path = f"RagDraftingAI/{user_id}/{session_id}"
    
    try:
        # Delete all resources in the folder (handles all resource types)
        cloudinary.api.delete_resources_by_prefix(folder_path + "/")
        # Delete the folder itself
        cloudinary.api.delete_folder(folder_path)
        return True
    except Exception as e:
        # It's possible the folder doesn't exist if no files were uploaded
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
        # Simple ping to verify credentials and connectivity
        import cloudinary.api
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
