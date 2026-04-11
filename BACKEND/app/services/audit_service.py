"""
services.audit_service – Audit log creation and retrieval.
"""

from typing import Optional, Any
from uuid import UUID, UUID as py_uuid

from sqlalchemy.orm import Session

from app.models.audit_log import AuditAction
from app.repositories.audit_repo import audit_repo
from app.schemas.audit import AuditLogFilter, AuditLogResponse, AuditLogListResponse
from app.db.session import get_session_local


def log_action(
    *,
    user_id: Optional[UUID],
    action: AuditAction,
    resource_type: Optional[str] = None,
    resource_id: Optional[UUID] = None,
    ip_address: Optional[str] = None,
    detail: Optional[Any] = None,
    db: Optional[Session] = None,
) -> None:
    """Append a new audit log entry.

    Creates its own DB session so it can safely run inside BackgroundTasks
    (where the request's session has already been closed).
    """
    own_session = db is None
    if own_session:
        db = get_session_local()()
        
    try:
        if isinstance(user_id, str):
            user_id = py_uuid(user_id)
        if isinstance(resource_id, str):
            resource_id = py_uuid(resource_id)
    except ValueError:
        pass
        
    try:
        audit_repo.create(
            db,
            obj_in={
                "user_id": user_id,
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "ip_address": ip_address,
                "detail": detail,
            },
        )
    except Exception:
        if own_session:
            db.rollback()
        raise
    finally:
        if own_session:
            db.close()


def get_audit_logs(db: Session, filters: AuditLogFilter) -> AuditLogListResponse:
    """Retrieve filtered, paginated audit logs (admin only)."""
    items = audit_repo.get_filtered(
        db,
        user_id=filters.user_id,
        action=filters.action,
        resource_type=filters.resource_type,
        date_from=filters.date_from,
        date_to=filters.date_to,
        skip=filters.skip,
        limit=filters.limit,
    )
    total = audit_repo.count_filtered(
        db,
        user_id=filters.user_id,
        action=filters.action,
        resource_type=filters.resource_type,
        date_from=filters.date_from,
        date_to=filters.date_to,
    )
    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(i) for i in items],
        total=total,
    )
