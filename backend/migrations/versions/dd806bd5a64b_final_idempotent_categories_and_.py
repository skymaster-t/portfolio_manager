"""final idempotent categories and transactions

Revision ID: dd806bd5a64b
Revises: 7ab0c5ba5c11
Create Date: 2026-02-15 13:28:39.159462

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

# revision identifiers, used by Alembic.
revision: str = 'dd806bd5a64b'
down_revision: Union[str, Sequence[str], None] = '7ab0c5ba5c11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Categories table – create only if missing
    if not inspector.has_table('categories'):
        op.create_table('categories',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('type', sa.String(), nullable=False),
            sa.Column('is_custom', sa.Boolean(), server_default='false', nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'])
        )

        # Seed defaults (idempotent)
        defaults = [
            ('Salary', 'income'), ('Bonus', 'income'), ('Freelance', 'income'),
            ('Rental', 'income'), ('Investment', 'income'), ('Pension', 'income'),
            ('Other Income', 'income'),
            ('Rent/Mortgage', 'expense'), ('Utilities', 'expense'), ('Groceries', 'expense'),
            ('Dining', 'expense'), ('Transportation', 'expense'), ('Insurance', 'expense'),
            ('Healthcare', 'expense'), ('Entertainment', 'expense'), ('Debt Payment', 'expense'),
            ('Savings', 'expense'), ('Other Expense', 'expense')
        ]
        for name, cat_type in defaults:
            op.execute(text(f"""
                INSERT INTO categories (user_id, name, type, is_custom)
                VALUES (1, :name, :type, false)
                ON CONFLICT DO NOTHING
            """).bindparams(name=name, type=cat_type))

    # category_id in budget_items – add if missing
    budget_columns = [col['name'] for col in inspector.get_columns('budget_items')]
    if 'category_id' not in budget_columns:
        op.add_column('budget_items',
            sa.Column('category_id', sa.Integer(), nullable=True)
        )

    # Migrate data
    op.execute("""
        UPDATE budget_items 
        SET category_id = (
            SELECT id FROM categories 
            WHERE categories.name = budget_items.category 
              AND categories.user_id = budget_items.user_id
        )
        WHERE category_id IS NULL
    """)

    op.execute("""
        UPDATE budget_items 
        SET category_id = (
            SELECT id FROM categories 
            WHERE categories.name = (
                CASE WHEN budget_items.item_type = 'income' THEN 'Other Income' 
                     ELSE 'Other Expense' END
            )
            AND categories.user_id = budget_items.user_id
        )
        WHERE category_id IS NULL
    """)

    # Make non-nullable + FK
    op.alter_column('budget_items', 'category_id',
                    existing_type=sa.Integer(),
                    nullable=False)

    if not any(fk['name'] == 'budget_items_category_id_fkey' for fk in inspector.get_foreign_keys('budget_items')):
        op.create_foreign_key(
            'budget_items_category_id_fkey',
            'budget_items', 'categories',
            ['category_id'], ['id']
        )

    # Transactions table – create if missing
    if not inspector.has_table('transactions'):
        op.create_table('transactions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('date', sa.DateTime(), nullable=False),
            sa.Column('description', sa.String(), nullable=False),
            sa.Column('amount', sa.Float(), nullable=False),
            sa.Column('original_description', sa.String()),
            sa.Column('category_id', sa.Integer(), nullable=False),
            sa.Column('is_manual_override', sa.Boolean(), server_default='false'),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.ForeignKeyConstraint(['category_id'], ['categories.id'])
        )

def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if inspector.has_table('transactions'):
        op.drop_table('transactions')

    if any(fk['name'] == 'budget_items_category_id_fkey' for fk in inspector.get_foreign_keys('budget_items')):
        op.drop_constraint('budget_items_category_id_fkey', 'budget_items', type_='foreignkey')

    if 'category_id' in [col['name'] for col in inspector.get_columns('budget_items')]:
        op.drop_column('budget_items', 'category_id')

    if inspector.has_table('categories'):
        op.drop_table('categories')