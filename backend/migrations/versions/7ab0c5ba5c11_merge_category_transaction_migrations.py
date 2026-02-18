"""merge category/transaction migrations

Revision ID: 7ab0c5ba5c11
Revises: 14022d4cc24d, 2025d0a8c587
Create Date: 2026-02-15 13:28:27.168095

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7ab0c5ba5c11'
down_revision: Union[str, Sequence[str], None] = ('14022d4cc24d', '2025d0a8c587')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
