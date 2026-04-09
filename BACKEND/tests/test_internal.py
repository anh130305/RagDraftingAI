"""
test_internal.py – Tests for internal API (RAG service callback).

Covers:
  POST /internal/documents/{id}/callback
"""

import io
import pytest
from uuid import uuid4


class TestRAGCallback:
    """POST /api/v1/internal/documents/{id}/callback"""

    def _upload_doc(self, client, auth):
        """Helper: upload a document and return its ID."""
        resp = client.post(
            "/api/v1/documents/upload",
            headers=auth,
            files={"file": ("rag_test.pdf", io.BytesIO(b"content"), "application/pdf")},
            data={"title": "RAG Callback Test"},
        )
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_callback_ready_with_chunks(self, client, normal_auth):
        doc_id = self._upload_doc(client, normal_auth)

        resp = client.post(
            f"/api/v1/internal/documents/{doc_id}/callback",
            json={
                "status": "ready",
                "chunks": [
                    {
                        "vectordb_point_id": str(uuid4()),
                        "chunk_index": 0,
                        "page_number": 1,
                    },
                    {
                        "vectordb_point_id": str(uuid4()),
                        "chunk_index": 1,
                        "page_number": 1,
                    },
                    {
                        "vectordb_point_id": str(uuid4()),
                        "chunk_index": 2,
                        "page_number": 2,
                    },
                ],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ready"
        assert data["chunk_count"] == 3

    def test_callback_failed(self, client, normal_auth):
        doc_id = self._upload_doc(client, normal_auth)

        resp = client.post(
            f"/api/v1/internal/documents/{doc_id}/callback",
            json={
                "status": "failed",
                "chunks": [],
                "error_message": "Unable to parse PDF",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "failed"
        assert data["error_message"] == "Unable to parse PDF"

    def test_callback_document_not_found(self, client):
        fake_id = str(uuid4())
        resp = client.post(
            f"/api/v1/internal/documents/{fake_id}/callback",
            json={"status": "ready", "chunks": []},
        )
        assert resp.status_code == 404

    def test_callback_verify_chunks_created(self, client, normal_auth):
        """After a successful callback, chunks should be visible via the chunks endpoint."""
        doc_id = self._upload_doc(client, normal_auth)

        # Simulate RAG callback
        chunk_ids = [str(uuid4()) for _ in range(2)]
        client.post(
            f"/api/v1/internal/documents/{doc_id}/callback",
            json={
                "status": "ready",
                "chunks": [
                    {"vectordb_point_id": chunk_ids[0], "chunk_index": 0, "page_number": 1},
                    {"vectordb_point_id": chunk_ids[1], "chunk_index": 1, "page_number": 2},
                ],
            },
        )

        # Now fetch chunks via the documents API
        resp = client.get(f"/api/v1/documents/{doc_id}/chunks", headers=normal_auth)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["chunks"]) == 2
        assert data["chunks"][0]["chunk_index"] == 0
        assert data["chunks"][1]["chunk_index"] == 1
