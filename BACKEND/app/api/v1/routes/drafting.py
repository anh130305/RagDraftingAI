import uuid
import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Any

from app.api.deps import require_chat_user, get_db
from app.models.user import User
from app.models.document import DocStatus
from app.repositories.document_repo import document_repo
from app.schemas.drafting import DraftRequest, DraftResponse
from app.services.rag_service import rag_service
from app.services import document_service
from app.services.cloudinary_service import upload_local_file_to_cloudinary

router = APIRouter(prefix="/drafting", tags=["Drafting"])

# Temporary directory for generation before uploading to Cloud
TEMP_GENERATION_DIR = Path("uploads/temp_drafts")

@router.post("/generate", response_model=DraftResponse)
def generate_draft(
    payload: DraftRequest,
    current_user: User = Depends(require_chat_user)
):
    """
    Generate administrative document fields based on a query and legal context.
    """
    result = rag_service.draft_document(
        query=payload.query,
        extras=payload.extras,
        legal_type_filter=payload.legal_type_filter
    )
    
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result.get("error", "Drafting failed"))
    
    if result["status"] == "prompt_only":
        raise HTTPException(
            status_code=400, 
            detail="LLM API Key is missing. Only prompt generation is available in this mode."
        )
        
    return result

@router.post("/generate-docx", response_model=DraftResponse)
def generate_draft_docx(
    request: Request,
    payload: DraftRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user)
):
    """
    Draft the document, generate a Word file, upload to Cloudinary, and save to DB.
    """
    # 1. Perform legal drafting
    result = generate_draft(payload=payload, current_user=current_user)
    
    # 2. Export to Word Template (Temporarily on disk)
    form_id = result.meta.form_id
    if form_id == "N/A":
        return result

    local_path = None
    try:
        # Generate unique temporary name
        file_id = str(uuid.uuid4())
        filename = f"{form_id}_{file_id}.docx"
        local_path = TEMP_GENERATION_DIR / filename
        
        # Ensure temp dir exists
        TEMP_GENERATION_DIR.mkdir(parents=True, exist_ok=True)
        
        # Fill template
        rag_service.export_to_docx(
            form_id=form_id,
            fields=result.fields,
            output_path=str(local_path)
        )
        
        # 3. Upload to Cloudinary
        upload_result = upload_local_file_to_cloudinary(
            file_path=str(local_path),
            user_id=str(current_user.id),
            session_id="drafting",
            filename=f"generated_{form_id}_{file_id[:8]}.docx"
        )
        
        # 4. Save to Database as a permanent Document record
        doc_response = document_service.upload_document(
            db,
            title=f"Bản thảo: {result.meta.form_type} ({file_id[:8]})",
            file_path=upload_result["url"],
            file_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            file_size=upload_result["bytes"],
            uploaded_by=current_user.id,
            # We don't link to a chat_session for generic drafting yet, 
            # but we could if payload included it.
            cloudinary_public_id=upload_result["public_id"],
        )
        
        # 5. Set status to 'ready' immediately (no manual indexing needed for drafts)
        # We need the actual model instance to update status easily
        doc_model = document_repo.get_by_id(db, doc_response.id)
        if doc_model:
            document_repo.update_status(db, db_obj=doc_model, status=DocStatus.ready)
            # Re-fetch or refresh if needed, but DocumentResponse will be recalculated
            result.document = document_service.get_document(db, doc_response.id)
        
    except FileNotFoundError as fnf:
        result.meta.extras = (result.meta.extras or "") + f"\n[Warning: Template not found: {str(fnf)}]"
    except Exception as e:
        result.meta.extras = (result.meta.extras or "") + f"\n[Error: Word/Cloud/DB failed: {str(e)}]"
    finally:
        # 6. Clean up temporary file
        if local_path and local_path.exists():
            try:
                os.remove(local_path)
            except Exception:
                pass
        
    return result
