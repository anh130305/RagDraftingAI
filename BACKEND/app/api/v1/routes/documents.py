"""
routes.documents – Document upload, listing, detail, and chunk retrieval.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, File, Form, Query, Request, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_chat_user
from app.models.user import User
from app.schemas.document import DocumentResponse, DocumentWithChunks, DocumentListResponse
from app.services import document_service, audit_service
from app.models.audit_log import AuditAction
from app.services import cloudinary_service
import io
import pytesseract
import fitz
import docx
from PIL import Image

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentResponse, status_code=201)
def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    chat_session_id: Optional[str] = Form("general"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    """Upload a document."""
    try:
        # Use cloudinary if configured
        cloudinary_res = cloudinary_service.upload_to_cloudinary(
            file, 
            user_id=str(current_user.id), 
            session_id=chat_session_id
        )
        file_path = cloudinary_res["url"]
        cloudinary_public_id = cloudinary_res["public_id"]
    except Exception as e:
        # Log failure to audit trail
        background_tasks.add_task(
            audit_service.log_action,
            user_id=current_user.id,
            action=AuditAction.storage_error,
            resource_type="storage",
            detail={"error": str(e), "filename": file.filename},
            ip_address=request.client.host if request.client else None
        )
        raise HTTPException(
            status_code=500,
            detail="Máy chủ gặp lỗi lưu trữ. Vui lòng thử lại sau hoặc liên hệ quản trị viên."
        )


    doc = document_service.upload_document(
        db,
        title=title or file.filename,
        file_path=file_path,
        file_type=file.content_type,
        file_size=file.size,
        uploaded_by=current_user.id,
        session_id=UUID(chat_session_id) if chat_session_id and chat_session_id != "general" else None,
        cloudinary_public_id=cloudinary_public_id,
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


@router.post("/extract-text")
def extract_text_from_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_chat_user),
):
    """Run extraction on uploaded image, pdf, or docx and return extracted text."""
    try:
        contents = file.file.read()
        filename = file.filename.lower() if file.filename else ""
        
        if filename.endswith(".pdf"):
            doc = fitz.open(stream=contents, filetype="pdf")
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return {"text": text.strip()}
            
        elif filename.endswith(".docx"):
            doc = docx.Document(io.BytesIO(contents))
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            return {"text": text.strip()}
            
        else: # assume image
            image = Image.open(io.BytesIO(contents))
            text = pytesseract.image_to_string(image, lang='vie+eng')
            return {"text": text.strip()}
            
    except Exception as e:
        return {"text": "", "error": str(e)}

@router.get("", response_model=DocumentListResponse)
def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    return document_service.list_documents(
        db,
        user_id=current_user.id,
        session_id=session_id,
        skip=skip,
        limit=limit,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    return document_service.get_document(db, document_id)


@router.get("/{document_id}/chunks", response_model=DocumentWithChunks)
def get_document_chunks(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    return document_service.get_document_with_chunks(db, document_id)


@router.delete("/{document_id}", status_code=204)
def delete_document(
    request: Request,
    document_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
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
