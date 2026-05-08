"""add_llm_model_to_chat_and_query_logs

Revision ID: d2e3f4a5b6c7
Revises: b1c2d3e4f5a6
Create Date: 2026-05-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chat_messages", sa.Column("llm_model", sa.String(), nullable=True))
    op.add_column("query_logs", sa.Column("llm_model", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("query_logs", "llm_model")
    op.drop_column("chat_messages", "llm_model")
