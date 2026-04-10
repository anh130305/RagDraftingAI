"""
routes.documents – Document upload, listing, detail, and chunk retrieval.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, File, Form, Query, Request, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.document import DocumentResponse, DocumentWithChunks, DocumentListResponse
from app.services import document_service, audit_service
from app.models.audit_log import AuditAction

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentResponse, status_code=201)
def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a document."""
    file_path = f"uploads/{file.filename}"

    doc = document_service.upload_document(
        db,
        title=title or file.filename,
        file_path=file_path,
        file_type=file.content_type,
        file_size=file.size,
        uploaded_by=current_user.id,
    )
    
    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.upload_document,
        resource_type="document",
        resource_id=doc.id,
        ip_address=request.client.host if request.client else None
    )
    
    return doc


@router.get("", response_model=DocumentListResponse)
def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return document_service.list_documents(db, skip=skip, limit=limit)


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return document_service.get_document(db, document_id)


@router.get("/{document_id}/chunks", response_model=DocumentWithChunks)
def get_document_chunks(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return document_service.get_document_with_chunks(db, document_id)


@router.delete("/{document_id}", status_code=204)
def delete_document(
    request: Request,
    document_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document_service.delete_document(db, document_id)
    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.delete_document,
        resource_type="document",
        resource_id=document_id,
        ip_address=request.client.host if request.client else None
    )
