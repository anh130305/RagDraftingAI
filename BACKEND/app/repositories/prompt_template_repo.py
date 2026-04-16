"""
repositories.prompt_template_repo – Prompt template data access.
"""

from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.prompt_template import PromptTemplate
from app.repositories.base_repo import BaseRepository


class PromptTemplateRepository(BaseRepository[PromptTemplate]):
    def __init__(self):
        super().__init__(PromptTemplate)

    def get_all(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[PromptTemplate]:
        """Return all templates including inactive ones, newest first."""
        return (
            db.query(PromptTemplate)
            .order_by(desc(PromptTemplate.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_all(self, db: Session) -> int:
        return db.query(PromptTemplate).count()

    def get_active(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[PromptTemplate]:
        """Return only active (non-deleted) templates, newest first."""
        return (
            db.query(PromptTemplate)
            .filter(PromptTemplate.is_active == True)
            .order_by(desc(PromptTemplate.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_active(self, db: Session) -> int:
        return (
            db.query(PromptTemplate)
            .filter(PromptTemplate.is_active == True)
            .count()
        )

        return tpl


# Singleton instance
prompt_template_repo = PromptTemplateRepository()
