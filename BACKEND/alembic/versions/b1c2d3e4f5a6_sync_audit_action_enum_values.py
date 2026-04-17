"""sync_audit_action_enum_values

Revision ID: b1c2d3e4f5a6
Revises: 8f9a2b3c4d5e
Create Date: 2026-04-17 16:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "8f9a2b3c4d5e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


AUDIT_ACTION_VALUES = (
    "login",
    "logout",
    "upload_document",
    "delete_document",
    "query",
    "create_session",
    "delete_session",
    "update_user",
    "download_document",
    "storage_error",
    "draft_document",
    "create_template",
    "update_template",
    "delete_template",
    "use_template",
)


def upgrade() -> None:
    """Ensure all required values exist in PostgreSQL enum audit_action."""
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return

    for value in AUDIT_ACTION_VALUES:
        escaped = value.replace("'", "''")
        conn.execute(sa.text(f"ALTER TYPE audit_action ADD VALUE IF NOT EXISTS '{escaped}'"))


def downgrade() -> None:
    """Enum value removals are intentionally skipped to keep data safe."""
    pass
