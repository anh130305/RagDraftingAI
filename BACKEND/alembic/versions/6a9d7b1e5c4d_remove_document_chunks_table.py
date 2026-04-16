"""remove_document_chunks_table

Revision ID: 6a9d7b1e5c4d
Revises: c6ab8b482a1f
Create Date: 2026-04-16 12:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6a9d7b1e5c4d'
down_revision: Union[str, Sequence[str], None] = 'c6ab8b482a1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Drop document_chunks table
    op.drop_table('document_chunks')

def downgrade() -> None:
    # Re-create document_chunks table
    op.create_table('document_chunks',
        sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
        sa.Column('document_id', sa.UUID(), autoincrement=False, nullable=False),
        sa.Column('vectordb_point_id', sa.UUID(), autoincrement=False, nullable=True),
        sa.Column('chunk_index', sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column('page_number', sa.INTEGER(), autoincrement=False, nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], name='document_chunks_document_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='document_chunks_pkey'),
        sa.UniqueConstraint('vectordb_point_id', name='document_chunks_vectordb_point_id_key')
    )
    op.create_index('ix_document_chunks_document_id', 'document_chunks', ['document_id'], unique=False)
