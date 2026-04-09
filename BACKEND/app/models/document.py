"""
Document model
Tracks uploaded files and their processing status through the RAG pipeline.
"""

import enum
import uuid

from sqlalchemy import Column, String, Integer, BigInteger, Enum, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class DocStatus(str, enum.Enum):
    """Lifecycle status of a document in the RAG pipeline."""
    pending = "pending"
    processing = "processing"
    ready = "ready"
    failed = "failed"


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String(20), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    status = Column(
        Enum(DocStatus, name="doc_status", create_type=False),
        nullable=False,
        default=DocStatus.pending,
    )
    uploaded_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    chunk_count = Column(Integer, nullable=False, default=0)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ───────────────────────────────────────────
    uploaded_by_user = relationship("User", back_populates="documents")
    chunks = relationship(
        "DocumentChunk", back_populates="document", cascade="all, delete-orphan",
        passive_deletes=True, order_by="DocumentChunk.chunk_index.asc()",
    )

    def __repr__(self) -> str:
        return f"<Document {self.title!r}  status={self.status.value}>"
