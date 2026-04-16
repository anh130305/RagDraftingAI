"""
repositories.document_repo – Document & chunk data access.
"""

from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.document import Document, DocStatus
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
        session_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Document]:
        query = db.query(Document).filter(Document.uploaded_by == user_id)
        if session_id is not None:
            query = query.filter(Document.session_id == session_id)

        return (
            query
            .order_by(desc(Document.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_by_uploader(
        self,
        db: Session,
        user_id: UUID,
        *,
        session_id: Optional[UUID] = None,
    ) -> int:
        query = db.query(Document).filter(Document.uploaded_by == user_id)
        if session_id is not None:
            query = query.filter(Document.session_id == session_id)
        return query.count()

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


# Singleton instances
document_repo = DocumentRepository()
