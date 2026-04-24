import pytest
from unittest.mock import patch


class TestCloudinaryPresignUpload:
    def test_presign_upload_returns_signed_payload(self, client, normal_auth):
        resp = client.post(
            "/api/v1/documents/upload/presign",
            headers=normal_auth,
            json={
                "file_name": "bien_ban_hop.pdf",
                "content_type": "application/pdf",
                "chat_session_id": "general",
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["resource_type"] == "raw"
        assert data["public_id"] == "bien_ban_hop.pdf"
        assert data["type"] == "upload"
        assert data["access_mode"] == "public"
        assert data["upload_url"].startswith("https://api.cloudinary.com/v1_1/")
        assert data["signature"]
        assert data["timestamp"] > 0

    def test_presign_image_uses_image_resource_type(self, client, normal_auth):
        resp = client.post(
            "/api/v1/documents/upload/presign",
            headers=normal_auth,
            json={
                "file_name": "avatar.png",
                "content_type": "image/png",
                "chat_session_id": "general",
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["resource_type"] == "image"
        assert data["public_id"] == "avatar"


class TestCloudinaryUploadComplete:
    @patch("app.api.v1.routes.documents.settings.CLOUDINARY_CLOUD_NAME", "demo")
    @patch("app.api.v1.routes.documents._extract_text_from_cloudinary_url", return_value="OCR TEXT")
    @patch("app.api.v1.routes.documents.audit_service.log_action")
    def test_complete_upload_creates_document_and_runs_ocr(
        self,
        mock_log_action,
        mock_extract_text,
        client,
        normal_auth,
        normal_user,
    ):
        user_id = str(normal_user.id)
        resp = client.post(
            "/api/v1/documents/upload/complete",
            headers=normal_auth,
            json={
                "title": "Cloudinary Contract",
                "file_path": f"https://res.cloudinary.com/demo/raw/upload/v1/RagDraftingAI/{user_id}/general/cloudinary_contract.pdf",
                "file_type": "application/pdf",
                "file_size": 12345,
                "cloudinary_public_id": f"RagDraftingAI/{user_id}/general/cloudinary_contract.pdf",
                "chat_session_id": "general",
                "resource_type": "raw",
            },
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["document"]["title"] == "Cloudinary Contract"
        assert data["document"]["file_path"].startswith("https://res.cloudinary.com/")
        assert data["document"]["cloudinary_public_id"] == f"RagDraftingAI/{user_id}/general/cloudinary_contract.pdf"
        assert data["extracted_text"] == "OCR TEXT"
        assert data["ocr_error"] is None
        mock_extract_text.assert_called_once()
        assert mock_log_action.called

    @patch("app.api.v1.routes.documents.audit_service.log_action")
    def test_complete_upload_rejects_non_cloudinary_url(
        self,
        _mock_log_action,
        client,
        normal_auth,
        normal_user,
    ):
        user_id = str(normal_user.id)
        resp = client.post(
            "/api/v1/documents/upload/complete",
            headers=normal_auth,
            json={
                "title": "Invalid URL",
                "file_path": "https://example.com/raw/upload/file.pdf",
                "file_type": "application/pdf",
                "file_size": 12345,
                "cloudinary_public_id": f"RagDraftingAI/{user_id}/general/file.pdf",
                "chat_session_id": "general",
                "resource_type": "raw",
            },
        )

        assert resp.status_code == 400

    @patch("app.api.v1.routes.documents.settings.CLOUDINARY_CLOUD_NAME", "demo")
    @patch("app.api.v1.routes.documents.audit_service.log_action")
    def test_complete_upload_rejects_cross_user_public_id(
        self,
        _mock_log_action,
        client,
        normal_auth,
        normal_user,
    ):
        user_id = str(normal_user.id)
        resp = client.post(
            "/api/v1/documents/upload/complete",
            headers=normal_auth,
            json={
                "title": "Cross User",
                "file_path": f"https://res.cloudinary.com/demo/raw/upload/v1/RagDraftingAI/{user_id}/general/file.pdf",
                "file_type": "application/pdf",
                "file_size": 12345,
                "cloudinary_public_id": "RagDraftingAI/another-user/general/file.pdf",
                "chat_session_id": "general",
                "resource_type": "raw",
            },
        )

        assert resp.status_code == 403
