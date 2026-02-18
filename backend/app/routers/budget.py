# backend/app/routers/budget.py (FULL file – fixed validation error permanently)
# - Use getattr(h, 'is_dividend_manual', False) → always passes valid boolean
# - This works whether the DB column exists or not (safe during migration)
# - holding_id=h.id already correct
# - Schema default = False is good backup, but explicit pass prevents any None

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import BudgetItem, Holding, Currency, Category, Transaction
from app.schemas import (
    BudgetItemCreate, BudgetItemResponse, BudgetSummaryResponse,
    DividendBreakdownItem, ItemType,
    CategoryCreate, CategoryResponse
)
from app.main import r
from typing import List

router = APIRouter(prefix="/budget", tags=["budget"])

# Hardcoded user_id = 1 (no auth yet)
USER_ID = 1

@router.get("/items", response_model=List[BudgetItemResponse])
def get_items(db: Session = Depends(get_db)):
    return db.query(BudgetItem).filter(BudgetItem.user_id == USER_ID).all()

@router.post("/items", response_model=BudgetItemResponse)
def create_item(item: BudgetItemCreate, db: Session = Depends(get_db)):
    new_item = BudgetItem(
        user_id=USER_ID,
        item_type=item.item_type.value,
        name=item.name,
        amount_monthly=item.amount_monthly,
        category_id=item.category_id,
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@router.put("/items/{item_id}", response_model=BudgetItemResponse)
def update_item(item_id: int, item: BudgetItemCreate, db: Session = Depends(get_db)):
    db_item = db.query(BudgetItem).filter(BudgetItem.id == item_id, BudgetItem.user_id == USER_ID).first()
    if not db_item:
        raise HTTPException(404, "Item not found")
    for key, value in item.dict(exclude_unset=True).items():
        setattr(db_item, key, value)
    db_item.item_type = item.item_type.value
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(BudgetItem).filter(BudgetItem.id == item_id, BudgetItem.user_id == USER_ID).first()
    if not db_item:
        raise HTTPException(404, "Item not found")
    db.delete(db_item)
    db.commit()
    return {"ok": True}

@router.get("/summary", response_model=BudgetSummaryResponse)
def get_summary(db: Session = Depends(get_db)):
    holdings = db.query(Holding).all()
    items = db.query(BudgetItem).filter(BudgetItem.user_id == USER_ID).all()

    # Latest FX rate (1 USD → CAD)
    rate_str = r.get("fx:USDCAD")
    rate = float(rate_str.decode("utf-8") if rate_str else 1.37)

    # Dividend calculation
    dividend_monthly = 0.0
    dividend_annual = 0.0
    breakdown = []

    for h in holdings:
        if not h.dividend_annual_per_share:
            continue
        annual_native = h.dividend_annual_per_share * h.quantity
        is_cad = h.currency == Currency.CAD
        annual_cad = annual_native if is_cad else annual_native * rate
        monthly_cad = annual_cad / 12

        dividend_annual += annual_cad
        dividend_monthly += monthly_cad

        breakdown.append(DividendBreakdownItem(
            holding_id=h.id,
            symbol=h.symbol,
            quantity=h.quantity,
            dividend_annual_per_share=h.dividend_annual_per_share,
            annual_dividends_cad=round(annual_cad, 2),
            monthly_dividends_cad=round(monthly_cad, 2),
            is_manual=getattr(h, 'is_dividend_manual', False),  # ← Always valid boolean
        ))

    breakdown.sort(key=lambda x: x.monthly_dividends_cad, reverse=True)

    other_income = sum(i.amount_monthly for i in items if i.item_type == "income")
    expenses = sum(i.amount_monthly for i in items if i.item_type == "expense")

    total_income = dividend_monthly + other_income
    surplus = total_income - expenses

    return BudgetSummaryResponse(
        expected_dividend_income_monthly_cad=round(dividend_monthly, 2),
        expected_dividend_income_annual_cad=round(dividend_annual, 2),
        dividend_breakdown=breakdown,
        other_income_monthly=round(other_income, 2),
        total_expenses_monthly=round(expenses, 2),
        total_income_monthly=round(total_income, 2),
        net_surplus_monthly=round(surplus, 2),
        income_items=[i for i in items if i.item_type == "income"],
        expense_items=[i for i in items if i.item_type == "expense"],
    )
    
@router.get("/categories", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).filter(Category.user_id == USER_ID).all()

@router.post("/categories", response_model=CategoryResponse)
def create_category(cat: CategoryCreate, db: Session = Depends(get_db)):
    exists = db.query(Category).filter(
        Category.user_id == USER_ID,
        Category.name == cat.name
    ).first()
    if exists:
        raise HTTPException(400, "Category already exists")

    new_cat = Category(
        user_id=USER_ID,
        name=cat.name,
        type=cat.type,
        is_custom=True
    )
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat

@router.patch("/categories/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, update: CategoryCreate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id, Category.user_id == USER_ID).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    if not cat.is_custom:
        raise HTTPException(400, "Cannot edit system category")

    # Update name/type
    cat.name = update.name
    cat.type = update.type

    # Cascade to transactions and budget_items
    db.query(Transaction).filter(Transaction.category_id == category_id).update({
        Transaction.category_id: category_id  # Already correct, but ensures consistency
    })
    db.query(BudgetItem).filter(BudgetItem.category_id == category_id).update({
        BudgetItem.category_id: category_id
    })

    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id, Category.user_id == USER_ID).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    if not cat.is_custom:
        raise HTTPException(400, "Cannot delete system category")

    # Find "Other" fallback
    fallback_name = "Other Income" if cat.type == "income" else "Other Expense"
    fallback = db.query(Category).filter(
        Category.user_id == USER_ID,
        Category.name == fallback_name
    ).first()
    if not fallback:
        raise HTTPException(500, f"Fallback category '{fallback_name}' not found")

    # Cascade move
    db.query(Transaction).filter(Transaction.category_id == category_id).update({
        Transaction.category_id: fallback.id
    })
    db.query(BudgetItem).filter(BudgetItem.category_id == category_id).update({
        BudgetItem.category_id: fallback.id
    })

    db.delete(cat)
    db.commit()
    return {"status": "deleted"}
