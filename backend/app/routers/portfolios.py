from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.database import get_db
from app.models import Portfolio, Holding, UnderlyingHolding, PortfolioHistory, GlobalHistory
from app.schemas import (
    PortfolioCreate,
    PortfolioResponse,
    PortfolioHistoryResponse,
    GlobalHistoryResponse,
)
from typing import List
from pydantic import BaseModel

class ReorderRequest(BaseModel):
    order: List[int]

router = APIRouter(prefix="/portfolios", tags=["portfolios"])

@router.get("/", response_model=List[PortfolioResponse])
def get_portfolios(db: Session = Depends(get_db)):
    return db.query(Portfolio)\
             .order_by(Portfolio.display_order.asc().nulls_last(), Portfolio.id.asc())\
             .all()

@router.post("/", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
def create_portfolio(portfolio_data: PortfolioCreate, db: Session = Depends(get_db)):
    existing = db.query(Portfolio).filter(Portfolio.name.ilike(portfolio_data.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Portfolio name must be unique")

    if portfolio_data.is_default:
        db.query(Portfolio).update({Portfolio.is_default: False})
        db.commit()

    new_portfolio = Portfolio(
        name=portfolio_data.name,
        is_default=portfolio_data.is_default,
        user_id=1
    )
    db.add(new_portfolio)
    db.commit()
    db.refresh(new_portfolio)
    return new_portfolio

@router.put("/{portfolio_id}", response_model=PortfolioResponse)
def update_portfolio(portfolio_id: int, portfolio_data: PortfolioCreate, db: Session = Depends(get_db)):
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    if portfolio_data.name != portfolio.name:
        existing = db.query(Portfolio).filter(
            Portfolio.name.ilike(portfolio_data.name),
            Portfolio.id != portfolio_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Portfolio name must be unique")

    if portfolio_data.is_default and not portfolio.is_default:
        db.query(Portfolio).update({Portfolio.is_default: False})
        db.commit()

    portfolio.name = portfolio_data.name
    portfolio.is_default = portfolio_data.is_default

    db.commit()
    db.refresh(portfolio)
    return portfolio

@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio(portfolio_id: int, db: Session = Depends(get_db)):
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    db.query(Holding).filter(Holding.portfolio_id == portfolio_id).delete()

    db.query(UnderlyingHolding).filter(
        UnderlyingHolding.holding_id.in_(
            db.query(Holding.id).filter(Holding.portfolio_id == portfolio_id)
        )
    ).delete(synchronize_session=False)

    db.delete(portfolio)
    db.commit()
    return None

@router.post("/reorder")
def reorder_portfolios(request: ReorderRequest, db: Session = Depends(get_db)):
    order = request.order
    for index, portfolio_id in enumerate(order):
        portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        if not portfolio:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        portfolio.display_order = index
    db.commit()
    return {"detail": "Order updated successfully"}

# Latest per-portfolio history snapshots
@router.get("/history/latest/all", response_model=List[PortfolioHistoryResponse])
def get_latest_portfolio_histories(db: Session = Depends(get_db)):
    subq = db.query(
        PortfolioHistory.portfolio_id,
        func.max(PortfolioHistory.timestamp).label('max_timestamp')
    ).group_by(PortfolioHistory.portfolio_id).subquery()

    latest = db.query(PortfolioHistory).join(
        subq,
        and_(
            PortfolioHistory.portfolio_id == subq.c.portfolio_id,
            PortfolioHistory.timestamp == subq.c.max_timestamp
        )
    ).all()

    return latest

# Latest global history snapshot
@router.get("/global/history/latest", response_model=GlobalHistoryResponse)
def get_latest_global_history(db: Session = Depends(get_db)):
    latest = db.query(GlobalHistory)\
               .order_by(GlobalHistory.timestamp.desc())\
               .first()
    if not latest:
        raise HTTPException(status_code=404, detail="No global history snapshot yet")
    return latest