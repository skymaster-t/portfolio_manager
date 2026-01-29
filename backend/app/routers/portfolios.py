from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Portfolio
from app.schemas import PortfolioCreate, PortfolioResponse
from typing import List

router = APIRouter(prefix="/portfolios", tags=["portfolios"])

@router.get("/", response_model=List[PortfolioResponse])
def get_portfolios(db: Session = Depends(get_db)):
    return db.query(Portfolio).all()

@router.post("/", response_model=PortfolioResponse, status_code=201)
def create_portfolio(portfolio_data: PortfolioCreate, db: Session = Depends(get_db)):
    # If is_default, unset others
    if portfolio_data.is_default:
        db.query(Portfolio).update({Portfolio.is_default: False})
    
    new_portfolio = Portfolio(
        name=portfolio_data.name,
        is_default=portfolio_data.is_default,
        user_id=1  # Hardcoded default user for now
    )
    db.add(new_portfolio)
    db.commit()
    db.refresh(new_portfolio)
    return new_portfolio