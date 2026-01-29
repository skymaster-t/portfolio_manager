# backend/app/routers/holdings.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Holding, UnderlyingHolding, Portfolio
from app.schemas import HoldingCreate, HoldingUpdate, HoldingResponse
from app.utils.fmp import fetch_price_data
from typing import List

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
    
    current_price = price_data.get("price")
    if current_price is None:
        raise HTTPException(status_code=400, detail="No price data available from FMP")

    # All-time calculations (from purchase to current)
    all_time_change_percent = ((current_price - holding_data.purchase_price) / holding_data.purchase_price) * 100 if holding_data.purchase_price != 0 else None
    all_time_gain_loss = (current_price - holding_data.purchase_price) * holding_data.quantity

    new_holding = Holding(
        symbol=holding_data.symbol.upper(),
        type=holding_data.type,
        quantity=holding_data.quantity,
        purchase_price=holding_data.purchase_price,
        current_price=current_price,
        all_time_change_percent=all_time_change_percent,
        market_value=current_price * holding_data.quantity,
        all_time_gain_loss=all_time_gain_loss,           
        daily_change=price_data.get("change"),            
        daily_change_percent=price_data.get("change_percent"),  
        portfolio_id=portfolio.id
    )
    db.add(new_holding)
    db.commit()
    db.refresh(new_holding)

    if holding_data.type == "etf" and holding_data.underlyings:
        for u in holding_data.underlyings:
            underlying = UnderlyingHolding(symbol=u.symbol.upper(), holding_id=new_holding.id)
            db.add(underlying)
        db.commit()

    return new_holding

@router.put("/{holding_id}", response_model=HoldingResponse)
def update_holding(holding_id: int, holding_data: HoldingUpdate, db: Session = Depends(get_db)):
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    update_dict = holding_data.dict(exclude_unset=True)

    for key, value in update_dict.items():
        if key != "underlyings":
            setattr(holding, key, value)

    # Refetch price to keep current
    price_data = fetch_price_data(holding.symbol)
    current_price = price_data.get("price")
    if current_price is None:
        raise HTTPException(status_code=400, detail="No price data available from FMP")

    # All-time calculations (from purchase to current)
    all_time_change_percent = ((current_price - holding.purchase_price) / holding.purchase_price) * 100 if holding.purchase_price != 0 else None
    all_time_gain_loss = (current_price - holding.purchase_price) * holding.quantity

    holding.current_price = current_price
    holding.all_time_change_percent = all_time_change_percent 
    holding.market_value = current_price * holding.quantity
    holding.all_time_gain_loss = all_time_gain_loss          
    holding.daily_change = price_data.get("change")          
    holding.daily_change_percent = price_data.get("change_percent") 

    # Handle underlyings if ETF
    if holding.type == "etf":
        if "underlyings" in update_dict:
            db.query(UnderlyingHolding).filter(UnderlyingHolding.holding_id == holding.id).delete()
            for u in (holding_data.underlyings or []):
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
    
    db.query(UnderlyingHolding).filter(UnderlyingHolding.holding_id == holding_id).delete()
    db.delete(holding)
    db.commit()
    return None
