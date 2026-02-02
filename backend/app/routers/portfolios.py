# backend/app/routers/portfolios.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Portfolio, Holding, UnderlyingHolding  # ← Added UnderlyingHolding import
from app.schemas import PortfolioCreate, PortfolioResponse
from typing import List

router = APIRouter(prefix="/portfolios", tags=["portfolios"])

@router.get("/", response_model=List[PortfolioResponse])
def get_portfolios(db: Session = Depends(get_db)):
    return db.query(Portfolio).all()

@router.post("/", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
def create_portfolio(portfolio_data: PortfolioCreate, db: Session = Depends(get_db)):
    # Check for duplicates
    existing = db.query(Portfolio).filter(Portfolio.name.ilike(portfolio_data.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Portfolio name must be unique")

    # If is_default, unset others
    if portfolio_data.is_default:
        db.query(Portfolio).update({Portfolio.is_default: False})
        db.commit()

    new_portfolio = Portfolio(
        name=portfolio_data.name,
        is_default=portfolio_data.is_default,
        user_id=1  # Hardcoded default user for now
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

    # Check name uniqueness (excluding current portfolio)
    if portfolio_data.name != portfolio.name:
        existing = db.query(Portfolio).filter(
            Portfolio.name.ilike(portfolio_data.name),
            Portfolio.id != portfolio_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Portfolio name must be unique")

    # If setting as default, unset others
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

    # === FIX: Delete underlying_holdings first (bulk) to avoid FK violation ===
    db.query(UnderlyingHolding).filter(
        UnderlyingHolding.holding_id.in_(
            db.query(Holding.id).filter(Holding.portfolio_id == portfolio_id).subquery()
        )
    ).delete(synchronize_session=False)

    # Now safe to delete holdings
    db.query(Holding).filter(Holding.portfolio_id == portfolio_id).delete(synchronize_session=False)

    # Finally delete the portfolio
    db.delete(portfolio)
    db.commit()
    return None