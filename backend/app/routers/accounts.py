# backend/app/routers/accounts.py (NEW – full CRUD for accounts)
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Account
from app.schemas import AccountCreate, AccountResponse
from typing import List

router = APIRouter(prefix="/accounts", tags=["accounts"])

USER_ID = 1  # Hardcoded until auth

@router.get("/", response_model=List[AccountResponse])
def get_accounts(db: Session = Depends(get_db)):
    return db.query(Account).filter(Account.user_id == USER_ID).all()

@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(account: AccountCreate, db: Session = Depends(get_db)):
    existing = db.query(Account).filter(
        Account.user_id == USER_ID,
        Account.name.ilike(account.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Account name must be unique")

    new_account = Account(
        user_id=USER_ID,
        name=account.name,
        type=account.type
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return new_account

@router.put("/{account_id}", response_model=AccountResponse)
def update_account(account_id: int, update: AccountCreate, db: Session = Depends(get_db)):
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == USER_ID
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if update.name != account.name:
        existing = db.query(Account).filter(
            Account.user_id == USER_ID,
            Account.name.ilike(update.name),
            Account.id != account_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Account name must be unique")

    account.name = update.name
    account.type = update.type

    db.commit()
    db.refresh(account)
    return account

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == USER_ID
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Set transactions' account_id to NULL (cascade nullify)
    db.execute(
        sa.text("UPDATE transactions SET account_id = NULL WHERE account_id = :account_id"),
        {"account_id": account_id}
    )

    db.delete(account)
    db.commit()
    return None