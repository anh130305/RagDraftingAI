"""repair_missing_runtime_columns

Revision ID: f5a6b7c8d9e0
Revises: 13a1c32abdc3
Create Date: 2026-05-31 00:05:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, Sequence[str], None] = "13a1c32abdc3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS rag_ingested BOOLEAN NOT NULL DEFAULT false
        """
    )
    op.execute(
        """
        ALTER TABLE chat_messages
        ADD COLUMN IF NOT EXISTS llm_model VARCHAR
        """
    )
    op.execute(
        """
        ALTER TABLE query_logs
        ADD COLUMN IF NOT EXISTS llm_model VARCHAR
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE query_logs
        DROP COLUMN IF EXISTS llm_model
        """
    )
    op.execute(
        """
        ALTER TABLE chat_messages
        DROP COLUMN IF EXISTS llm_model
        """
    )
    op.execute(
        """
        ALTER TABLE documents
        DROP COLUMN IF EXISTS rag_ingested
        """
    )
