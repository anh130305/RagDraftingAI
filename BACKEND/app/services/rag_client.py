"""
services.rag_client – Async HTTP client for ChromaDB management via the RAG service.

This module isolates all outbound HTTP calls to the RAG microservice's
DB management endpoints (/api/v1/db/*), making it easy to mock in tests
and swap implementations.

NOTE: For RAG query/draft endpoints, use `rag_service.py` instead.
"""

import httpx
from uuid import UUID
from typing import Optional, List

from app.core.config import settings


class RAGClient:
    """Async HTTP client for the RAG service (ChromaDB management endpoints)."""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.RAG_SERVICE_URL).rstrip("/")
        self.rebuild_base_url = (settings.RAG_REBUILD_SERVICE_URL or self.base_url).rstrip("/")
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(300.0, connect=10.0, read=300.0),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=20),
        )

    async def aclose(self) -> None:
        """Close the shared HTTP client gracefully on app shutdown."""
        await self._client.aclose()

    # ── Health ─────────────────────────────────────────────────

    async def health_check(self) -> bool:
        """Ping the RAG service."""
        try:
            r = await self._client.get(
                f"{self.base_url}/api/v1/rag/health", timeout=5.0
            )
            return r.status_code == 200
        except httpx.RequestError:
            return False

    # ── ChromaDB / Vector DB management ───────────────────────

    async def db_status(self) -> dict:
        """Get chunk counts for each ChromaDB collection."""
        r = await self._client.get(
            f"{self.base_url}/api/v1/db/status", timeout=10.0
        )
        r.raise_for_status()
        return r.json()

    async def check_doc(self, so_hieu: str, collection_key: str = "legal") -> dict:
        """Check if a document exists in ChromaDB by its so_hieu."""
        r = await self._client.get(
            f"{self.base_url}/api/v1/db/check/{so_hieu}",
            params={"collection_key": collection_key},
            timeout=15.0,
        )
        r.raise_for_status()
        return r.json()

    async def ingest(
        self,
        ocr_text: str,
        ministry: str = "",
        manual_so_hieu: str = "",
        manual_loai_vb: str = "",
        manual_ten_van_ban: str = "",
        force_if_exists: bool = True,
        only_new_chunks: bool = False,
        dry_run_delete: bool = False,
        skip_upsert: bool = False,
    ) -> dict:
        """Ingest OCR text into ChromaDB. May take a long time for large docs."""
        r = await self._client.post(
            f"{self.base_url}/api/v1/db/ingest",
            json={
                "ocr_text": ocr_text,
                "ministry": ministry,
                "manual_so_hieu": manual_so_hieu,
                "manual_loai_vb": manual_loai_vb,
                "manual_ten_van_ban": manual_ten_van_ban,
                "force_if_exists": force_if_exists,
                "only_new_chunks": only_new_chunks,
                "dry_run_delete": dry_run_delete,
                "skip_upsert": skip_upsert,
            },
            timeout=300.0,  # 5 min for heavy docs
        )
        r.raise_for_status()
        return r.json()

    async def delete_doc(
        self,
        so_hieu: str,
        dry_run: bool = False,
        collection_key: str = "legal",
    ) -> dict:
        """Delete all chunks belonging to a document from ChromaDB."""
        r = await self._client.post(
            f"{self.base_url}/api/v1/db/delete_doc",
            json={
                "so_hieu": so_hieu,
                "dry_run": dry_run,
                "collection_key": collection_key,
            },
            timeout=30.0,
        )
        r.raise_for_status()
        return r.json()

    async def delete_article(
        self,
        so_hieu: str,
        article_query: str,
        dry_run: bool = False,
        collection_key: str = "legal",
    ) -> dict:
        """Delete chunks of a specific article from ChromaDB."""
        r = await self._client.post(
            f"{self.base_url}/api/v1/db/delete_article",
            json={
                "so_hieu": so_hieu,
                "article_query": article_query,
                "dry_run": dry_run,
                "collection_key": collection_key,
            },
            timeout=30.0,
        )
        r.raise_for_status()
        return r.json()

    async def batch_delete(
        self,
        so_hieu_list: List[str],
        dry_run: bool = False,
        collection_key: str = "legal",
    ) -> list:
        """Delete multiple documents from ChromaDB."""
        r = await self._client.post(
            f"{self.base_url}/api/v1/db/batch_delete",
            json={
                "so_hieu_list": so_hieu_list,
                "dry_run": dry_run,
                "collection_key": collection_key,
            },
            timeout=120.0,
        )
        r.raise_for_status()
        return r.json()

    async def rebuild_bm25(self) -> dict:
        """Trigger BM25 index rebuild (runs in background on RAG service)."""
        r = await self._client.post(
            f"{self.rebuild_base_url}/api/v1/db/rebuild_bm25", timeout=100.0
        )
        r.raise_for_status()
        return r.json()


# Singleton instance
rag_client = RAGClient()
