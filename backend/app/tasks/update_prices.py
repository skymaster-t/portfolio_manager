# backend/app/tasks/update_prices.py (fixed – proper manual dividend override skip)
# - Dividend fetch/set now wrapped in if not holding.is_dividend_manual
# - Skip log when manual
# - Updated log only when actually updated (counted)
# - No overwrite of manual values
# - Yield update also skipped for manual
# - Commit only after all (unchanged)

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
    if not is_trading_day():
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

        # Main holdings price update (unchanged)
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

            # 1-day chart (unchanged)
            tz = pytz.timezone("America/Toronto")
            local_now = datetime.now(tz)
            if 9 <= local_now.hour < 16:  # Strict market hours for intraday data
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

        # Dividend batch fetch – NOW PROPERLY SKIPS MANUAL OVERRIDES
        dividend_updated_count = 0
        if holdings:
            symbols_str = " ".join([h.symbol for h in holdings])
            try:
                multi_tickers = yf.Tickers(symbols_str)
                for holding in holdings:
                    if holding.is_dividend_manual:
                        logger.info(f"Skipping dividend update for manual override holding {holding.symbol}")
                        continue

                    try:
                        sym = holding.symbol.upper()
                        info = multi_tickers.tickers[sym].info

                        # Trailing preferred
                        trailing = info.get("trailingAnnualDividendRate")
                        forward = info.get("dividendRate")
                        new_div = trailing or forward or 0.0
                        if holding.dividend_annual_per_share != new_div:
                            holding.dividend_annual_per_share = new_div
                            dividend_updated_count += 1

                        trailing_yield = info.get("trailingAnnualDividendYield")
                        forward_yield = info.get("dividendYield")
                        yield_val = trailing_yield or forward_yield
                        new_yield = yield_val * 100 if yield_val is not None else None
                        if holding.dividend_yield_percent != new_yield:
                            holding.dividend_yield_percent = new_yield

                    except Exception as e:
                        logger.warning(f"Dividend fetch failed for {holding.symbol}: {e}")

                if dividend_updated_count > 0:
                    logger.info(f"Dividend data updated for {dividend_updated_count} holdings")
                else:
                    logger.info("No dividend changes (all manual or no new data)")

            except Exception as e:
                logger.warning(f"Batch dividend fetch failed: {e}")

        db.commit()
        logger.info(f"CELERY TASK SUCCESS: Updated prices for {updated_count}/{len(holdings)} holdings, dividends for {dividend_updated_count}")

        # Cache FX
        usdcad_data = price_map.get("USDCAD=X", {})
        usdcad_price = usdcad_data.get("price")
        if usdcad_price is not None:
            r.set("fx:USDCAD", usdcad_price, ex=3600)
            logger.info(f"Updated cached FX rate USDCAD=X to {usdcad_price}")

        return f"Updated {updated_count} prices + {dividend_updated_count} dividends"

    except Exception as e:
        db.rollback()
        logger.error(f"CELERY TASK FAILED: {e}", exc_info=True)
        raise self.retry(countdown=60, max_retries=3)
    finally:
        db.close()