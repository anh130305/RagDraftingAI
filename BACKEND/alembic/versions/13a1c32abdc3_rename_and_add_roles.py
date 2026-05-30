"""rename and add roles

Revision ID: 13a1c32abdc3
Revises: d2e3f4a5b6c7
Create Date: 2026-05-30 14:20:09.973405

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '13a1c32abdc3'
down_revision: Union[str, Sequence[str], None] = 'd2e3f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE user_role RENAME VALUE 'moderator' TO 'clerical_specialist'")
    # ALTER TYPE ADD VALUE cannot be executed inside a transaction block unless we commit or use connection execution options
    # However, Alembic usually runs in transaction. PostgreSQL >= 12 allows ALTER TYPE ADD VALUE in transaction if it's the only statement?
    # Let's try standard op.execute. Alternatively, we can set autocommit block.
    # op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'professional'")
    # A safer approach for adding enum values in alembic:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'professional'")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TYPE user_role RENAME VALUE 'clerical_specialist' TO 'moderator'")
    # Note: Removing a value from ENUM is not supported directly in Postgres. We skip removing 'professional'.
