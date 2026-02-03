# backend/app/routers/holdings.py (full file – fixed NameError by importing Currency)
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Holding, UnderlyingHolding, Portfolio, HoldingType, Currency  # NEW: import Currency
from app.schemas import HoldingCreate, HoldingUpdate, HoldingResponse, UnderlyingDetail
from app.utils.yahoo import batch_fetch_prices, get_cached_price
from typing import List, Dict, Optional
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/holdings", tags=["holdings"])

STALE_THRESHOLD = timedelta(minutes=10)

def detect_currency(symbol: str) -> Currency:
    """Detect currency from symbol – .TO suffix = CAD, else USD"""
    return Currency.CAD if symbol.upper().endswith('.TO') else Currency.USD

def update_holding_prices(db: Session, holdings: List[Holding], price_map: Dict[str, dict], now: datetime) -> int:
    updated = 0
    for holding in holdings:
        data = price_map.get(holding.symbol, {})
        price = data.get("price")
        if price is not None:
            old_price = holding.current_price
            holding.current_price = price
            holding.daily_change = data.get("change")
            holding.daily_change_percent = data.get("change_percent")
            holding.market_value = price * holding.quantity
            holding.all_time_gain_loss = (price - holding.purchase_price) * holding.quantity
            holding.all_time_change_percent = (
                (price - holding.purchase_price) / holding.purchase_price * 100
                if holding.purchase_price != 0 else None
            )
            holding.last_price_update = now
            updated += 1
            logger.info(f"DB UPDATED (opportunistic/forced) {holding.symbol}: {old_price} → {price}")
    if updated > 0:
        db.commit()
    return updated

def recalc_derived(holding: Holding):
    if holding.current_price is not None:
        holding.market_value = holding.current_price * holding.quantity
        holding.all_time_gain_loss = (holding.current_price - holding.purchase_price) * holding.quantity
        holding.all_time_change_percent = (
            (holding.current_price - holding.purchase_price) / holding.purchase_price * 100
            if holding.purchase_price != 0 else None
        )

def enrich_underlyings(holding: Holding, price_map: Optional[Dict[str, dict]] = None):
    if holding.type == HoldingType.etf:
        holding.underlying_details = []
        for u in holding.underlyings:
            cached = get_cached_price(u.symbol)
            data = cached or (price_map.get(u.symbol, {}) if price_map else {})
            holding.underlying_details.append(UnderlyingDetail(
                symbol=u.symbol,
                allocation_percent=u.allocation_percent,
                current_price=data.get("price"),
                daily_change=data.get("change"),
                daily_change_percent=data.get("change_percent"),
            ))

@router.get("/", response_model=List[HoldingResponse])
def get_holdings(db: Session = Depends(get_db)):
    holdings = db.query(Holding).options(joinedload(Holding.underlyings)).all()
    
    now = datetime.utcnow()
    symbols = [h.symbol for h in holdings]
    price_map = batch_fetch_prices(symbols)
    
    update_holding_prices(db, holdings, price_map, now)
    
    for holding in holdings:
        enrich_underlyings(holding, price_map)
    
    return holdings

@router.post("/", response_model=HoldingResponse, status_code=status.HTTP_201_CREATED)
def create_holding(holding_data: HoldingCreate, db: Session = Depends(get_db)):
    # Auto-detect currency
    detected_currency = detect_currency(holding_data.symbol)
    
    new_holding = Holding(
        symbol=holding_data.symbol.upper(),
        type=holding_data.type,
        quantity=holding_data.quantity,
        purchase_price=holding_data.purchase_price,
        portfolio_id=holding_data.portfolio_id,
        currency=detected_currency,  # NEW: persist detected currency
    )
    db.add(new_holding)
    db.commit()
    db.refresh(new_holding)

    # Fetch price for new holding
    price_map = batch_fetch_prices([new_holding.symbol])
    main_data = price_map.get(new_holding.symbol, {})
    current_price = main_data.get("price")
    if current_price is None:
        raise HTTPException(status_code=400, detail="No price data available from Yahoo Finance")

    new_holding.current_price = current_price
    new_holding.daily_change = main_data.get("change")
    new_holding.daily_change_percent = main_data.get("change_percent")
    recalc_derived(new_holding)
    new_holding.last_price_update = datetime.utcnow()

    # Underlyings
    if holding_data.underlyings:
        for u in holding_data.underlyings:
            underlying = UnderlyingHolding(
                symbol=u.symbol.upper(),
                allocation_percent=u.allocation_percent,
                holding_id=new_holding.id
            )
            db.add(underlying)

    db.commit()
    db.refresh(new_holding)
    enrich_underlyings(new_holding, price_map)
    return new_holding

@router.put("/{holding_id}", response_model=HoldingResponse)
def update_holding(holding_id: int, holding_data: HoldingUpdate, db: Session = Depends(get_db)):
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    update_dict = holding_data.dict(exclude_unset=True)
    incoming_type = update_dict.get("type", holding.type)

    # If symbol changes, re-detect currency
    if "symbol" in update_dict:
        update_dict["currency"] = detect_currency(update_dict["symbol"])

    for key, value in update_dict.items():
        if key not in ["underlyings", "portfolio_id"]:
            setattr(holding, key, value)

    if "portfolio_id" in update_dict:
        portfolio = db.query(Portfolio).filter(Portfolio.id == holding_data.portfolio_id).first()
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        holding.portfolio_id = portfolio.id

    price_map = batch_fetch_prices([holding.symbol])
    main_data = price_map.get(holding.symbol, {})
    current_price = main_data.get("price")
    if current_price is None:
        raise HTTPException(status_code=400, detail="No price data available from Yahoo Finance")

    holding.current_price = current_price
    holding.daily_change = main_data.get("change")
    holding.daily_change_percent = main_data.get("change_percent")
    recalc_derived(holding)
    holding.last_price_update = datetime.utcnow()

    if "underlyings" in update_dict:
        db.query(UnderlyingHolding).filter(UnderlyingHolding.holding_id == holding.id).delete()
        for u in (holding_data.underlyings or []):
            underlying = UnderlyingHolding(
                symbol=u.symbol.upper(),
                allocation_percent=u.allocation_percent,
                holding_id=holding.id
            )
            db.add(underlying)
    elif incoming_type == HoldingType.stock:
        db.query(UnderlyingHolding).filter(UnderlyingHolding.holding_id == holding.id).delete()

    db.commit()
    db.refresh(holding)
    enrich_underlyings(holding, price_map)
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