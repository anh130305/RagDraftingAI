"""
routes.admin – Admin-only endpoints for user management and audit logs.
"""

from typing import List
from uuid import UUID
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query, Request, BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.user import User
from app.models.audit_log import AuditAction
from app.models.chat_message import ChatMessage, MessageRole
from app.schemas.user import UserResponse, AdminUserUpdate
from app.schemas.audit import AuditLogFilter, AuditLogListResponse
from app.schemas.prompt_template import (
    PromptTemplateCreate,
    PromptTemplateUpdate,
    PromptTemplateResponse,
    PromptTemplateListResponse,
)
from app.services import user_service, audit_service, prompt_template_service
from app.services import system_stats_service

router = APIRouter(prefix="/admin", tags=["Admin"])


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
    return prompt_template_service.list_templates(db)


@router.post("/prompt-templates", response_model=PromptTemplateResponse, status_code=201)
def create_prompt_template(
    payload: PromptTemplateCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return prompt_template_service.create_template(db, admin.id, payload)


@router.put("/prompt-templates/{template_id}", response_model=PromptTemplateResponse)
def update_prompt_template(
    template_id: UUID,
    payload: PromptTemplateUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return prompt_template_service.update_template(db, template_id, payload)


@router.delete("/prompt-templates/{template_id}", status_code=204)
def delete_prompt_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    prompt_template_service.delete_template(db, template_id)


@router.put("/prompt-templates/{template_id}/default", response_model=PromptTemplateResponse)
def set_default_prompt_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return prompt_template_service.set_default_template(db, template_id)
