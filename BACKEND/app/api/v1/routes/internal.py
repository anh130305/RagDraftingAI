"""
routes.internal – Internal API endpoints called by the RAG service.
These are NOT exposed to end-users.
"""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.document import DocumentResponse
from app.schemas.internal import RAGCallbackPayload
from app.services import document_service

router = APIRouter(prefix="/internal", tags=["Internal"])


@router.post(
    "/documents/{document_id}/callback",
    response_model=DocumentResponse,
)
def rag_callback(
    document_id: UUID,
    payload: RAGCallbackPayload,
    db: Session = Depends(get_db),
):
    """Called by the RAG service after it finishes processing a document.
    Updates document status and creates chunk pointer records.
    """
    return document_service.handle_rag_callback(db, document_id, payload)
