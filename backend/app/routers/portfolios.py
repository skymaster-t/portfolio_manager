from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_
from app.database import get_db
from app.models import (
    Portfolio, 
    Holding, 
    UnderlyingHolding, 
    PortfolioHistory, 
    GlobalHistory,
    SymbolSectorCache,
    HoldingType,
)
from app.schemas import (
    PortfolioCreate,
    PortfolioResponse,
    PortfolioHistoryResponse,
    GlobalHistoryResponse,
    PortfolioSummary,
    PieItem,
    ReorderRequest,          
    GlobalSectorResponse,     
    SectorItem,
)
from typing import List
from pydantic import BaseModel
from collections import defaultdict
from app.main import r

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

    # Set display_order so new portfolio appears at the far right
    max_order = db.query(func.max(Portfolio.display_order)).scalar()
    new_display_order = (max_order + 1) if max_order is not None else 0

    new_portfolio = Portfolio(
        name=portfolio_data.name,
        is_default=portfolio_data.is_default,
        user_id=1,
        display_order=new_display_order,
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
    """
    Receive a list of portfolio IDs in the desired left-to-right order
    and update display_order accordingly (0 = leftmost, 1 = next, etc.).
    """
    for position, portfolio_id in enumerate(request.order):
        db.query(Portfolio)\
          .filter(Portfolio.id == portfolio_id)\
          .update({Portfolio.display_order: position})
    db.commit()
    return {"detail": "Portfolio order updated successfully"}

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

@router.get("/global/history/latest", response_model=GlobalHistoryResponse)
def get_latest_global_history(db: Session = Depends(get_db)):
    latest = db.query(GlobalHistory)\
               .order_by(GlobalHistory.timestamp.desc())\
               .first()
    if not latest:
        raise HTTPException(status_code=404, detail="No global history snapshot yet")
    return latest

@router.get("/global/history/daily", response_model=List[GlobalHistoryResponse])
def get_daily_global_history(db: Session = Depends(get_db)):
    """
    Fetch all end-of-day (EOD) global snapshots in chronological order.
    Perfect for clean daily performance graphs (one data point per trading day).
    """
    return (
        db.query(GlobalHistory)
        .filter(GlobalHistory.is_eod == True)
        .order_by(GlobalHistory.timestamp.asc())
        .all()
    )

@router.get("/summary", response_model=List[PortfolioSummary])
def get_portfolios_summary(db: Session = Depends(get_db)):
    """
    Returns enriched summary for every portfolio (total value in CAD, performance, pie data).
    Uses cached USDCAD rate from Redis.
    """
    portfolios = db.query(Portfolio).all()
    holdings = db.query(Holding).all()

    rate_str = r.get("fx:USDCAD")
    rate = float(rate_str.decode("utf-8") if rate_str else 1.37)

    port_holdings = defaultdict(list)
    for h in holdings:
        port_holdings[h.portfolio_id].append(h)

    summaries = []
    for port in portfolios:
        ph = port_holdings.get(port.id, [])

        total_value = 0.0
        daily_change = 0.0
        gain_loss = 0.0
        pie_data = []

        for h in ph:
            is_cad = h.symbol.upper().endswith('.TO')
            native_market = h.market_value or (h.current_price or 0) * h.quantity
            native_daily = (h.daily_change or 0) * h.quantity
            native_gain = h.all_time_gain_loss or ((h.current_price or 0) - h.purchase_price) * h.quantity

            contrib_market = native_market if is_cad else native_market * rate
            contrib_daily = native_daily if is_cad else native_daily * rate
            contrib_gain = native_gain if is_cad else native_gain * rate

            total_value += contrib_market
            daily_change += contrib_daily
            gain_loss += contrib_gain

            if contrib_market > 0:
                pie_data.append(PieItem(name=h.symbol, value=round(contrib_market, 2)))

        yesterday_value = total_value - daily_change
        daily_percent = (daily_change / yesterday_value * 100) if yesterday_value > 0 else 0.0

        cost_basis = total_value - gain_loss
        all_time_percent = (gain_loss / cost_basis * 100) if cost_basis > 0 else 0.0

        pie_data = sorted(pie_data, key=lambda x: x.value, reverse=True)

        summaries.append(
            PortfolioSummary(
                id=port.id,
                name=port.name,
                isDefault=port.is_default,
                totalValue=round(total_value, 2),
                gainLoss=round(gain_loss, 2),
                dailyChange=round(daily_change, 2),
                dailyPercent=round(daily_percent, 2),
                allTimePercent=round(all_time_percent, 2),
                pieData=pie_data,
            )
        )

    return summaries
    
@router.get("/summaries", response_model=List[PortfolioSummary])
def get_portfolios_summaries(db: Session = Depends(get_db)):
    portfolios = (
        db.query(Portfolio)
        .order_by(Portfolio.display_order.asc().nulls_last(), Portfolio.id.asc())
        .all()
    )
    holdings = db.query(Holding).all()

    # Get current FX rate (1 USD → CAD)
    rate_str = r.get("fx:USDCAD")
    rate = float(rate_str.decode("utf-8") if rate_str else 1.37)

    # Group holdings by portfolio
    port_holdings = defaultdict(list)
    for h in holdings:
        port_holdings[h.portfolio_id].append(h)

    summaries = []
    for port in portfolios:
        ph = port_holdings.get(port.id, [])

        total_value = 0.0
        daily_change = 0.0
        gain_loss = 0.0
        pie_data = []

        for h in ph:
            is_cad = h.symbol.upper().endswith('.TO')
            native_market = h.market_value or (h.current_price or 0) * h.quantity
            native_daily = (h.daily_change or 0) * h.quantity
            native_gain = h.all_time_gain_loss or ((h.current_price or 0) - h.purchase_price) * h.quantity

            contrib_market = native_market if is_cad else native_market * rate
            contrib_daily = native_daily if is_cad else native_daily * rate
            contrib_gain = native_gain if is_cad else native_gain * rate

            total_value += contrib_market
            daily_change += contrib_daily
            gain_loss += contrib_gain

            if contrib_market > 0:
                pie_data.append({"name": h.symbol, "value": round(contrib_market, 2)})

        yesterday_value = total_value - daily_change
        daily_percent = (daily_change / yesterday_value * 100) if yesterday_value > 0 else 0.0

        cost_basis = total_value - gain_loss
        all_time_percent = (gain_loss / cost_basis * 100) if cost_basis > 0 else 0.0

        pie_data = sorted(pie_data, key=lambda x: x["value"], reverse=True)

        summaries.append(
            PortfolioSummary(
                id=port.id,
                name=port.name,
                isDefault=port.is_default,
                totalValue=round(total_value, 2),
                gainLoss=round(gain_loss, 2),
                dailyChange=round(daily_change, 2),
                dailyPercent=round(daily_percent, 2),
                allTimePercent=round(all_time_percent, 2),
                pieData=pie_data,
            )
        )

    return summaries

@router.get("/global-history", response_model=List[GlobalHistoryResponse])
def get_global_history(db: Session = Depends(get_db)):
    return (
        db.query(GlobalHistory)
        .order_by(GlobalHistory.timestamp.desc())
        .all()  # Removed limit – returns all records (intraday + EOD), sorted newest first
    )

@router.get("/global-sector-allocation", response_model=GlobalSectorResponse)
def get_global_sector_allocation(db: Session = Depends(get_db)):
    holdings = db.query(Holding).options(joinedload(Holding.underlyings)).all()

    rate_str = r.get("fx:USDCAD")
    rate = float(rate_str.decode("utf-8")) if rate_str else 1.37

    sector_contrib = defaultdict(float)
    total_value = 0.0

    for h in holdings:
        native_mv = h.market_value or (h.current_price or 0) * h.quantity
        is_cad = h.symbol.upper().endswith('.TO')
        mv_cad = native_mv if is_cad else native_mv * rate
        total_value += mv_cad
        if mv_cad <= 0:
            continue

        # Prefer manual underlyings for ETFs (more accurate than auto-fetched)
        if h.type == HoldingType.etf and h.underlyings:
            sum_alloc = sum(u.allocation_percent or 0 for u in h.underlyings)
            if sum_alloc == 0:
                sum_alloc = 100.0
            for u in h.underlyings:
                alloc = (u.allocation_percent or (100.0 / len(h.underlyings))) / sum_alloc
                u_mv = mv_cad * alloc
                cache = db.query(SymbolSectorCache).get(u.symbol)
                if cache and cache.weightings:
                    for item in cache.weightings:
                        sector_contrib[item["sector"]] += u_mv * item["weight"]
                else:
                    sector_contrib["Other"] += u_mv
        else:
            # Use cached sector data for stocks / ETFs without manual underlyings
            cache = db.query(SymbolSectorCache).get(h.symbol)
            if cache and cache.weightings:
                for item in cache.weightings:
                    sector_contrib[item["sector"]] += mv_cad * item["weight"]
            else:
                sector_contrib["Other"] += mv_cad

    # Consolidate small slices (<3%) into "Other"
    sector_data = []
    other_value = sector_contrib.pop("Other", 0.0)

    for sector, value in sector_contrib.items():
        percent = (value / total_value * 100) if total_value > 0 else 0
        if percent < 3.0:
            other_value += value
        else:
            sector_data.append(
                SectorItem(
                    sector=sector,
                    value=round(value, 2),
                    percentage=round(percent, 2),
                )
            )

    if other_value > 0:
        other_percent = (other_value / total_value * 100) if total_value > 0 else 0
        sector_data.append(
            SectorItem(
                sector="Other",
                value=round(other_value, 2),
                percentage=round(other_percent, 2),
            )
        )

    sector_data.sort(key=lambda x: x.percentage, reverse=True)

    return GlobalSectorResponse(
        totalValue=round(total_value, 2),
        sectorData=sector_data,
    )

@router.get("/global-history", response_model=List[GlobalHistoryResponse])
def get_global_history(db: Session = Depends(get_db)):
    return (
        db.query(GlobalHistory)
        .order_by(GlobalHistory.timestamp.desc())
        .all()
    )

