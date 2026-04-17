"""increase_file_type_length

Revision ID: 8f9a2b3c4d5e
Revises: 7cb9d9e2b1f3
Create Date: 2026-04-17 09:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '8f9a2b3c4d5e'
down_revision: Union[str, Sequence[str], None] = '7cb9d9e2b1f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Relax file_type length constraint
    op.alter_column('documents', 'file_type',
               existing_type=sa.VARCHAR(length=20),
               type_=sa.String(),
               existing_nullable=True)

def downgrade() -> None:
    # Restore file_type length constraint (NOT RECOMMENDED if long values exist)
    op.alter_column('documents', 'file_type',
               existing_type=sa.String(),
               type_=sa.VARCHAR(length=20),
               existing_nullable=True)
