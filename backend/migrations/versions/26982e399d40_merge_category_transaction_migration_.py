"""merge category/transaction migration branches

Revision ID: 26982e399d40
Revises: 161a49d3abe6, dd806bd5a64b
Create Date: 2026-02-15 16:59:49.580617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '26982e399d40'
down_revision: Union[str, Sequence[str], None] = ('161a49d3abe6', 'dd806bd5a64b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
