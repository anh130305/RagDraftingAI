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

    def get_default(self, db: Session) -> Optional[PromptTemplate]:
        """Return the template currently marked as default."""
        return (
            db.query(PromptTemplate)
            .filter(
                PromptTemplate.is_default == True,
                PromptTemplate.is_active == True,
            )
            .first()
        )

    def set_default(self, db: Session, template_id: UUID) -> PromptTemplate:
        """Unset any existing default template and set the new one."""
        # Unset all defaults
        db.query(PromptTemplate).filter(
            PromptTemplate.is_default == True
        ).update({"is_default": False})

        # Set the new default
        tpl = self.get_by_id(db, template_id)
        if tpl:
            tpl.is_default = True
            db.commit()
            db.refresh(tpl)
        return tpl


# Singleton instance
prompt_template_repo = PromptTemplateRepository()
