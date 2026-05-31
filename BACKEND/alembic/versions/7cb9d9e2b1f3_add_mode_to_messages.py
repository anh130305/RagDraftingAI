"""add_mode_to_messages

Revision ID: 7cb9d9e2b1f3
Revises: 6a9d7b1e5c4d
Create Date: 2026-04-17 08:45:00.000000

"""
from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '7cb9d9e2b1f3'
down_revision: Union[str, Sequence[str], None] = '6a9d7b1e5c4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE chat_messages
        ADD COLUMN IF NOT EXISTS mode VARCHAR
        """
    )

def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE chat_messages
        DROP COLUMN IF EXISTS mode
        """
    )
