"""
repositories.user_repo – User-specific data access.
"""

from typing import Optional, List

from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.repositories.base_repo import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self):
        super().__init__(User)

    def get_by_username(self, db: Session, username: str) -> Optional[User]:
        return db.query(User).filter(User.username == username).first()

    def get_by_role(
        self, db: Session, role: UserRole, *, skip: int = 0, limit: int = 100
    ) -> List[User]:
        return (
            db.query(User)
            .filter(User.role == role)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_department(
        self, db: Session, department: str, *, skip: int = 0, limit: int = 100
    ) -> List[User]:
        return (
            db.query(User)
            .filter(User.department == department)
            .offset(skip)
            .limit(limit)
            .all()
        )


# Singleton instance
user_repo = UserRepository()
