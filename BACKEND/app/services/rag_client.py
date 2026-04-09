"""
services.rag_client – HTTP client for calling the RAG service.

This module isolates all outbound HTTP calls to the RAG microservice,
making it easy to mock in tests and swap implementations.
"""

import httpx
from uuid import UUID
from typing import Optional

from app.core.config import settings


class RAGClient:
    """Synchronous HTTP client for the RAG service."""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.RAG_SERVICE_URL).rstrip("/")

    def submit_document(self, document_id: UUID, file_path: str) -> dict:
        """Tell the RAG service to start processing a document.
        The RAG service will call back to POST /internal/documents/{id}/callback
        when finished.
        """
        response = httpx.post(
            f"{self.base_url}/process",
            json={
                "document_id": str(document_id),
                "file_path": file_path,
                "callback_url": f"/api/v1/internal/documents/{document_id}/callback",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()

    def query(self, query_text: str, *, top_k: int = 5) -> dict:
        """Send a query to the RAG service and get relevant chunks back."""
        response = httpx.post(
            f"{self.base_url}/query",
            json={"query": query_text, "top_k": top_k},
            timeout=60.0,
        )
        response.raise_for_status()
        return response.json()

    def health_check(self) -> bool:
        """Ping the RAG service."""
        try:
            r = httpx.get(f"{self.base_url}/health", timeout=5.0)
            return r.status_code == 200
        except httpx.RequestError:
            return False


# Singleton instance
rag_client = RAGClient()
