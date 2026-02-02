# backend/app/tasks/update_prices.py
from sqlalchemy.orm import Session, joinedload
from app.database import SessionLocal
from app.models import Holding
from app.utils.yahoo import batch_fetch_prices
from app.celery import celery_app
import logging
import pytz
from datetime import datetime
import holidays

logger = logging.getLogger(__name__)

celery = celery_app

def is_market_open() -> bool:
    tz = pytz.timezone("America/Toronto")
    now = datetime.now(tz)

    if now.weekday() >= 5:
        logger.info("Market closed: Weekend")
        return False

    market_open_min = 9 * 60 + 30
    market_close_min = 16 * 60
    current_min = now.hour * 60 + now.minute

    if current_min < market_open_min or current_min > market_close_min:
        logger.info(f"Market closed: Outside trading hours ({now.strftime('%H:%M')})")
        return False

    ca_holidays = holidays.CA(prov="ON", years=now.year)
    us_holidays = holidays.US(years=now.year)
    combined_holidays = ca_holidays | us_holidays

    if now.date() in combined_holidays:
        holiday_name = combined_holidays.get(now.date(), "Unknown holiday")
        logger.info(f"Market closed: Holiday - {holiday_name}")
        return False

    return True

@celery.task(bind=True, name="app.tasks.update_prices.update_all_prices")
def update_all_prices(self, force: bool = False):
    if not force and not is_market_open():
        logger.info("CELERY TASK SKIPPED: Market is closed (use force=True to override)")
        return "Skipped: Market is closed"

    db: Session = SessionLocal()
    try:
        holdings = db.query(Holding).options(joinedload(Holding.underlyings)).all()
        if not holdings:
            logger.info("CELERY TASK: No holdings found - nothing to update")
            return "No holdings"

        # Log existing DB prices
        for h in holdings:
            logger.debug(f"DB BEFORE {h.symbol}: price={h.current_price}, last_update={h.last_price_update}")

        main_symbols = {h.symbol for h in holdings}
        underlying_symbols = {u.symbol for h in holdings for u in h.underlyings}
        all_symbols = list(main_symbols.union(underlying_symbols))

        logger.info(f"CELERY TASK: Fetching prices for {len(all_symbols)} symbols (force={force})")
        price_map = batch_fetch_prices(all_symbols)

        updated_count = 0
        now = datetime.utcnow()
        for holding in holdings:
            data = price_map.get(holding.symbol, {})
            price = data.get("price")
            if price is not None:
                old_price = holding.current_price
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
                logger.info(f"DB UPDATED {holding.symbol}: {old_price} → {price} (last_update={now})")

        db.commit()
        logger.info(f"CELERY TASK SUCCESS: Updated {updated_count}/{len(holdings)} holdings in DB")
        return f"Updated {updated_count} holdings"

    except Exception as e:
        db.rollback()
        logger.error(f"CELERY TASK FAILED: {e}", exc_info=True)
        raise self.retry(countdown=60, max_retries=3)
    finally:
        db.close()
        