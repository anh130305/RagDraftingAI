"""
schemas.document – Pydantic DTOs for documents and chunks.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel

from app.models.document import DocStatus


# ── Chunk ────────────────────────────────────────────────────

class DocumentChunkResponse(BaseModel):
    id: UUID
    document_id: UUID
    vectordb_point_id: Optional[UUID] = None
    chunk_index: int
    page_number: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Document ─────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: UUID
    title: str
    file_path: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    status: DocStatus
    uploaded_by: Optional[UUID] = None
    session_id: Optional[UUID] = None
    cloudinary_public_id: Optional[str] = None
    chunk_count: int
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentWithChunks(DocumentResponse):
    """GET /documents/{id}/chunks  — document detail with all its chunks."""
    chunks: List[DocumentChunkResponse] = []


# ── Paginated list ───────────────────────────────────────────

class DocumentListResponse(BaseModel):
    """GET /documents  — paginated list."""
    items: List[DocumentResponse]
    total: int
