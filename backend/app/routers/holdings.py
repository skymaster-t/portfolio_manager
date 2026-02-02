# backend/app/routers/holdings.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Holding, UnderlyingHolding, Portfolio, HoldingType
from app.schemas import HoldingCreate, HoldingUpdate, HoldingResponse, UnderlyingDetail
from app.utils.fmp import fetch_price_data
from typing import List
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/holdings", tags=["holdings"])

@router.get("/", response_model=List[HoldingResponse])
def get_holdings(db: Session = Depends(get_db)):
    holdings = db.query(Holding).all()
    
    logger.info(f"Fetched {len(holdings)} holdings from DB")
    
    for holding in holdings:
        if holding.type.value == "etf":  # FIX: use .value for enum comparison
            logger.info(f"Processing ETF {holding.symbol} (ID: {holding.id}) with {len(holding.underlyings)} underlyings")
            holding.underlying_details = []
            for u in holding.underlyings:
                logger.info(f"Underlying: symbol={u.symbol}, allocation_percent={u.allocation_percent}")
                price_data = fetch_price_data(u.symbol)
                logger.info(f"FMP price data for {u.symbol}: {price_data}")
                holding.underlying_details.append(UnderlyingDetail(
                    symbol=u.symbol,
                    allocation_percent=u.allocation_percent,
                    current_price=price_data.get("price"),
                    daily_change=price_data.get("change"),
                    daily_change_percent=price_data.get("change_percent"),
                ))
    return holdings

@router.get("/{holding_id}", response_model=HoldingResponse)
def get_holding(holding_id: int, db: Session = Depends(get_db)):
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    
    if holding.type.value == "etf":  # FIX: use .value
        logger.info(f"Processing single ETF {holding.symbol} (ID: {holding.id}) with {len(holding.underlyings)} underlyings")
        holding.underlying_details = []
        for u in holding.underlyings:
            logger.info(f"Underlying: symbol={u.symbol}, allocation_percent={u.allocation_percent}")
            price_data = fetch_price_data(u.symbol)
            holding.underlying_details.append(UnderlyingDetail(
                symbol=u.symbol,
                allocation_percent=u.allocation_percent,
                current_price=price_data.get("price"),
                daily_change=price_data.get("change"),
                daily_change_percent=price_data.get("change_percent"),
            ))
    return holding

@router.post("/", response_model=HoldingResponse, status_code=status.HTTP_201_CREATED)
def create_holding(holding_data: HoldingCreate, db: Session = Depends(get_db)):
    logger.info(f"Creating holding: {holding_data.dict()}")
    
    portfolio = db.query(Portfolio).filter(Portfolio.id == holding_data.portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    price_data = fetch_price_data(holding_data.symbol)
    current_price = price_data.get("price")
    if current_price is None:
        raise HTTPException(status_code=400, detail="No price data available from FMP")

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

    if holding_data.type == "etf" and holding_data.underlyings:  # holding_data.type is string enum from Pydantic
        logger.info(f"Saving {len(holding_data.underlyings)} underlyings for new holding {new_holding.id}")
        for u in holding_data.underlyings:
            logger.info(f"Saving underlying: symbol={u.symbol}, allocation_percent={u.allocation_percent}")
            underlying = UnderlyingHolding(
                symbol=u.symbol.upper(),
                allocation_percent=u.allocation_percent,
                holding_id=new_holding.id
            )
            db.add(underlying)
        db.commit()

    return new_holding

@router.put("/{holding_id}", response_model=HoldingResponse)
def update_holding(holding_id: int, holding_data: HoldingUpdate, db: Session = Depends(get_db)):
    logger.info(f"Updating holding ID {holding_id} with data: {holding_data.dict(exclude_unset=True)}")
    
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    update_dict = holding_data.dict(exclude_unset=True)

    for key, value in update_dict.items():
        if key not in ["underlyings", "portfolio_id"]:
            setattr(holding, key, value)

    if "portfolio_id" in update_dict:
        portfolio = db.query(Portfolio).filter(Portfolio.id == holding_data.portfolio_id).first()
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        holding.portfolio_id = portfolio.id

    price_data = fetch_price_data(holding.symbol)
    current_price = price_data.get("price")
    if current_price is None:
        raise HTTPException(status_code=400, detail="No price data available from FMP")

    all_time_change_percent = ((current_price - holding.purchase_price) / holding.purchase_price) * 100 if holding.purchase_price != 0 else None
    all_time_gain_loss = (current_price - holding.purchase_price) * holding.quantity

    holding.current_price = current_price
    holding.all_time_change_percent = all_time_change_percent
    holding.market_value = current_price * holding.quantity
    holding.all_time_gain_loss = all_time_gain_loss
    holding.daily_change = price_data.get("change")
    holding.daily_change_percent = price_data.get("change_percent")

    if holding.type.value == "etf":  # FIX: use .value here too
        if "underlyings" in update_dict:
            logger.info(f"Replacing underlyings for holding {holding.id}")
            db.query(UnderlyingHolding).filter(UnderlyingHolding.holding_id == holding.id).delete()
            for u in (holding_data.underlyings or []):
                logger.info(f"Saving updated underlying: symbol={u.symbol}, allocation_percent={u.allocation_percent}")
                underlying = UnderlyingHolding(
                    symbol=u.symbol.upper(),
                    allocation_percent=u.allocation_percent,
                    holding_id=holding.id
                )
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