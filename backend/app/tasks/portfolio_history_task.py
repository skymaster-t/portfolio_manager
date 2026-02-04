from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import SessionLocal
from app.models import Holding, Portfolio, PortfolioHistory, GlobalHistory
from app.utils.yahoo import batch_fetch_prices
from app.celery_config import celery_app
from datetime import datetime
import logging
import pytz
import holidays

logger = logging.getLogger(__name__)

celery = celery_app

# Helper – was today a trading day?
def _was_trading_day() -> bool:
    tz = pytz.timezone("America/Toronto")
    today = datetime.now(tz).date()
    if today.weekday() >= 5:  # Sat/Sun
        return False
    ca_hols = holidays.CA(prov="ON", years=today.year)
    us_hols = holidays.US(years=today.year)
    if today in ca_hols or today in us_hols:
        return False
    return True

@celery.task(name="app.tasks.portfolio_history_task.save_portfolio_history_snapshot")
def save_portfolio_history_snapshot():
    db: Session = SessionLocal()
    try:
        holdings = db.query(Holding).all()
        symbols = [h.symbol for h in holdings]
        price_map = batch_fetch_prices(symbols)

        now = datetime.utcnow()
        for h in holdings:
            data = price_map.get(h.symbol, {})
            price = data.get("price")
            if price is not None:
                h.current_price = price
                h.daily_change = data.get("change")                   # per-share
                h.daily_change_percent = data.get("change_percent")
                h.market_value = price * h.quantity
                h.all_time_gain_loss = (price - h.purchase_price) * h.quantity
                h.all_time_change_percent = (
                    (price - h.purchase_price) / h.purchase_price * 100
                    if h.purchase_price != 0 else None
                )
                h.last_price_update = now

        db.commit()

        portfolios = db.query(Portfolio).all()
        global_total = 0.0
        global_daily = 0.0
        global_gain = 0.0

        for port in portfolios:
            port_holdings = [h for h in holdings if h.portfolio_id == port.id]
            port_total = sum((h.market_value or 0) for h in port_holdings)

            # FIXED: multiply per-share daily_change by quantity
            port_daily = sum((h.daily_change or 0) * h.quantity for h in port_holdings)

            port_gain = sum((h.all_time_gain_loss or 0) for h in port_holdings)

            yesterday = port_total - port_daily
            port_daily_percent = (port_daily / yesterday * 100) if yesterday > 0 else 0

            cost_basis = port_total - port_gain
            port_all_time_percent = (port_gain / cost_basis * 100) if cost_basis > 0 else 0

            history = PortfolioHistory(
                portfolio_id=port.id,
                timestamp=now,
                total_value=port_total,
                daily_change=port_daily,
                daily_percent=port_daily_percent,
                all_time_gain=port_gain,
                all_time_percent=port_all_time_percent,
            )
            db.add(history)

            global_total += port_total
            global_daily += port_daily
            global_gain += port_gain

        global_yesterday = global_total - global_daily
        global_daily_percent = (global_daily / global_yesterday * 100) if global_yesterday > 0 else 0
        global_cost_basis = global_total - global_gain
        global_all_time_percent = (global_gain / global_cost_basis * 100) if global_cost_basis > 0 else 0

        global_history = GlobalHistory(
            timestamp=now,
            total_value=global_total,
            daily_change=global_daily,
            daily_percent=global_daily_percent,
            all_time_gain=global_gain,
            all_time_percent=global_all_time_percent,
            is_eod=False,  # intraday snapshot
        )
        db.add(global_history)

        db.commit()
        logger.info(f"Intraday snapshot saved at {now}")
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving intraday snapshot: {e}")
    finally:
        db.close()

# NEW: Daily end-of-day global snapshot (runs ~2 hours after close)
@celery.task(name="app.tasks.portfolio_history_task.save_daily_global_snapshot")
def save_daily_global_snapshot():
    if not _was_trading_day():
        logger.info("Skipping daily EOD snapshot - today was not a trading day")
        return "skipped - non-trading day"

    db: Session = SessionLocal()
    try:
        holdings = db.query(Holding).all()
        if not holdings:
            logger.info("No holdings - skipping EOD snapshot")
            return "no holdings"

        symbols = list({h.symbol for h in holdings})
        price_map = batch_fetch_prices(symbols)

        now = datetime.utcnow()
        today = now.date()

        # Prevent duplicates
        existing_eod = db.query(GlobalHistory).filter(
            func.date(GlobalHistory.timestamp) == today,
            GlobalHistory.is_eod == True
        ).first()
        if existing_eod:
            logger.info("EOD snapshot already exists for today")
            return "already exists"

        # Update holdings with closing prices (consistent with intraday task)
        for h in holdings:
            data = price_map.get(h.symbol, {})
            price = data.get("price")
            if price is not None:
                h.current_price = price
                h.daily_change = data.get("change")
                h.daily_change_percent = data.get("change_percent")
                h.market_value = price * h.quantity
                h.all_time_gain_loss = (price - h.purchase_price) * h.quantity
                h.all_time_change_percent = (
                    (price - h.purchase_price) / h.purchase_price * 100
                    if h.purchase_price != 0 else None
                )
                h.last_price_update = now
        db.commit()

        # Compute global aggregates (correct quantity multiplication)
        total_value = sum((h.market_value or 0) for h in holdings)
        daily_change = sum((h.daily_change or 0) * h.quantity for h in holdings)
        all_time_gain = sum((h.all_time_gain_loss or 0) for h in holdings)

        yesterday_value = total_value - daily_change
        daily_percent = (daily_change / yesterday_value * 100) if yesterday_value > 0 else 0

        cost_basis = total_value - all_time_gain
        all_time_percent = (all_time_gain / cost_basis * 100) if cost_basis > 0 else 0

        eod_record = GlobalHistory(
            timestamp=now,
            total_value=total_value,
            daily_change=daily_change,
            daily_percent=daily_percent,
            all_time_gain=all_time_gain,
            all_time_percent=all_time_percent,
            is_eod=True,
        )
        db.add(eod_record)
        db.commit()

        logger.info(f"EOD global snapshot saved for {today}")
        return "success"
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving daily EOD snapshot: {e}")
        raise
    finally:
        db.close()
