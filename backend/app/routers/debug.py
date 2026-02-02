# backend/app/routers/debug.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Holding
from app.schemas import HoldingResponse, List  # For response_model=List[HoldingResponse]

router = APIRouter(prefix="/holdings", tags=["debug"])

@router.get("/", response_model=List[HoldingResponse])
def debug_get_all_holdings(db: Session = Depends(get_db)):
    """
    Debug endpoint: Return ALL holdings directly from DB (raw stored prices, no enrichment).
    Includes last_price_update timestamp.
    """
    holdings = db.query(Holding).options(joinedload(Holding.underlyings)).all()
    return holdings

@router.get("/{holding_id}", response_model=HoldingResponse)
def debug_get_holding(holding_id: int, db: Session = Depends(get_db)):
    """
    Debug endpoint: Return a SINGLE holding by ID directly from DB.
    Useful for checking specific stored prices without API enrichment.
    """
    holding = (
        db.query(Holding)
        .options(joinedload(Holding.underlyings))
        .filter(Holding.id == holding_id)
        .first()
    )
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    return holding