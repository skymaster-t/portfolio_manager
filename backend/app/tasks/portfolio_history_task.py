from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import SessionLocal
from app.models import Holding, Portfolio, PortfolioHistory, GlobalHistory
from app.utils.yahoo import batch_fetch_prices
from app.celery_config import celery_app
from datetime import datetime
from app.main import r
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

        # Fetch latest prices (same as update_prices task)
        symbols = [h.symbol for h in holdings] + ["USDCAD=X"]
        price_map = batch_fetch_prices(symbols)

        now = datetime.utcnow()

        # Update holdings with latest prices (same as update_prices)
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

        # Get USDCAD rate (1 USD = X CAD) – prefer cached, fallback from price_map
        rate_str = r.get("fx:USDCAD")
        if rate_str:
            rate = float(rate_str.decode("utf-8"))
        else:
            usdcad_data = price_map.get("USDCAD=X", {})
            rate = usdcad_data.get("price") or 1.37

        portfolios = db.query(Portfolio).all()

        # Compute and save per-portfolio history (existing logic – kept unchanged)
        for port in portfolios:
            port_holdings = [h for h in holdings if h.portfolio_id == port.id]
            total_value = 0.0
            daily_change = 0.0
            gain_loss = 0.0

            for h in port_holdings:
                is_cad = h.symbol.upper().endswith('.TO')
                contrib_market = h.market_value if is_cad else (h.market_value or 0) * rate
                contrib_daily = (h.daily_change or 0) * h.quantity if is_cad else ((h.daily_change or 0) * h.quantity) * rate
                contrib_gain = h.all_time_gain_loss or 0 if is_cad else (h.all_time_gain_loss or 0) * rate

                total_value += contrib_market
                daily_change += contrib_daily
                gain_loss += contrib_gain

            yesterday_value = total_value - daily_change
            daily_percent = (daily_change / yesterday_value * 100) if yesterday_value > 0 else 0.0

            cost_basis = total_value - gain_loss
            all_time_percent = (gain_loss / cost_basis * 100) if cost_basis > 0 else 0.0

            history = PortfolioHistory(
                portfolio_id=port.id,
                timestamp=now,
                total_value=total_value,
                daily_change=daily_change,
                daily_percent=daily_percent,
                all_time_gain=gain_loss,
                all_time_percent=all_time_percent,
            )
            db.add(history)

        # NEW: Compute and save GLOBAL history (in CAD) every 5 minutes – matches header total
        global_total = 0.0
        global_daily = 0.0
        global_gain = 0.0

        for h in holdings:
            is_cad = h.symbol.upper().endswith('.TO')
            contrib_market = h.market_value if is_cad else (h.market_value or 0) * rate
            contrib_daily = (h.daily_change or 0) * h.quantity if is_cad else ((h.daily_change or 0) * h.quantity) * rate
            contrib_gain = h.all_time_gain_loss or 0 if is_cad else (h.all_time_gain_loss or 0) * rate

            global_total += contrib_market
            global_daily += contrib_daily
            global_gain += contrib_gain

        global_yesterday = global_total - global_daily
        global_daily_percent = (global_daily / global_yesterday * 100) if global_yesterday > 0 else 0.0

        global_cost = global_total - global_gain
        global_all_time_percent = (global_gain / global_cost * 100) if global_cost > 0 else 0.0

        global_history = GlobalHistory(
            timestamp=now,
            total_value=global_total,
            daily_change=global_daily,
            daily_percent=global_daily_percent,
            all_time_gain=global_gain,
            all_time_percent=global_all_time_percent,
            is_eod=False,  # Intraday snapshot
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

# Daily end-of-day global snapshot (runs ~2 hours after close)
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
