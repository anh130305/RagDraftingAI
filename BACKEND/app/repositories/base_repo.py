"""
repositories.base_repo – Generic CRUD operations.

Every entity-specific repo inherits from BaseRepository
and gains get_by_id, get_all, create, update, delete for free.
"""

from typing import TypeVar, Generic, Type, Optional, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.session import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """Generic repository providing basic CRUD for any SQLAlchemy model."""

    def __init__(self, model: Type[ModelType]):
        self._model = model

    # ── Read ─────────────────────────────────────────────────

    def get_by_id(self, db: Session, id: UUID) -> Optional[ModelType]:
        return db.query(self._model).filter(self._model.id == id).first()

    def get_all(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> List[ModelType]:
        return (
            db.query(self._model)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count(self, db: Session) -> int:
        return db.query(self._model).count()

    # ── Write ────────────────────────────────────────────────

    def create(self, db: Session, *, obj_in: dict) -> ModelType:
        db_obj = self._model(**obj_in)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        *,
        db_obj: ModelType,
        obj_in: dict,
    ) -> ModelType:
        for field, value in obj_in.items():
            if value is not None:
                setattr(db_obj, field, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, *, id: UUID) -> Optional[ModelType]:
        obj = self.get_by_id(db, id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj
