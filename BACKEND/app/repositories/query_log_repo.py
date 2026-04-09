"""
repositories.query_log_repo – Query log data access.
"""

from typing import List
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.query_log import QueryLog
from app.repositories.base_repo import BaseRepository


class QueryLogRepository(BaseRepository[QueryLog]):
    def __init__(self):
        super().__init__(QueryLog)

    def get_by_session(
        self,
        db: Session,
        session_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> List[QueryLog]:
        return (
            db.query(QueryLog)
            .filter(QueryLog.session_id == session_id)
            .order_by(desc(QueryLog.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_recent(
        self, db: Session, *, limit: int = 20
    ) -> List[QueryLog]:
        return (
            db.query(QueryLog)
            .order_by(desc(QueryLog.created_at))
            .limit(limit)
            .all()
        )


# Singleton instance
query_log_repo = QueryLogRepository()
