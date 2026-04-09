"""
schemas.internal – DTOs for internal API calls (RAG service callbacks).
"""

from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel

from app.models.document import DocStatus


class ChunkPayload(BaseModel):
    """A single chunk reported back by the RAG service."""
    vectordb_point_id: UUID
    chunk_index: int
    page_number: Optional[int] = None


class RAGCallbackPayload(BaseModel):
    """POST /internal/documents/{id}/callback
    Called by the RAG service after chunking a document.
    """
    status: DocStatus
    chunks: List[ChunkPayload] = []
    error_message: Optional[str] = None
