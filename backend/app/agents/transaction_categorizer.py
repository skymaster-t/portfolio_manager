import os
import requests
import json
from typing import List
from app.models import Transaction, Category
from sqlalchemy.orm import Session

XAI_API_KEY = os.getenv("XAI_API_KEY")
if not XAI_API_KEY:
    raise ValueError("XAI_API_KEY is required in .env")

XAI_URL = "https://api.x.ai/v1/chat/completions"
XAI_MODEL = "grok-4-1-fast-reasoning" 

def categorize_transactions(transactions: List[dict], user_id: int, db: Session):
    # Load all valid categories from DB
    categories = db.query(Category).filter(Category.user_id == user_id).all()
    category_names = [c.name for c in categories]
    category_map = {c.name.lower(): c.id for c in categories}

    # Determine fallback IDs
    income_fallback = "Other Income"
    expense_fallback = "Other Expenses"
    fallback_income_id = next((c.id for c in categories if c.name == income_fallback), None)
    fallback_expense_id = next((c.id for c in categories if c.name == expense_fallback), None)
    if fallback_expense_id is None:
        fallback_expense_id = categories[0].id if categories else 1
    if fallback_income_id is None:
        fallback_income_id = fallback_expense_id  # last resort

    # Few-shot examples from manual overrides (limit to 5 recent)
    manual_examples = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.is_manual_override == True
    ).order_by(Transaction.date.desc()).limit(5).all()

    examples_str = "\n".join([
        f"Description: {t.description}\nCategory: {t.category.name if t.category else 'Unknown'}"
        for t in manual_examples if t.category
    ]) if manual_examples else "No manual examples available."

    # Very strict prompt – forbids inventing categories
    prompt = f"""
You are a strict financial transaction categorizer.

Available categories (use ONLY these exact names - do NOT create new ones):
{', '.join(category_names)}

Rules:
1. Choose the MOST appropriate category from the list above. Do NOT invent new categories.
2. If no good match, use "{expense_fallback}" for expenses (negative amount) or "{income_fallback}" for income (positive amount).
3. Base categorization on merchant name, description keywords, and transaction amount sign.
4. Common patterns:
   - Grocery stores → Groceries
   - Restaurants → Dining / Restaurants
   - Utilities → Utilities
   - Salary / Pay → Salary
   - Rent / Mortgage → Rent / Mortgage
   - Transfers → Transfer (if exists) or Other Income/Expense
5. Past manual overrides from user (follow these patterns when similar):
{examples_str}

Transactions (format: amount | description):
""" + "\n".join([f"{t['amount']} | {t['description']}" for t in transactions]) + """

Output ONLY a JSON array of exact category names from the list above (one per transaction, in order).
Example output:
["Groceries", "Salary", "Other Expenses", "Utilities"]

Do NOT explain. Do NOT add extra text. ONLY the JSON array.
"""

    try:
        response = requests.post(
            XAI_URL,
            headers={
                "Authorization": f"Bearer {XAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": XAI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.0,  # ← low temperature for strict adherence
                "max_tokens": 500
            },
            timeout=30
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"].strip()

        # Extract just the array if wrapped in extra text
        if content.startswith("```json"):
            content = content.split("```json")[1].split("```")[0].strip()
        category_names = json.loads(content)

        if not isinstance(category_names, list) or len(category_names) != len(transactions):
            raise ValueError("Invalid category list length")

    except Exception as e:
        print(f"Error calling xAI API: {e}")
        # Emergency fallback
        category_names = [
            expense_fallback if t['amount'] < 0 else income_fallback
            for t in transactions
        ]

    # Map to category IDs
    for t, cat_name in zip(transactions, category_names):
        cat_lower = str(cat_name).strip().lower()
        t['category_id'] = category_map.get(cat_lower, fallback_expense_id if t['amount'] < 0 else fallback_income_id)

    return transactions