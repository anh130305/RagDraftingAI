"""
routes.admin – Admin-only endpoints for user management and audit logs.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query, Request, BackgroundTasks, HTTPException, UploadFile, File, Form
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.user import User
from app.models.audit_log import AuditAction
from app.models.chat_message import ChatMessage, MessageRole
from app.schemas.user import UserResponse, AdminUserUpdate
from app.schemas.audit import AuditLogFilter, AuditLogListResponse
from app.schemas.document import DocumentResponse, DocumentListResponse
from app.schemas.prompt_template import (
    PromptTemplateCreate,
    PromptTemplateUpdate,
    PromptTemplateResponse,
    PromptTemplateListResponse,
)
from app.services import user_service, audit_service, prompt_template_service, document_service, cloudinary_service
from app.services import system_stats_service, ai_monitoring_service

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── AI Monitoring ──────────────────────────────────────────

@router.get("/ai-monitoring")
def get_ai_monitoring(
    days: int = Query(7, ge=1, le=365),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Returns RAG AI performance metrics including success rate, 
    latency trends, and detailed feedback correlation.
    """
    return ai_monitoring_service.get_ai_monitoring_stats(db, days=days)


# ── User management ──────────────────────────────────────────

@router.get("/users", response_model=List[UserResponse])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return user_service.list_users(db, skip=skip, limit=limit)


@router.put("/users/{user_id}", response_model=UserResponse)
def admin_update_user(
    request: Request,
    user_id: UUID,
    payload: AdminUserUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = user_service.admin_update_user(db, user_id, payload)
    background_tasks.add_task(
        audit_service.log_action,
        user_id=admin.id,
        action=AuditAction.update_user,
        resource_type="user",
        resource_id=user_id,
        ip_address=request.client.host if request.client else None,
        detail=payload.model_dump(exclude_unset=True)
    )
    return user


# ── Audit logs ───────────────────────────────────────────────

@router.get("/audit-logs", response_model=AuditLogListResponse)
def get_audit_logs(
    filters: AuditLogFilter = Depends(),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return audit_service.get_audit_logs(db, filters)


# ── System stats (GPU / CPU / RAM) ───────────────────────────

@router.get("/system-stats")
def get_system_stats(
    admin: User = Depends(require_admin),
):
    """
    Returns real-time system metrics.
    - Uses pynvml for NVIDIA GPU/VRAM data (Windows/Linux with CUDA driver).
    - Uses psutil for CPU and RAM.
    - Automatically falls back to deterministic mock data on macOS / no-GPU.
    """
    return system_stats_service.get_system_stats()


# ── Dashboard stats (feedback + users) ─────────────────────────

@router.get("/dashboard-stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Returns aggregated stats for the admin dashboard:
    - AI response feedback breakdown (like / dislike / none)
    - User counts (total, active, new this month)
    """
    # ── Feedback stats (only assistant messages can have feedback) ───
    feedback_q = (
        db.query(
            ChatMessage.feedback,
            func.count(ChatMessage.id).label("count"),
        )
        .filter(ChatMessage.role == MessageRole.assistant)
        .group_by(ChatMessage.feedback)
        .all()
    )

    feedback_map = {row.feedback: row.count for row in feedback_q}
    likes    = feedback_map.get("like", 0)
    dislikes = feedback_map.get("dislike", 0)
    no_feedback = feedback_map.get(None, 0)
    total_responses = likes + dislikes + no_feedback

    like_rate    = round(likes    / total_responses * 100, 1) if total_responses else 0.0
    dislike_rate = round(dislikes / total_responses * 100, 1) if total_responses else 0.0

    # ── User stats ─────────────────────────────────────────
    total_users  = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0  # noqa: E712

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_this_month = (
        db.query(func.count(User.id))
        .filter(User.created_at >= month_start)
        .scalar() or 0
    )

    return {
        "feedback": {
            "total_responses": total_responses,
            "likes":           likes,
            "dislikes":        dislikes,
            "no_feedback":     no_feedback,
            "like_rate":       like_rate,
            "dislike_rate":    dislike_rate,
        },
        "users": {
            "total":         total_users,
            "active":        active_users,
            "inactive":      total_users - active_users,
            "new_this_month": new_this_month,
        },
    }


# ── Prompt Templates ─────────────────────────────────────────

@router.get("/prompt-templates", response_model=PromptTemplateListResponse)
def list_prompt_templates(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return prompt_template_service.list_all_templates(db)


@router.get("/knowledge-base", response_model=DocumentListResponse)
def list_knowledge_base(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_admin),
):
    """List all common knowledge-base documents (session_id=None)."""
    return document_service.list_global_documents(db, skip=skip, limit=limit)


@router.delete("/knowledge-base/{document_id}", status_code=204)
def delete_knowledge_base_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin-only deletion of a global knowledge base document."""
    return document_service.delete_document(db, document_id)


@router.post("/knowledge-base/upload", response_model=DocumentResponse, status_code=201)
def upload_knowledge_base_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Upload a global knowledge-base document as an admin."""
    try:
        cloudinary_res = cloudinary_service.upload_to_cloudinary(
            file,
            user_id=str(admin.id),
            session_id="general",
        )
        doc = document_service.upload_document(
            db,
            title=title or file.filename,
            file_path=cloudinary_res.get("url"),
            file_type=file.content_type,
            file_size=cloudinary_res.get("bytes") or getattr(file, "size", None),
            uploaded_by=admin.id,
            session_id=None,
            cloudinary_public_id=cloudinary_res.get("public_id"),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Máy chủ gặp lỗi lưu trữ. Vui lòng thử lại sau hoặc liên hệ quản trị viên.",
        ) from exc

    background_tasks.add_task(
        audit_service.log_action,
        user_id=admin.id,
        action=AuditAction.upload_document,
        resource_type="document",
        resource_id=doc.id,
        ip_address=request.client.host if request.client else None,
        detail={"uploaded_via": "admin_knowledge_base"},
    )
    return doc


@router.post("/prompt-templates", response_model=PromptTemplateResponse, status_code=201)
def create_prompt_template(
    request: Request,
    payload: PromptTemplateCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    template = prompt_template_service.create_template(db, admin.id, payload)
    
    background_tasks.add_task(
        audit_service.log_action,
        user_id=admin.id,
        action=AuditAction.create_template,
        resource_type="prompt_template",
        resource_id=template.id,
        ip_address=request.client.host if request.client else None,
        detail={"name": template.name}
    )
    return template


@router.put("/prompt-templates/{template_id}", response_model=PromptTemplateResponse)
def update_prompt_template(
    request: Request,
    template_id: UUID,
    payload: PromptTemplateUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    template = prompt_template_service.update_template(db, template_id, payload)
    
    background_tasks.add_task(
        audit_service.log_action,
        user_id=admin.id,
        action=AuditAction.update_template,
        resource_type="prompt_template",
        resource_id=template_id,
        ip_address=request.client.host if request.client else None,
        detail=payload.model_dump(exclude_unset=True)
    )
    return template


@router.delete("/prompt-templates/{template_id}", status_code=204)
def delete_prompt_template(
    request: Request,
    template_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    prompt_template_service.delete_template(db, template_id)
    
    background_tasks.add_task(
        audit_service.log_action,
        user_id=admin.id,
        action=AuditAction.delete_template,
        resource_type="prompt_template",
        resource_id=template_id,
        ip_address=request.client.host if request.client else None
    )


# ── RAG ChromaDB Management (proxy to RAG service) ──────────

from pydantic import BaseModel
from typing import Optional as Opt
from app.services.rag_client import rag_client
import httpx
from starlette.concurrency import run_in_threadpool
import logging

_rag_logger = logging.getLogger("admin.rag")


@router.get("/rag/status")
async def rag_db_status(
    admin: User = Depends(require_admin),
):
    """Proxy: Get ChromaDB collection stats."""
    try:
        return await rag_client.db_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"RAG service unavailable: {e}")


class RAGCheckRequest(BaseModel):
    so_hieu: str
    collection_key: str = "legal"


@router.post("/rag/check")
async def rag_check_doc(
    payload: RAGCheckRequest,
    admin: User = Depends(require_admin),
):
    """Proxy: Check if document exists in ChromaDB."""
    try:
        return await rag_client.check_doc(payload.so_hieu, payload.collection_key)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"RAG service unavailable: {e}")


class RAGIngestRequest(BaseModel):
    ocr_text: str
    ministry: str = ""
    manual_so_hieu: str = ""
    manual_loai_vb: str = ""
    manual_ten_van_ban: str = ""
    force_if_exists: bool = True
    only_new_chunks: bool = False


@router.post("/rag/ingest")
async def rag_ingest(
    request: Request,
    payload: RAGIngestRequest,
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_admin),
):
    """Proxy: Ingest OCR text into ChromaDB + auto rebuild BM25."""
    try:
        result = await rag_client.ingest(
            ocr_text=payload.ocr_text,
            ministry=payload.ministry,
            manual_so_hieu=payload.manual_so_hieu,
            manual_loai_vb=payload.manual_loai_vb,
            manual_ten_van_ban=payload.manual_ten_van_ban,
            force_if_exists=payload.force_if_exists,
            only_new_chunks=payload.only_new_chunks,
        )

        # Auto rebuild BM25 after successful ingest
        if result.get("status") == "ok":
            try:
                await rag_client.rebuild_bm25()
                result["bm25_rebuild"] = "started"
            except Exception as bm25_err:
                _rag_logger.warning(f"BM25 rebuild failed after ingest: {bm25_err}")
                result["bm25_rebuild"] = f"failed: {bm25_err}"

        # Audit log
        background_tasks.add_task(
            audit_service.log_action,
            user_id=admin.id,
            action=AuditAction.rag_ingest,
            resource_type="chromadb",
            ip_address=request.client.host if request.client else None,
            detail={
                "so_hieu": payload.manual_so_hieu or result.get("header", {}).get("so_hieu", ""),
                "chunks_created": result.get("chunks_created", 0),
                "status": result.get("status", "unknown"),
            },
        )
        return result
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"RAG service unavailable: {e}")


class RAGDeleteDocRequest(BaseModel):
    so_hieu: str
    dry_run: bool = False
    collection_key: str = "legal"


@router.post("/rag/delete-doc")
async def rag_delete_doc(
    request: Request,
    payload: RAGDeleteDocRequest,
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_admin),
):
    """Proxy: Delete all chunks of a document from ChromaDB + auto rebuild BM25."""
    try:
        result = await rag_client.delete_doc(
            so_hieu=payload.so_hieu,
            dry_run=payload.dry_run,
            collection_key=payload.collection_key,
        )

        # Auto rebuild BM25 after real deletion (not dry_run)
        if not payload.dry_run and result.get("deleted_count", 0) > 0:
            try:
                await rag_client.rebuild_bm25()
                result["bm25_rebuild"] = "started"
            except Exception as bm25_err:
                _rag_logger.warning(f"BM25 rebuild failed after delete: {bm25_err}")
                result["bm25_rebuild"] = f"failed: {bm25_err}"

        # Audit log (only for real deletes)
        if not payload.dry_run:
            background_tasks.add_task(
                audit_service.log_action,
                user_id=admin.id,
                action=AuditAction.rag_delete,
                resource_type="chromadb",
                ip_address=request.client.host if request.client else None,
                detail={
                    "so_hieu": payload.so_hieu,
                    "deleted_count": result.get("deleted_count", 0),
                    "protected": result.get("protected", False),
                },
            )
        return result
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"RAG service unavailable: {e}")


class RAGDeleteArticleRequest(BaseModel):
    so_hieu: str
    article_query: str
    dry_run: bool = False
    collection_key: str = "legal"


@router.post("/rag/delete-article")
async def rag_delete_article(
    request: Request,
    payload: RAGDeleteArticleRequest,
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_admin),
):
    """Proxy: Delete chunks of a specific article from ChromaDB + auto rebuild BM25."""
    try:
        result = await rag_client.delete_article(
            so_hieu=payload.so_hieu,
            article_query=payload.article_query,
            dry_run=payload.dry_run,
            collection_key=payload.collection_key,
        )

        # Auto rebuild BM25 after real deletion
        if not payload.dry_run and result.get("deleted_count", 0) > 0:
            try:
                await rag_client.rebuild_bm25()
                result["bm25_rebuild"] = "started"
            except Exception as bm25_err:
                _rag_logger.warning(f"BM25 rebuild failed after article delete: {bm25_err}")
                result["bm25_rebuild"] = f"failed: {bm25_err}"

        if not payload.dry_run:
            background_tasks.add_task(
                audit_service.log_action,
                user_id=admin.id,
                action=AuditAction.rag_delete,
                resource_type="chromadb",
                ip_address=request.client.host if request.client else None,
                detail={
                    "so_hieu": payload.so_hieu,
                    "article": payload.article_query,
                    "deleted_count": result.get("deleted_count", 0),
                },
            )
        return result
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"RAG service unavailable: {e}")


@router.post("/rag/rebuild-bm25")
async def rag_rebuild_bm25(
    request: Request,
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_admin),
):
    """Proxy: Trigger BM25 index rebuild."""
    try:
        result = await rag_client.rebuild_bm25()
        background_tasks.add_task(
            audit_service.log_action,
            user_id=admin.id,
            action=AuditAction.rag_rebuild,
            resource_type="bm25",
            ip_address=request.client.host if request.client else None,
        )
        return result
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"RAG service unavailable: {e}")


class RAGBatchDeleteRequest(BaseModel):
    so_hieu_list: List[str]
    dry_run: bool = False
    collection_key: str = "legal"


@router.post("/rag/batch-delete")
async def rag_batch_delete(
    request: Request,
    payload: RAGBatchDeleteRequest,
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_admin),
):
    """Proxy: Delete multiple documents from ChromaDB in batch."""
    try:
        result = await rag_client.batch_delete(
            so_hieu_list=payload.so_hieu_list,
            dry_run=payload.dry_run,
            collection_key=payload.collection_key,
        )

        # Auto rebuild BM25 after real deletion
        if not payload.dry_run:
            try:
                await rag_client.rebuild_bm25()
            except Exception as bm25_err:
                _rag_logger.warning(f"BM25 rebuild failed after batch delete: {bm25_err}")

            background_tasks.add_task(
                audit_service.log_action,
                user_id=admin.id,
                action=AuditAction.rag_delete,
                resource_type="chromadb",
                ip_address=request.client.host if request.client else None,
                detail={
                    "batch_delete": True,
                    "so_hieu_list": payload.so_hieu_list,
                    "count": len(payload.so_hieu_list),
                },
            )
        return result
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"RAG service unavailable: {e}")


# ── Admin OCR Text Extraction ───────────────────────────────

from fastapi import UploadFile, File

@router.post("/rag/extract-text")
async def admin_extract_text(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
):
    """
    Admin-only OCR endpoint: upload PDF/image/DOCX → extract text.
    Uses enhanced OCR with Tesseract fallback for scanned PDFs.
    """
    try:
        contents = await file.read()
        from app.api.v1.routes.documents import _extract_text_from_bytes
        text = await run_in_threadpool(lambda: _extract_text_from_bytes(
            contents,
            filename=file.filename or "",
            content_type=file.content_type or "",
        ))
        return {
            "text": text,
            "filename": file.filename,
            "chars": len(text),
            "method": "ocr_fallback" if not text else "native",
        }
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Lỗi trích xuất văn bản: {e}")


# ── Ingest Document from Cloudinary → ChromaDB ──────────────

@router.post("/rag/ingest-doc/{document_id}")
async def admin_ingest_doc(
    request: Request,
    document_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Full ingest pipeline:
    1. Get document from DB
    2. Download file from Cloudinary URL
    3. OCR / extract text
    4. Send to RAG service for ChromaDB ingestion
    5. Mark rag_ingested = True
    """
    from app.models.document import Document
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")

    if doc.rag_ingested:
        raise HTTPException(status_code=409, detail="Tài liệu này đã được ingest vào ChromaDB")

    # Step 1: Download file from Cloudinary (async)
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(doc.file_path)
        resp.raise_for_status()
        file_bytes = resp.content
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Không thể tải file từ Cloudinary: {e}")

    # Step 2: OCR / extract text (offload CPU-bound work)
    try:
        from app.api.v1.routes.documents import _extract_text_from_bytes
        ocr_text = await run_in_threadpool(lambda: _extract_text_from_bytes(
            file_bytes,
            filename=doc.title or "",
            content_type=doc.file_type or "",
        ))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Lỗi trích xuất văn bản: {e}")

    if not ocr_text or len(ocr_text.strip()) < 10:
        raise HTTPException(
            status_code=422,
            detail="Không trích xuất được nội dung văn bản đủ dài. File có thể bị hỏng hoặc trống."
        )

    # Step 3: Send to RAG service for ingestion
    # Use document title as so_hieu (filename-based identifier)
    so_hieu = doc.title.rsplit('.', 1)[0] if '.' in doc.title else doc.title

    try:
        result = await rag_client.ingest(
            ocr_text=ocr_text,
            manual_so_hieu=so_hieu,
            force_if_exists=True,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"RAG service unavailable: {e}")

    # Step 4: Auto rebuild BM25
    try:
        await rag_client.rebuild_bm25()
    except Exception:
        pass  # Non-critical

    # Step 5: Mark document as ingested
    doc.rag_ingested = True
    if result.get("chunks_created"):
        doc.chunk_count = result["chunks_created"]
    doc.status = "ready"
    db.commit()

    # Audit log
    background_tasks.add_task(
        audit_service.log_action,
        user_id=admin.id,
        action=AuditAction.rag_ingest,
        resource_type="document",
        resource_id=document_id,
        ip_address=request.client.host if request.client else None,
        detail={"so_hieu": so_hieu, "chunks": result.get("chunks_created", 0)},
    )

    return {
        "status": "ok",
        "document_id": str(document_id),
        "so_hieu": so_hieu,
        "ocr_chars": len(ocr_text),
        **result,
    }


@router.post("/rag/uningest-doc/{document_id}")
async def admin_uningest_doc(
    request: Request,
    document_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Remove document from ChromaDB only, keep in Cloudinary. Sets rag_ingested=False."""
    from app.models.document import Document
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")

    so_hieu = doc.title.rsplit('.', 1)[0] if '.' in doc.title else doc.title

    try:
        result = await rag_client.delete_doc(so_hieu)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"RAG service unavailable: {e}")

    if result.get("protected"):
        raise HTTPException(status_code=403, detail=f'"{so_hieu}" nằm trong danh sách bảo vệ — không thể xoá.')

    # Auto rebuild BM25
    try:
        await rag_client.rebuild_bm25()
    except Exception:
        pass

    # Reset flag
    doc.rag_ingested = False
    doc.chunk_count = 0
    doc.status = "pending"
    db.commit()

    background_tasks.add_task(
        audit_service.log_action,
        user_id=admin.id,
        action=AuditAction.rag_delete,
        resource_type="document",
        resource_id=document_id,
        ip_address=request.client.host if request.client else None,
        detail={"so_hieu": so_hieu, "deleted_count": result.get("deleted_count", 0)},
    )

    return {"status": "ok", "document_id": str(document_id), **result}


@router.delete("/rag/hard-delete-doc/{document_id}")
async def admin_hard_delete_doc(
    request: Request,
    document_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Hard delete: remove from ChromaDB + Cloudinary + PostgreSQL."""
    from app.models.document import Document
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")

    so_hieu = doc.title.rsplit('.', 1)[0] if '.' in doc.title else doc.title
    errors = []

    # 1. Remove from ChromaDB (if ingested)
    if doc.rag_ingested:
        try:
            await rag_client.delete_doc(so_hieu)
            await rag_client.rebuild_bm25()
        except Exception as e:
            errors.append(f"ChromaDB: {e}")

    # 2. Remove from Cloudinary
    if doc.cloudinary_public_id:
        try:
            from app.services import cloudinary_service
            cloudinary_service.delete_from_cloudinary(doc.cloudinary_public_id)
        except Exception as e:
            errors.append(f"Cloudinary: {e}")

    # 3. Remove from PostgreSQL
    db.delete(doc)
    db.commit()

    background_tasks.add_task(
        audit_service.log_action,
        user_id=admin.id,
        action=AuditAction.rag_delete,
        resource_type="document",
        resource_id=document_id,
        ip_address=request.client.host if request.client else None,
        detail={"so_hieu": so_hieu, "hard_delete": True, "errors": errors},
    )

    return {"status": "ok", "document_id": str(document_id), "errors": errors}
