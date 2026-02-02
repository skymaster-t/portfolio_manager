# backend/app/routers/holdings.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Holding, UnderlyingHolding, Portfolio, HoldingType
from app.schemas import HoldingCreate, HoldingUpdate, HoldingResponse, UnderlyingDetail
from app.utils.yahoo import batch_fetch_prices, get_cached_price
from typing import List, Dict, Optional
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/holdings", tags=["holdings"])

STALE_THRESHOLD = timedelta(minutes=10)

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
def get_holdings(
    db: Session = Depends(get_db),
    force_refresh: Optional[bool] = Query(False, alias="force")
):
    logger.info("Received request to GET /holdings")
    holdings = db.query(Holding).options(joinedload(Holding.underlyings)).all()
    if not holdings:
        return []

    now = datetime.utcnow()
    needs_fresh = any(
        h.last_price_update is None or (now - h.last_price_update) > STALE_THRESHOLD
        for h in holdings
    )

    if force_refresh:
        needs_fresh = True
        logger.info("FORCED price refresh requested via query param")

    price_map = {}
    if needs_fresh:
        main_symbols = [h.symbol for h in holdings]
        underlying_symbols = [u.symbol for h in holdings if h.type == HoldingType.etf for u in h.underlyings]
        all_symbols = list(set(main_symbols + underlying_symbols))
        logger.info(f"API /holdings: {'Forced' if force_refresh else 'Data stale'} → fetching fresh Yahoo prices for {len(all_symbols)} symbols")
        price_map = batch_fetch_prices(all_symbols)
        update_holding_prices(db, holdings, price_map, now)

    for holding in holdings:
        recalc_derived(holding)
        enrich_underlyings(holding, price_map if needs_fresh else None)

    logger.info(f"API /holdings: Served {len(holdings)} holdings (fresh_fetch={'yes' if needs_fresh else 'no'}, forced={force_refresh})")
    return holdings

@router.get("/{holding_id}", response_model=HoldingResponse)
def get_holding(holding_id: int, db: Session = Depends(get_db)):
    logger.info(f"Received request to GET /holdings/{holding_id}")
    holding = db.query(Holding).options(joinedload(Holding.underlyings)).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    now = datetime.utcnow()
    needs_fresh = holding.last_price_update is None or (now - holding.last_price_update) > STALE_THRESHOLD

    price_map = {}
    if needs_fresh:
        underlying_symbols = [u.symbol for u in holding.underlyings] if holding.type == HoldingType.etf else []
        all_symbols = [holding.symbol] + underlying_symbols
        logger.info(f"API /holding/{holding_id}: Stale → fetching fresh for {len(all_symbols)} symbols")
        price_map = batch_fetch_prices(all_symbols)
        update_holding_prices(db, [holding], price_map, now)

    recalc_derived(holding)
    enrich_underlyings(holding, price_map if needs_fresh else None)

    return holding

@router.post("/", response_model=HoldingResponse, status_code=status.HTTP_201_CREATED)
def create_holding(holding_data: HoldingCreate, db: Session = Depends(get_db)):
    logger.info(f"Creating holding: {holding_data.dict()}")
    logger.info(f"Received underlyings for create: {[u.dict() for u in holding_data.underlyings]}")

    portfolio = db.query(Portfolio).filter(Portfolio.id == holding_data.portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    price_map = batch_fetch_prices([holding_data.symbol])
    main_data = price_map.get(holding_data.symbol, {})
    current_price = main_data.get("price")
    if current_price is None:
        raise HTTPException(status_code=400, detail="No price data available from Yahoo Finance")

    all_time_change_percent = (
        (current_price - holding_data.purchase_price) / holding_data.purchase_price * 100
        if holding_data.purchase_price != 0 else None
    )
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
        daily_change=main_data.get("change"),
        daily_change_percent=main_data.get("change_percent"),
        portfolio_id=portfolio.id,
        last_price_update=datetime.utcnow()
    )
    db.add(new_holding)
    db.commit()
    db.refresh(new_holding)

    if holding_data.type == HoldingType.etf and holding_data.underlyings:
        for u in holding_data.underlyings:
            logger.info(f"Adding underlying symbol={u.symbol.upper()} allocation_percent={u.allocation_percent}")
            underlying = UnderlyingHolding(
                symbol=u.symbol.upper(),
                allocation_percent=u.allocation_percent,
                holding_id=new_holding.id
            )
            db.add(underlying)
        db.commit()

    enrich_underlyings(new_holding, price_map)
    return new_holding

@router.put("/{holding_id}", response_model=HoldingResponse)
def update_holding(holding_id: int, holding_data: HoldingUpdate, db: Session = Depends(get_db)):
    logger.info(f"Updating holding ID {holding_id}")
    update_dict = holding_data.dict(exclude_unset=True)
    logger.info(f"Received update payload keys: {list(update_dict.keys())}")
    if "underlyings" in update_dict:
        logger.info(f"Received underlyings for update: {[u.dict() for u in (holding_data.underlyings or [])]}")

    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    # Determine if type is being changed
    incoming_type = holding_data.type if "type" in update_dict else holding.type

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
    holding.market_value = current_price * holding.quantity
    holding.all_time_gain_loss = (current_price - holding.purchase_price) * holding.quantity
    holding.all_time_change_percent = (
        (current_price - holding.purchase_price) / holding.purchase_price * 100
        if holding.purchase_price != 0 else None
    )
    holding.last_price_update = datetime.utcnow()

    # Underlyings handling – simplified and robust
    if "underlyings" in update_dict:
        logger.info(f"Replacing underlyings for holding {holding_id}")
        db.query(UnderlyingHolding).filter(UnderlyingHolding.holding_id == holding.id).delete()
        for u in (holding_data.underlyings or []):
            logger.info(f"Adding updated underlying symbol={u.symbol.upper()} allocation_percent={u.allocation_percent}")
            underlying = UnderlyingHolding(
                symbol=u.symbol.upper(),
                allocation_percent=u.allocation_percent,
                holding_id=holding.id
            )
            db.add(underlying)
    elif incoming_type == HoldingType.stock:
        logger.info(f"Type is stock – clearing underlyings for holding {holding_id}")
        db.query(UnderlyingHolding).filter(UnderlyingHolding.holding_id == holding.id).delete()

    db.commit()

    # Re-query with fresh underlyings
    holding = db.query(Holding).options(joinedload(Holding.underlyings)).filter(Holding.id == holding_id).first()
    logger.info(f"After re-query, underlyings allocation: {[u.allocation_percent for u in holding.underlyings]}")

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