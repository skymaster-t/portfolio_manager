"""add_accounts_and_transaction_link

Revision ID: f5e6f741f047
Revises: 8de3e1499627
Create Date: 2026-02-18 00:04:27.764397

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5e6f741f047'
down_revision: Union[str, Sequence[str], None] = '8de3e1499627'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Create accounts table
    op.create_table(
        'accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_accounts_id'), 'accounts', ['id'], unique=False)

    # Add account_id to transactions
    op.add_column('transactions', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'transactions', 'accounts', ['account_id'], ['id'])

    # Seed default accounts for user_id=1 (optional, but recommended)
    op.execute("""
        INSERT INTO accounts (user_id, name, type) VALUES
        (1, 'Checking', 'checking'),
        (1, 'Savings', 'savings'),
        (1, 'Credit Card', 'credit_card'),
        (1, 'Margin Account', 'margin')
    """)

def downgrade():
    op.drop_constraint(None, 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'account_id')
    op.drop_index(op.f('ix_accounts_id'), table_name='accounts')
    op.drop_table('accounts')
