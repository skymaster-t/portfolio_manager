"""add categories/transactions idempotent final

Revision ID: 14022d4cc24d
Revises: 34f4a6c98954
Create Date: 2026-02-15 13:20:52.787032

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision: str = '14022d4cc24d'
down_revision: Union[str, Sequence[str], None] = '34f4a6c98954'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # 1. Categories table – create if missing
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

        # Seed defaults only if table empty
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
                SELECT 1, :name, :type, false
                WHERE NOT EXISTS (
                    SELECT 1 FROM categories WHERE name = :name AND user_id = 1
                )
            """).bindparams(name=name, type=cat_type))

    # 2. category_id column in budget_items – add if missing
    columns = [col['name'] for col in inspector.get_columns('budget_items')]
    if 'category_id' not in columns:
        op.add_column('budget_items',
            sa.Column('category_id', sa.Integer(), nullable=True)
        )

    # 3. Migrate data (safe – runs every time but only affects NULLs)
    op.execute("""
        UPDATE budget_items 
        SET category_id = (
            SELECT id FROM categories 
            WHERE categories.name = budget_items.category 
              AND categories.user_id = budget_items.user_id
        )
        WHERE category_id IS NULL
    """)

    # 4. Fallback for unmatched
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

    # 5. Make non-nullable + add FK if missing
    op.alter_column('budget_items', 'category_id',
                    existing_type=sa.Integer(),
                    nullable=False)

    fk_name = 'budget_items_category_id_fkey'
    if not any(fk['name'] == fk_name for fk in inspector.get_foreign_keys('budget_items')):
        op.create_foreign_key(
            fk_name,
            'budget_items', 'categories',
            ['category_id'], ['id']
        )

    # 6. Transactions table – create if missing
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

    fk_name = 'budget_items_category_id_fkey'
    if any(fk['name'] == fk_name for fk in inspector.get_foreign_keys('budget_items')):
        op.drop_constraint(fk_name, 'budget_items', type_='foreignkey')

    columns = [col['name'] for col in inspector.get_columns('budget_items')]
    if 'category_id' in columns:
        op.drop_column('budget_items', 'category_id')

    if inspector.has_table('categories'):
        op.drop_table('categories')