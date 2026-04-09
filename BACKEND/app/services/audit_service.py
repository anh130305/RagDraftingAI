"""
services.audit_service – Audit log creation and retrieval.
"""

from typing import Optional, Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditAction
from app.repositories.audit_repo import audit_repo
from app.schemas.audit import AuditLogFilter, AuditLogResponse, AuditLogListResponse


def log_action(
    db: Session,
    *,
    user_id: Optional[UUID],
    action: AuditAction,
    resource_type: Optional[str] = None,
    resource_id: Optional[UUID] = None,
    ip_address: Optional[str] = None,
    detail: Optional[Any] = None,
) -> None:
    """Append a new audit log entry.  Fire-and-forget — no return value needed."""
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
