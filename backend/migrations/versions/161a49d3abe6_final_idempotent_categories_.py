"""final idempotent categories/transactions + budget migration

Revision ID: 161a49d3abe6
Revises: 77c5bf0d6d54
Create Date: 2026-02-15 16:57:10.141410

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision: str = '161a49d3abe6'
down_revision: Union[str, Sequence[str], None] = '77c5bf0d6d54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # 1. Categories table – create only if missing
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

        # Seed defaults (PostgreSQL ON CONFLICT safe)
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
            op.execute(text("""
                INSERT INTO categories (user_id, name, type, is_custom)
                VALUES (1, :name, :type, false)
                ON CONFLICT (user_id, name) DO NOTHING
            """).bindparams(name=name, type=cat_type))

    # 2. category_id in budget_items – add if missing
    budget_columns = [col['name'] for col in inspector.get_columns('budget_items')]
    if 'category_id' not in budget_columns:
        op.add_column('budget_items',
            sa.Column('category_id', sa.Integer(), nullable=True)
        )

    # 3. Migrate string category to category_id (only NULLs)
    op.execute("""
        UPDATE budget_items 
        SET category_id = (
            SELECT id FROM categories 
            WHERE categories.name = budget_items.category 
              AND categories.user_id = budget_items.user_id
        )
        WHERE category_id IS NULL
    """)

    # 4. Fallback unmatched
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

    # 5. Make non-nullable
    op.alter_column('budget_items', 'category_id',
                    existing_type=sa.Integer(),
                    nullable=False)

    # 6. Add FK if missing
    fks = inspector.get_foreign_keys('budget_items')
    if not any(fk['name'] == 'budget_items_category_id_fkey' for fk in fks):
        op.create_foreign_key(
            'budget_items_category_id_fkey',
            'budget_items', 'categories',
            ['category_id'], ['id']
        )

    # 7. Transactions table – create if missing
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

    fks = inspector.get_foreign_keys('budget_items')
    if any(fk['name'] == 'budget_items_category_id_fkey' for fk in fks):
        op.drop_constraint('budget_items_category_id_fkey', 'budget_items', type_='foreignkey')

    budget_columns = [col['name'] for col in inspector.get_columns('budget_items')]
    if 'category_id' in budget_columns:
        op.drop_column('budget_items', 'category_id')

    if inspector.has_table('categories'):
        op.drop_table('categories')
        