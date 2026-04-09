"""
test_documents.py – Tests for document endpoints.

Covers:
  POST   /documents/upload
  GET    /documents
  GET    /documents/{id}
  GET    /documents/{id}/chunks
  DELETE /documents/{id}
"""

import io
import pytest
from uuid import uuid4


class TestUploadDocument:
    """POST /api/v1/documents/upload"""

    def test_upload_success(self, client, normal_auth):
        file_content = b"This is a test document content."
        resp = client.post(
            "/api/v1/documents/upload",
            headers=normal_auth,
            files={"file": ("test.pdf", io.BytesIO(file_content), "application/pdf")},
            data={"title": "Test Document"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Test Document"
        assert data["status"] == "pending"
        assert data["file_type"] == "application/pdf"
        assert "id" in data

    def test_upload_no_title_uses_filename(self, client, normal_auth):
        file_content = b"Some content"
        resp = client.post(
            "/api/v1/documents/upload",
            headers=normal_auth,
            files={"file": ("report.docx", io.BytesIO(file_content), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        assert resp.status_code == 201
        assert resp.json()["title"] == "report.docx"

    def test_upload_no_auth(self, client):
        file_content = b"No auth"
        resp = client.post(
            "/api/v1/documents/upload",
            files={"file": ("test.pdf", io.BytesIO(file_content), "application/pdf")},
        )
        assert resp.status_code == 401


class TestListDocuments:
    """GET /api/v1/documents"""

    def test_list_documents(self, client, normal_auth):
        resp = client.get("/api/v1/documents", headers=normal_auth)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    def test_list_with_pagination(self, client, normal_auth):
        resp = client.get(
            "/api/v1/documents",
            headers=normal_auth,
            params={"skip": 0, "limit": 5},
        )
        assert resp.status_code == 200


class TestGetDocument:
    """GET /api/v1/documents/{id}"""

    def test_get_document_detail(self, client, normal_auth):
        # Upload first
        file_content = b"Detail test"
        upload_resp = client.post(
            "/api/v1/documents/upload",
            headers=normal_auth,
            files={"file": ("detail.pdf", io.BytesIO(file_content), "application/pdf")},
            data={"title": "Detail Doc"},
        )
        doc_id = upload_resp.json()["id"]

        resp = client.get(f"/api/v1/documents/{doc_id}", headers=normal_auth)
        assert resp.status_code == 200
        assert resp.json()["title"] == "Detail Doc"

    def test_get_document_not_found(self, client, normal_auth):
        fake_id = str(uuid4())
        resp = client.get(f"/api/v1/documents/{fake_id}", headers=normal_auth)
        assert resp.status_code == 404


class TestGetDocumentChunks:
    """GET /api/v1/documents/{id}/chunks"""

    def test_get_chunks_empty(self, client, normal_auth):
        # Upload a doc (no chunks since RAG hasn't processed it)
        file_content = b"Chunk test"
        upload_resp = client.post(
            "/api/v1/documents/upload",
            headers=normal_auth,
            files={"file": ("chunks.pdf", io.BytesIO(file_content), "application/pdf")},
            data={"title": "Chunks Doc"},
        )
        doc_id = upload_resp.json()["id"]

        resp = client.get(f"/api/v1/documents/{doc_id}/chunks", headers=normal_auth)
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Chunks Doc"
        assert data["chunks"] == []

    def test_get_chunks_not_found(self, client, normal_auth):
        fake_id = str(uuid4())
        resp = client.get(f"/api/v1/documents/{fake_id}/chunks", headers=normal_auth)
        assert resp.status_code == 404


class TestDeleteDocument:
    """DELETE /api/v1/documents/{id}"""

    def test_delete_document(self, client, normal_auth):
        file_content = b"Delete me"
        upload_resp = client.post(
            "/api/v1/documents/upload",
            headers=normal_auth,
            files={"file": ("delete.pdf", io.BytesIO(file_content), "application/pdf")},
            data={"title": "Delete Doc"},
        )
        doc_id = upload_resp.json()["id"]

        resp = client.delete(f"/api/v1/documents/{doc_id}", headers=normal_auth)
        assert resp.status_code == 204

        # Confirm it's gone
        resp = client.get(f"/api/v1/documents/{doc_id}", headers=normal_auth)
        assert resp.status_code == 404

    def test_delete_not_found(self, client, normal_auth):
        fake_id = str(uuid4())
        resp = client.delete(f"/api/v1/documents/{fake_id}", headers=normal_auth)
        assert resp.status_code == 404
