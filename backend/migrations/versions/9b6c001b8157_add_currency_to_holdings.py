"""add currency to holdings

Revision ID: 9b6c001b8157
Revises: 9a50ee91a6dc
Create Date: 2026-02-02 23:46:25.292952

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9b6c001b8157'
down_revision: Union[str, Sequence[str], None] = '9a50ee91a6dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Define the enum explicitly for PostgreSQL
currency_enum = postgresql.ENUM('CAD', 'USD', name='currency', create_type=False)

def upgrade():
    # Step 1: Create the enum type (safe – fails silently if exists, but we use checkfirst)
    currency_enum.create(op.get_bind(), checkfirst=True)
    
    # Step 2: Add the column – non-nullable with default USD
    op.add_column(
        'holdings',
        sa.Column(
            'currency',
            currency_enum,
            nullable=False,
            server_default='USD'
        )
    )
    
    # Step 3: Backfill existing rows based on symbol (.TO = CAD)
    op.execute("""
        UPDATE holdings
        SET currency = 'CAD'
        WHERE UPPER(symbol) LIKE '%.TO'
    """)
    
    # Step 4: Ensure no NULLs remain (safety net)
    op.execute("""
        UPDATE holdings
        SET currency = 'USD'
        WHERE currency IS NULL
    """)

def downgrade():
    # Step 1: Drop the column
    op.drop_column('holdings', 'currency')
    
    # Step 2: Drop the enum type (safe if other columns use it – but we control the schema)
    op.execute("DROP TYPE IF EXISTS currency")