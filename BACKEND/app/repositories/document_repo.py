"""
repositories.document_repo – Document & chunk data access.
"""

from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.document import Document, DocStatus
from app.models.document_chunk import DocumentChunk
from app.repositories.base_repo import BaseRepository


# ── Document Repository ──────────────────────────────────────

class DocumentRepository(BaseRepository[Document]):
    def __init__(self):
        super().__init__(Document)

    def get_by_uploader(
        self,
        db: Session,
        user_id: UUID,
        *,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Document]:
        return (
            db.query(Document)
            .filter(Document.uploaded_by == user_id)
            .order_by(desc(Document.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_status(
        self, db: Session, status: DocStatus
    ) -> List[Document]:
        return db.query(Document).filter(Document.status == status).all()

    def update_status(
        self,
        db: Session,
        doc: Document,
        status: DocStatus,
        *,
        error_message: Optional[str] = None,
        chunk_count: Optional[int] = None,
    ) -> Document:
        doc.status = status
        if error_message is not None:
            doc.error_message = error_message
        if chunk_count is not None:
            doc.chunk_count = chunk_count
        db.commit()
        db.refresh(doc)
        return doc


# ── Chunk Repository ─────────────────────────────────────────

class DocumentChunkRepository(BaseRepository[DocumentChunk]):
    def __init__(self):
        super().__init__(DocumentChunk)

    def get_by_document(
        self, db: Session, document_id: UUID
    ) -> List[DocumentChunk]:
        return (
            db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.chunk_index.asc())
            .all()
        )

    def bulk_create(
        self, db: Session, chunks: List[dict]
    ) -> List[DocumentChunk]:
        """Insert multiple chunks in a single transaction."""
        db_chunks = [DocumentChunk(**c) for c in chunks]
        db.add_all(db_chunks)
        db.commit()
        for c in db_chunks:
            db.refresh(c)
        return db_chunks


# Singleton instances
document_repo = DocumentRepository()
chunk_repo = DocumentChunkRepository()
