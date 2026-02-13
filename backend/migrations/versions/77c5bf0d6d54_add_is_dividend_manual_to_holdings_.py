"""add is_dividend_manual to holdings safely

Revision ID: 77c5bf0d6d54
Revises: db16bd51c2e1
Create Date: 2026-02-13 13:31:56.567719

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '77c5bf0d6d54'
down_revision: Union[str, Sequence[str], None] = 'db16bd51c2e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Get existing columns in holdings table
    columns = [col['name'] for col in inspector.get_columns('holdings')]

    if 'is_dividend_manual' not in columns:
        # Add column with server_default (sets False on existing rows)
        op.add_column('holdings',
            sa.Column('is_dividend_manual', sa.Boolean(), server_default='false', nullable=False)
        )
        # Remove server_default after add (optional – keeps model clean)
        op.alter_column('holdings', 'is_dividend_manual',
                        existing_type=sa.Boolean(),
                        server_default=None,
                        nullable=False)
    else:
        # Column exists – ensure no NULL values and set default for future
        op.execute("UPDATE holdings SET is_dividend_manual = false WHERE is_dividend_manual IS NULL")
        op.alter_column('holdings', 'is_dividend_manual',
                        existing_type=sa.Boolean(),
                        nullable=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns('holdings')]

    if 'is_dividend_manual' in columns:
        op.drop_column('holdings', 'is_dividend_manual')
