# backend/app/tasks/portfolio_history_task.py (updated: intraday snapshots restricted to 8AM-9PM on trading days, price updating removed – relies on update_prices task, consistent CAD conversion in both intraday & EOD, EOD at 4:30 PM)
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import SessionLocal
from app.models import Holding, Portfolio, PortfolioHistory, GlobalHistory
from app.utils.yahoo import batch_fetch_prices
from app.celery_config import celery_app
from app.main import r
import logging
import pytz
import holidays
from datetime import datetime

logger = logging.getLogger(__name__)

celery = celery_app

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

def _in_update_window() -> bool:
    """8:00 AM – 9:00 PM Toronto time"""
    tz = pytz.timezone("America/Toronto")
    now = datetime.now(tz)
    return 8 <= now.hour < 21

@celery.task(name="app.tasks.portfolio_history_task.save_portfolio_history_snapshot")
def save_portfolio_history_snapshot():
    if not _was_trading_day():
        logger.info("Skipping intraday snapshot – non-trading day")
        return "skipped - non-trading day"

    if not _in_update_window():
        logger.info("Skipping intraday snapshot – outside 8AM-9PM window")
        return "skipped - outside window"

    db: Session = SessionLocal()
    try:
        holdings = db.query(Holding).all()
        if not holdings:
            return "no holdings"

        portfolios = db.query(Portfolio).all()

        # Get latest FX rate (cached primary, fallback fetch only FX)
        rate_str = r.get("fx:USDCAD")
        if rate_str:
            rate = float(rate_str.decode("utf-8"))
        else:
            fx_map = batch_fetch_prices(["USDCAD=X"])
            rate = fx_map.get("USDCAD=X", {}).get("price") or 1.37
            r.set("fx:USDCAD", rate, ex=3600)

        now = datetime.utcnow()

        # Per-portfolio snapshots
        for port in portfolios:
            port_holdings = [h for h in holdings if h.portfolio_id == port.id]
            total_value = daily_change = gain_loss = 0.0

            for h in port_holdings:
                is_cad = h.symbol.upper().endswith('.TO')
                mv = h.market_value or 0
                dc = (h.daily_change or 0) * h.quantity
                ag = h.all_time_gain_loss or 0

                total_value += mv if is_cad else mv * rate
                daily_change += dc if is_cad else dc * rate
                gain_loss += ag if is_cad else ag * rate

            yesterday_value = total_value - daily_change
            daily_percent = (daily_change / yesterday_value * 100) if yesterday_value > 0 else 0
            cost_basis = total_value - gain_loss
            all_time_percent = (gain_loss / cost_basis * 100) if cost_basis > 0 else 0

            history_record = PortfolioHistory(
                portfolio_id=port.id,
                timestamp=now,
                total_value=total_value,
                daily_change=daily_change,
                daily_percent=daily_percent,
                all_time_gain=gain_loss,
                all_time_percent=all_time_percent,
            )
            db.add(history_record)

        # Global snapshot (intraday, not marked as EOD)
        total_value = daily_change = all_time_gain = 0.0
        for h in holdings:
            is_cad = h.symbol.upper().endswith('.TO')
            mv = h.market_value or 0
            dc = (h.daily_change or 0) * h.quantity
            ag = h.all_time_gain_loss or 0

            total_value += mv if is_cad else mv * rate
            daily_change += dc if is_cad else dc * rate
            all_time_gain += ag if is_cad else ag * rate

        yesterday_value = total_value - daily_change
        daily_percent = (daily_change / yesterday_value * 100) if yesterday_value > 0 else 0
        cost_basis = total_value - all_time_gain
        all_time_percent = (all_time_gain / cost_basis * 100) if cost_basis > 0 else 0

        global_history = GlobalHistory(
            timestamp=now,
            total_value=total_value,
            daily_change=daily_change,
            daily_percent=daily_percent,
            all_time_gain=all_time_gain,
            all_time_percent=all_time_percent,
            is_eod=False,
        )
        db.add(global_history)

        db.commit()
        logger.info(f"INTRADAY SNAPSHOT: Saved {len(portfolios)} portfolio + 1 global history records")

        return "success"

    except Exception as e:
        db.rollback()
        logger.error(f"Error in intraday history snapshot: {e}", exc_info=True)
        raise
    finally:
        db.close()

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

        # Get latest FX rate (cached primary, fallback fetch)
        rate_str = r.get("fx:USDCAD")
        if rate_str:
            rate = float(rate_str.decode("utf-8"))
        else:
            fx_map = batch_fetch_prices(["USDCAD=X"])
            rate = fx_map.get("USDCAD=X", {}).get("price") or 1.37
            r.set("fx:USDCAD", rate, ex=3600)

        # Compute global aggregates in CAD
        total_value = daily_change = all_time_gain = 0.0
        for h in holdings:
            is_cad = h.symbol.upper().endswith('.TO')
            mv = h.market_value or 0
            dc = (h.daily_change or 0) * h.quantity
            ag = h.all_time_gain_loss or 0

            total_value += mv if is_cad else mv * rate
            daily_change += dc if is_cad else dc * rate
            all_time_gain += ag if is_cad else ag * rate

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

        logger.info(f"EOD global snapshot saved for {today} at 4:30 PM ET")
        return "success"
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving daily EOD snapshot: {e}", exc_info=True)
        raise
    finally:
        db.close()