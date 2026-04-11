"""
schemas.audit – Pydantic DTOs for audit log queries and responses.
"""

from datetime import datetime
from typing import Optional, Any, List
from uuid import UUID

from pydantic import BaseModel

from app.models.audit_log import AuditAction


# ── Filter ───────────────────────────────────────────────────

class AuditLogFilter(BaseModel):
    """Query params for GET /admin/audit-logs."""
    user_id: Optional[UUID] = None
    action: Optional[AuditAction] = None
    resource_type: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    skip: int = 0
    limit: int = 50


# ── Response ─────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    user_name: Optional[str] = None
    action: AuditAction
    resource_type: Optional[str] = None
    resource_id: Optional[UUID] = None
    ip_address: Optional[str] = None
    detail: Optional[Any] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    """Paginated audit log list."""
    items: List[AuditLogResponse]
    total: int
