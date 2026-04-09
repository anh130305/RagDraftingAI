"""
schemas.query_log – Pydantic DTOs for query log responses.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class QueryLogResponse(BaseModel):
    id: UUID
    session_id: Optional[UUID] = None
    message_id: Optional[UUID] = None
    response_time_ms: Optional[int] = None
    chunk_found: bool
    created_at: datetime

    model_config = {"from_attributes": True}
