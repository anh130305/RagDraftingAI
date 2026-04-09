"""
repositories.audit_repo – Audit log data access.
Append-only: update() and delete() are intentionally blocked.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.audit_log import AuditLog, AuditAction
from app.repositories.base_repo import BaseRepository


class AuditRepository(BaseRepository[AuditLog]):
    def __init__(self):
        super().__init__(AuditLog)

    # ── Block mutation ───────────────────────────────────────

    def update(self, *args, **kwargs):
        raise NotImplementedError("Audit logs are append-only – update is forbidden")

    def delete(self, *args, **kwargs):
        raise NotImplementedError("Audit logs are append-only – delete is forbidden")

    # ── Queries ──────────────────────────────────────────────

    def get_filtered(
        self,
        db: Session,
        *,
        user_id: Optional[UUID] = None,
        action: Optional[AuditAction] = None,
        resource_type: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[AuditLog]:
        q = db.query(AuditLog)
        if user_id:
            q = q.filter(AuditLog.user_id == user_id)
        if action:
            q = q.filter(AuditLog.action == action)
        if resource_type:
            q = q.filter(AuditLog.resource_type == resource_type)
        if date_from:
            q = q.filter(AuditLog.created_at >= date_from)
        if date_to:
            q = q.filter(AuditLog.created_at <= date_to)
        return q.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit).all()

    def count_filtered(
        self,
        db: Session,
        *,
        user_id: Optional[UUID] = None,
        action: Optional[AuditAction] = None,
        resource_type: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> int:
        q = db.query(AuditLog)
        if user_id:
            q = q.filter(AuditLog.user_id == user_id)
        if action:
            q = q.filter(AuditLog.action == action)
        if resource_type:
            q = q.filter(AuditLog.resource_type == resource_type)
        if date_from:
            q = q.filter(AuditLog.created_at >= date_from)
        if date_to:
            q = q.filter(AuditLog.created_at <= date_to)
        return q.count()


# Singleton instance
audit_repo = AuditRepository()
