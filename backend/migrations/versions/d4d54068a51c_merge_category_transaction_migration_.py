"""merge category/transaction migration branches

Revision ID: d4d54068a51c
Revises: 7169ccd964f4, f30249e71447
Create Date: 2026-02-15 17:14:24.658689

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4d54068a51c'
down_revision: Union[str, Sequence[str], None] = ('7169ccd964f4', 'f30249e71447')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
