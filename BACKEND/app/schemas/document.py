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
    rag_ingested: bool = False
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


class CloudinaryUploadSignatureRequest(BaseModel):
    file_name: str
    content_type: Optional[str] = None
    chat_session_id: Optional[str] = "general"


class CloudinaryUploadSignatureResponse(BaseModel):
    cloud_name: str
    api_key: str
    upload_url: str
    signature: str
    timestamp: int
    folder: str
    public_id: str
    resource_type: str
    type: str = "upload"
    access_mode: str = "public"


class CloudinaryUploadCompleteRequest(BaseModel):
    title: Optional[str] = None
    file_path: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    cloudinary_public_id: str
    chat_session_id: Optional[str] = None
    resource_type: Optional[str] = None


class CloudinaryUploadCompleteResponse(BaseModel):
    document: DocumentResponse
    extracted_text: Optional[str] = None
    ocr_error: Optional[str] = None
