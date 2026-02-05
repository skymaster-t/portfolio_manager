# backend/app/tasks/update_prices.py (updated: runs strictly 8:00 AM – 9:00 PM Toronto time on trading days only)
from sqlalchemy.orm import Session, joinedload
from app.database import SessionLocal
from app.models import Holding
from app.utils.yahoo import batch_fetch_prices
from app.celery_config import celery_app
from app.main import r
import logging
import pytz
from datetime import datetime
import holidays

logger = logging.getLogger(__name__)

celery = celery_app

def is_update_window() -> bool:
    """Allow price updates only on trading days between 8:00 AM and 9:00 PM Toronto time"""
    tz = pytz.timezone("America/Toronto")
    now = datetime.now(tz)

    # Weekend
    if now.weekday() >= 5:
        logger.info("Price update skipped: Weekend")
        return False

    # Outside 8 AM – 9 PM
    if now.hour < 8 or now.hour >= 21:
        logger.info(f"Price update skipped: Outside 8AM-9PM window ({now.strftime('%H:%M ET')})")
        return False

    # Holiday (CA ON + US)
    ca_holidays = holidays.CA(prov="ON", years=now.year)
    us_holidays = holidays.US(years=now.year)
    combined_holidays = ca_holidays | us_holidays
    if now.date() in combined_holidays:
        holiday_name = combined_holidays.get(now.date(), "Unknown holiday")
        logger.info(f"Price update skipped: Holiday - {holiday_name}")
        return False

    return True

@celery.task(bind=True, name="app.tasks.update_prices.update_all_prices")
def update_all_prices(self, force: bool = False):
    if not force and not is_update_window():
        logger.info("CELERY TASK SKIPPED: Outside allowed update window (use force=True to override)")
        return "Skipped: Outside 8AM-9PM trading day window"

    db: Session = SessionLocal()
    try:
        holdings = db.query(Holding).options(joinedload(Holding.underlyings)).all()

        main_symbols = {h.symbol for h in holdings}
        underlying_symbols = {u.symbol for h in holdings for u in (h.underlyings or [])}
        all_symbols = list(main_symbols.union(underlying_symbols))

        # Always include FX rate
        if "USDCAD=X" not in all_symbols:
            all_symbols.append("USDCAD=X")

        logger.info(f"CELERY TASK: Fetching prices for {len(all_symbols)} symbols (force={force})")
        price_map = batch_fetch_prices(all_symbols)

        updated_count = 0
        now = datetime.utcnow()
        for holding in holdings:
            data = price_map.get(holding.symbol, {})
            price = data.get("price")
            if price is not None:
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
                updated_count += 1

        db.commit()
        logger.info(f"CELERY TASK SUCCESS: Updated {updated_count}/{len(holdings)} holdings")

        # Cache FX rate
        usdcad_data = price_map.get("USDCAD=X", {})
        usdcad_price = usdcad_data.get("price")
        if usdcad_price is not None:
            r.set("fx:USDCAD", usdcad_price, ex=3600)
            logger.info(f"Updated cached FX rate USDCAD=X → {usdcad_price}")

        return f"Updated {updated_count} holdings"

    except Exception as e:
        db.rollback()
        logger.error(f"CELERY TASK FAILED: {e}", exc_info=True)
        raise self.retry(countdown=60, max_retries=3)
    finally:
        db.close()