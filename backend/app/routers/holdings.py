# backend/app/routers/holdings.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Holding, UnderlyingHolding, Portfolio
from app.schemas import HoldingCreate, HoldingUpdate, HoldingResponse
import requests
import os
from typing import List
from app.utils.fmp import fetch_price_data

router = APIRouter(prefix="/holdings", tags=["holdings"])

def get_default_portfolio(db: Session):
    portfolio = db.query(Portfolio).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Default portfolio not found")
    return portfolio

@router.get("/", response_model=List[HoldingResponse])
def get_holdings(db: Session = Depends(get_db)):
    portfolio = get_default_portfolio(db)
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio.id).all()
    return holdings

@router.get("/{holding_id}", response_model=HoldingResponse)
def get_holding(holding_id: int, db: Session = Depends(get_db)):
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    return holding

@router.post("/", response_model=HoldingResponse, status_code=status.HTTP_201_CREATED)
def create_holding(holding_data: HoldingCreate, db: Session = Depends(get_db)):
    portfolio = get_default_portfolio(db)
    
    price_data = fetch_price_data(holding_data.symbol)
    
    new_holding = Holding(
        symbol=holding_data.symbol.upper(),
        type=holding_data.type,
        quantity=holding_data.quantity,
        purchase_price=holding_data.purchase_price,
        current_price=price_data["price"],
        change_percent=price_data["change_percent"],
        market_value=price_data["price"] * holding_data.quantity if price_data["price"] else None,
        gain_loss=(price_data["price"] - holding_data.purchase_price) * holding_data.quantity if price_data["price"] else None,
        portfolio_id=portfolio.id
    )
    db.add(new_holding)
    db.commit()
    db.refresh(new_holding)

    if holding_data.type == "etf" and holding_data.underlyings:
        for u in holding_data.underlyings:
            underlying = UnderlyingHolding(symbol=u.symbol.upper(), holding_id=new_holding.id)
            db.add(underlying)  # Fixed: Removed accidental "maple" typo
        db.commit()

    return new_holding

@router.put("/{holding_id}", response_model=HoldingResponse)
def update_holding(holding_id: int, holding_data: HoldingUpdate, db: Session = Depends(get_db)):
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    update_dict = holding_data.dict(exclude_unset=True)
    symbol_changed = "symbol" in update_dict and update_dict["symbol"] != holding.symbol

    for key, value in update_dict.items():
        if key != "underlyings":
            setattr(holding, key, value)

    # Refetch price if symbol changed or always (to keep current)
    price_data = fetch_price_data(holding.symbol)
    holding.current_price = price_data["price"]
    holding.change_percent = price_data["change_percent"]
    holding.market_value = price_data["price"] * holding.quantity if price_data["price"] else None
    holding.gain_loss = (price_data["price"] - holding.purchase_price) * holding.quantity if price_data["price"] else None

    # Handle underlyings (delete old, add new if ETF)
    if holding.type == "etf":
        if "underlyings" in update_dict:
            # Delete existing
            db.query(UnderlyingHolding).filter(UnderlyingHolding.holding_id == holding.id).delete()
            # Add new
            for u in holding_data.underlyings or []:
                underlying = UnderlyingHolding(symbol=u.symbol.upper(), holding_id=holding.id)
                db.add(underlying)

    db.commit()
    db.refresh(holding)
    return holding

@router.delete("/{holding_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_holding(holding_id: int, db: Session = Depends(get_db)):
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    
    # Delete underlyings first
    db.query(UnderlyingHolding).filter(UnderlyingHolding.holding_id == holding_id).delete()
    db.delete(holding)
    db.commit()
    return None