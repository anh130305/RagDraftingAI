"""
routes.admin – Admin-only endpoints for user management and audit logs.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.user import User
from app.schemas.user import UserResponse, AdminUserUpdate
from app.schemas.audit import AuditLogFilter, AuditLogListResponse
from app.services import user_service, audit_service

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
    user_id: UUID,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return user_service.admin_update_user(db, user_id, payload)


# ── Audit logs ───────────────────────────────────────────────

@router.get("/audit-logs", response_model=AuditLogListResponse)
def get_audit_logs(
    filters: AuditLogFilter = Depends(),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return audit_service.get_audit_logs(db, filters)
