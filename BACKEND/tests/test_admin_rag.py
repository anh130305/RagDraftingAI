import pytest
from unittest.mock import patch, AsyncMock
from uuid import uuid4

class TestAdminRAG:
    @patch("app.api.v1.routes.admin.rag_client.status", new_callable=AsyncMock)
    def test_rag_status(self, mock_status, client, admin_auth):
        mock_status.return_value = {"status": "ok"}
        resp = client.get("/api/v1/admin/rag/status", headers=admin_auth)
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    @patch("app.api.v1.routes.admin.rag_client.check_doc", new_callable=AsyncMock)
    def test_rag_check(self, mock_check, client, admin_auth):
        mock_check.return_value = {"exists": True}
        resp = client.post("/api/v1/admin/rag/check", headers=admin_auth, json={"so_hieu": "DOC123"})
        assert resp.status_code == 200
        assert resp.json() == {"exists": True}

    @patch("app.api.v1.routes.admin.rag_client.ingest", new_callable=AsyncMock)
    def test_rag_ingest(self, mock_ingest, client, admin_auth):
        mock_ingest.return_value = {"status": "ingested"}
        resp = client.post("/api/v1/admin/rag/ingest", headers=admin_auth, json={"ocr_text": "hello world", "manual_so_hieu": "DOC123"})
        assert resp.status_code == 200
        assert resp.json() == {"status": "ingested"}

    @patch("app.api.v1.routes.admin.rag_client.delete_doc", new_callable=AsyncMock)
    def test_rag_delete_doc(self, mock_delete, client, admin_auth):
        mock_delete.return_value = {"status": "deleted"}
        resp = client.post("/api/v1/admin/rag/delete-doc", headers=admin_auth, json={"so_hieu": "DOC123"})
        assert resp.status_code == 200
        assert resp.json() == {"status": "deleted"}

    @patch("app.api.v1.routes.admin.rag_client.rebuild_bm25", new_callable=AsyncMock)
    def test_rag_rebuild_bm25(self, mock_rebuild, client, admin_auth):
        mock_rebuild.return_value = {"status": "rebuilding"}
        resp = client.post("/api/v1/admin/rag/rebuild-bm25", headers=admin_auth)
        assert resp.status_code == 200
        assert resp.json() == {"status": "rebuilding"}

