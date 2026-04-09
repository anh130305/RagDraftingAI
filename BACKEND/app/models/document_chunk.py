"""
DocumentChunk model
Lightweight pointer linking a document to its vector-DB embeddings.
Content and metadata live in the RAG service / Qdrant, not here.
"""

import uuid

from sqlalchemy import Column, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vectordb_point_id = Column(UUID(as_uuid=True), unique=True, nullable=True)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # ── Relationships ───────────────────────────────────────────
    document = relationship("Document", back_populates="chunks")

    def __repr__(self) -> str:
        return (
            f"<DocumentChunk doc={self.document_id}  "
            f"idx={self.chunk_index}  qdrant={self.vectordb_point_id}>"
        )
