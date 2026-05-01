import uuid
import os
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Any
import time
import datetime
from app.models.query_log import QueryLog

from app.api.deps import require_chat_user, get_db
from app.db.session import get_session_local
from app.models.user import User
from app.models.document import DocStatus
from app.repositories.document_repo import document_repo
from app.schemas.drafting import DraftRequest, DraftResponse
from app.services.rag_service import rag_service
from app.services import document_service, audit_service, chat_service
from app.services.cloudinary_service import upload_local_file_to_cloudinary
from app.models.audit_log import AuditAction

router = APIRouter(prefix="/drafting", tags=["Drafting"])

# Temporary directory for generation before uploading to Cloud
TEMP_GENERATION_DIR = Path("uploads/temp_drafts")

logger = logging.getLogger(__name__)


def _parse_optional_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        return None

@router.post("/generate", response_model=DraftResponse)
async def generate_draft(
    payload: DraftRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_chat_user)
):
    """
    Generate administrative document fields based on a query and legal context.
    """
    start_time = time.perf_counter()
    is_error = False
    error_message = None
    
    result = await rag_service.draft_document(
        query=payload.query,
        extras=payload.extras
    )
    
    elapsed_ms = int((time.perf_counter() - start_time) * 1000)
    
    if result["status"] == "error":
        is_error = True
        error_message = result.get("error", "Drafting failed")
        # Log error to QueryLog if needed, but we'll return the error usually
        
    session_uuid = _parse_optional_uuid(payload.session_id)

    # Log to QueryLog for monitoring statistics
    db_log = None
    try:
        db_log = get_session_local()()
        qlog = QueryLog(
            session_id=session_uuid,
            response_time_ms=elapsed_ms,
            is_error=is_error,
            error_message=error_message
        )
        db_log.add(qlog)
        db_log.commit()
    except Exception as exc:
        if db_log is not None:
            db_log.rollback()
        logger.warning("Failed to save drafting QueryLog: %s", exc)
    finally:
        if db_log is not None:
            db_log.close()
    
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result.get("error", "Drafting failed"))
    
    if result["status"] == "prompt_only":
        raise HTTPException(
            status_code=400, 
            detail="LLM API Key is missing. Only prompt generation is available in this mode."
        )
        
    # Log the drafting action for statistics (Preview/Form identification)
    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.draft_document,
        resource_type="draft_meta",
        resource_id=None,
        ip_address=None, # generate endpoint doesn't always have request easily accessible without adding it
        detail={
            "query_length": len(payload.query),
            "mode": "preview",
            "form_type": result.get("meta", {}).get("form_type")
        }
    )
    return result


@router.post("/generate-docx", response_model=DraftResponse)
async def generate_draft_docx(
    request: Request,
    payload: DraftRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user)
):
    """
    Draft the document, generate a Word file, upload to Cloudinary, and save to DB.
    """
    # 1. Perform legal drafting
    result = await generate_draft(payload=payload, background_tasks=background_tasks, current_user=current_user)
    session_uuid = _parse_optional_uuid(payload.session_id)
    
    # 2. Export to Word Template (Temporarily on disk)
    form_id = result.get("meta", {}).get("form_id", "N/A")
    if form_id == "N/A":
        return result

    local_path = None
    try:
        fields = result.get("fields", {})
        meta = result.get("meta", {})

        # Generate clean timestamp-based filename
        # Format: VanBan_DDMMYY_HHMM
        now = datetime.datetime.now()
        timestamp = now.strftime("%d%m%y_%H%M")
        clean_title = meta.get('form_type', 'VanBan').replace(' ', '')
        filename = f"{clean_title}_{timestamp}.docx"
        
        local_path = TEMP_GENERATION_DIR / f"{uuid.uuid4()}_{filename}" # Keep UUID prefix for local uniqueness ONLY
        
        # Ensure temp dir exists
        TEMP_GENERATION_DIR.mkdir(parents=True, exist_ok=True)
        
        # Fill template
        rag_service.export_to_docx(
            form_id=form_id,
            fields=fields,
            output_path=str(local_path)
        )
        
        # 3. Upload to Cloudinary
        upload_result = upload_local_file_to_cloudinary(
            file_path=str(local_path),
            user_id=str(current_user.id),
            session_id=payload.session_id or "drafting",
            filename=filename
        )
        
        # 4. Save to Database as a permanent Document record
        try:
            doc_response = document_service.upload_document(
                db,
                title=f"Bản thảo: {meta.get('form_type', 'Van ban')} ({now.strftime('%H:%M %d/%m')})",
                file_path=upload_result["url"],
                file_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                file_size=upload_result["bytes"],
                uploaded_by=current_user.id,
                session_id=session_uuid,
                cloudinary_public_id=upload_result["public_id"],
            )
            
            # 5. Set status to 'ready' immediately (no manual indexing needed for drafts)
            doc_model = document_repo.get_by_id(db, doc_response.id)
            if doc_model:
                document_repo.update_status(db, doc=doc_model, status=DocStatus.ready)
                result["document"] = document_service.get_document(db, doc_response.id)
            
            # 6. Save AI message to chat history for persistence
            if session_uuid:
                try:
                    msg_content = f"Tôi đã soạn thảo xong bản thảo \"{meta.get('form_type', 'Van ban')}\" dựa trên yêu cầu của bạn.\n\n[Tệp đính kèm: {doc_response.title}]"
                    chat_service.create_assistant_response(
                        db,
                        session_id=session_uuid,
                        content=msg_content,
                        mode="generate",
                    )
                except Exception as e:
                    print(f"Failed to save assistant message: {e}")
        except Exception as db_err:
            db.rollback()
            raise db_err
        
    except FileNotFoundError as fnf:
        if "meta" in result:
            result["meta"]["extras"] = (result["meta"].get("extras") or "") + f"\n[Warning: Template not found: {str(fnf)}]"
    except Exception as e:
        if "meta" in result:
            result["meta"]["extras"] = (result["meta"].get("extras") or "") + f"\n[Error: Word/Cloud/DB failed: {str(e)}]"
    finally:
        # 6. Clean up temporary file
        if local_path and local_path.exists():
            try:
                os.remove(local_path)
            except Exception:
                pass
        
    # Log the drafting action for statistics
    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.draft_document,
        resource_type="chat_session",
        resource_id=session_uuid,
        ip_address=request.client.host if request.client else None,
        detail={
            "query_length": len(payload.query),
            "form_type": result.get("meta", {}).get("form_type"),
            "form_id": result.get("meta", {}).get("form_id"),
            "has_document": "document" in result
        }
    )
    return result
