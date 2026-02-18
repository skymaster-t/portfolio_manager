"""add categories and transactions tables + migrate budget_item category

Revision ID: 427e6839d0e4
Revises: 77c5bf0d6d54
Create Date: 2026-02-15 13:13:20.624198

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '427e6839d0e4'
down_revision: Union[str, Sequence[str], None] = '77c5bf0d6d54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Create categories table first
    op.create_table('categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('is_custom', sa.Boolean(), server_default='false', nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'])
    )

    # 2. Seed default categories (auto-increment starts at 1)
    op.execute("""
        INSERT INTO categories (user_id, name, type, is_custom) VALUES
        (1, 'Salary', 'income', false),
        (1, 'Bonus', 'income', false),
        (1, 'Freelance', 'income', false),
        (1, 'Rental', 'income', false),
        (1, 'Investment', 'income', false),
        (1, 'Pension', 'income', false),
        (1, 'Other Income', 'income', false),
        (1, 'Rent/Mortgage', 'expense', false),
        (1, 'Utilities', 'expense', false),
        (1, 'Groceries', 'expense', false),
        (1, 'Dining', 'expense', false),
        (1, 'Transportation', 'expense', false),
        (1, 'Insurance', 'expense', false),
        (1, 'Healthcare', 'expense', false),
        (1, 'Entertainment', 'expense', false),
        (1, 'Debt Payment', 'expense', false),
        (1, 'Savings', 'expense', false),
        (1, 'Other Expense', 'expense', false)
    """)

    # 3. Add category_id to budget_items (allow NULL temporarily)
    op.add_column('budget_items',
        sa.Column('category_id', sa.Integer(), nullable=True)
    )

    # 4. Migrate existing string category to new category_id
    # Match by name (case-sensitive – adjust if needed)
    op.execute("""
        UPDATE budget_items 
        SET category_id = (
            SELECT id FROM categories 
            WHERE categories.name = budget_items.category 
              AND categories.user_id = budget_items.user_id
        )
    """)

    # 5. Set default for uncategorized (use "Other Income"/"Other Expense" as fallback)
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

    # 6. Now make non-nullable and add FK
    op.alter_column('budget_items', 'category_id',
                    existing_type=sa.Integer(),
                    nullable=False)

    op.create_foreign_key(
        'budget_items_category_id_fkey',
        'budget_items', 'categories',
        ['category_id'], ['id']
    )

    # 7. Create transactions table (after categories)
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
    op.drop_table('transactions')
    op.drop_constraint('budget_items_category_id_fkey', 'budget_items', type_='foreignkey')
    op.drop_column('budget_items', 'category_id')
    op.drop_table('categories')