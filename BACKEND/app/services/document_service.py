"""
services.document_service – Document upload, listing, and RAG callback handling.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.repositories.document_repo import document_repo, chunk_repo
from app.models.document import DocStatus
from app.schemas.document import (
    DocumentResponse,
    DocumentWithChunks,
    DocumentListResponse,
    DocumentChunkResponse,
)
from app.schemas.internal import RAGCallbackPayload
from app.services import cloudinary_service


# ── Upload ───────────────────────────────────────────────────

def upload_document(
    db: Session,
    *,
    title: str,
    file_path: str,
    file_type: Optional[str] = None,
    file_size: Optional[int] = None,
    uploaded_by: UUID,
    session_id: Optional[UUID] = None,
    cloudinary_public_id: Optional[str] = None,
) -> DocumentResponse:
    """Register a document in the DB with status=pending."""
    doc = document_repo.create(
        db,
        obj_in={
            "title": title,
            "file_path": file_path,
            "file_type": file_type,
            "file_size": file_size,
            "uploaded_by": uploaded_by,
            "session_id": session_id,
            "cloudinary_public_id": cloudinary_public_id,
            "status": DocStatus.pending,
        },
    )
    return DocumentResponse.model_validate(doc)


# ── List / Detail ────────────────────────────────────────────

def list_documents(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
) -> DocumentListResponse:
    docs = document_repo.get_all(db, skip=skip, limit=limit)
    total = document_repo.count(db)
    return DocumentListResponse(
        items=[DocumentResponse.model_validate(d) for d in docs],
        total=total,
    )


def get_document(db: Session, doc_id: UUID) -> DocumentResponse:
    doc = document_repo.get_by_id(db, doc_id)
    if not doc:
        raise NotFoundError("Document")
    return DocumentResponse.model_validate(doc)


def get_document_with_chunks(db: Session, doc_id: UUID) -> DocumentWithChunks:
    doc = document_repo.get_by_id(db, doc_id)
    if not doc:
        raise NotFoundError("Document")
    chunks = chunk_repo.get_by_document(db, doc_id)
    return DocumentWithChunks(
        **DocumentResponse.model_validate(doc).model_dump(),
        chunks=[DocumentChunkResponse.model_validate(c) for c in chunks],
    )


def delete_document(db: Session, doc_id: UUID) -> None:
    doc = document_repo.get_by_id(db, doc_id)
    if not doc:
        raise NotFoundError("Document")
    
    # If it's a Cloudinary document, delete from storage
    if doc.cloudinary_public_id:
        cloudinary_service.delete_from_cloudinary(doc.cloudinary_public_id)

    document_repo.delete(db, id=doc_id)


# ── RAG Callback ─────────────────────────────────────────────

def handle_rag_callback(
    db: Session, doc_id: UUID, payload: RAGCallbackPayload
) -> DocumentResponse:
    """Called by the RAG service after chunking completes.
    Updates document status and bulk-inserts chunk pointer records.
    """
    doc = document_repo.get_by_id(db, doc_id)
    if not doc:
        raise NotFoundError("Document")

    if payload.status == DocStatus.ready and payload.chunks:
        chunk_dicts = [
            {
                "document_id": doc_id,
                "vectordb_point_id": c.vectordb_point_id,
                "chunk_index": c.chunk_index,
                "page_number": c.page_number,
            }
            for c in payload.chunks
        ]
        chunk_repo.bulk_create(db, chunk_dicts)

    document_repo.update_status(
        db,
        doc,
        payload.status,
        error_message=payload.error_message,
        chunk_count=len(payload.chunks) if payload.chunks else 0,
    )
    return DocumentResponse.model_validate(doc)
