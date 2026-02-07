# backend/app/tasks/update_prices.py (updated: runs every minute 24/7 – yfinance returns last close after hours; updates main + underlyings; fetches 1-day chart only during market hours to avoid empty; null-safe, production-ready)
from sqlalchemy.orm import Session, joinedload
from app.database import SessionLocal
from app.models import Holding
from app.utils.yahoo import batch_fetch_prices
from app.celery_config import celery_app
from app.main import r
import logging
from datetime import datetime
import yfinance as yf
import pytz
import holidays

logger = logging.getLogger(__name__)

celery = celery_app

def is_trading_day() -> bool:
    """Skip holidays only – allow after-hours last close"""
    tz = pytz.timezone("America/Toronto")
    now = datetime.now(tz)

    ca_holidays = holidays.CA(prov="ON", years=now.year)
    us_holidays = holidays.US(years=now.year)
    combined_holidays = ca_holidays | us_holidays
    if now.date() in combined_holidays:
        holiday_name = combined_holidays.get(now.date(), "Unknown holiday")
        logger.info(f"Price update skipped: Holiday - {holiday_name}")
        return False

    return True

@celery.task(bind=True, name="app.tasks.update_prices.update_all_prices")
def update_all_prices(self):
    """Update prices every minute – runs 24/7 (last close after hours)"""
    if not is_trading_day():
        logger.info("Price update skipped: Holiday")
        return "Skipped: Holiday"

    db: Session = SessionLocal()
    try:
        holdings = db.query(Holding).options(joinedload(Holding.underlyings)).all()

        main_symbols = {h.symbol for h in holdings}
        underlying_symbols = {u.symbol for h in holdings for u in (h.underlyings or [])}
        all_symbols = list(main_symbols.union(underlying_symbols))

        if "USDCAD=X" not in all_symbols:
            all_symbols.append("USDCAD=X")

        logger.info(f"CELERY TASK: Fetching prices for {len(all_symbols)} symbols")
        price_map = batch_fetch_prices(all_symbols)

        updated_count = 0
        now = datetime.utcnow()

        for holding in holdings:
            # Main holding
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

            # Underlyings
            for u in (holding.underlyings or []):
                u_data = price_map.get(u.symbol, {})
                u_price = u_data.get("price")
                if u_price is not None:
                    u.current_price = u_price
                    u.daily_change = u_data.get("change")
                    u.daily_change_percent = u_data.get("change_percent")

            # 1-day chart – only during market hours (5m data available)
            tz = pytz.timezone("America/Toronto")
            local_now = datetime.now(tz)
            if 8 <= local_now.hour < 21:  # Market hours
                try:
                    ticker = yf.Ticker(holding.symbol)
                    hist = ticker.history(period="1d", interval="5m")
                    if not hist.empty:
                        day_points = hist['Close'].dropna().to_list()
                        holding.day_chart = [
                            {"time": int(idx.timestamp() * 1000), "price": float(price)}
                            for idx, price in zip(hist.index, day_points)
                        ]
                    else:
                        holding.day_chart = []
                except Exception as e:
                    logger.warning(f"Failed to fetch 1-day chart for {holding.symbol}: {e}")
                    holding.day_chart = []
            # After hours: keep previous chart

        db.commit()
        logger.info(f"CELERY TASK SUCCESS: Updated {updated_count}/{len(holdings)} holdings + underlyings")

        # Cache FX
        usdcad_data = price_map.get("USDCAD=X", {})
        usdcad_price = usdcad_data.get("price")
        if usdcad_price is not None:
            r.set("fx:USDCAD", usdcad_price, ex=3600)

        return f"Updated {updated_count} holdings + underlyings"

    except Exception as e:
        db.rollback()
        logger.error(f"CELERY TASK FAILED: {e}", exc_info=True)
        raise self.retry(countdown=60, max_retries=3)
    finally:
        db.close()