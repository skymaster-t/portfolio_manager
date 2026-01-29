# backend/app/tasks/update_prices.py
from app.celery_config import celery_app
from app.database import SessionLocal
from app.models import Holding, Portfolio
from app.utils.fmp import fetch_price_data
import logging

logger = logging.getLogger(__name__)

@celery_app.task(name="app.tasks.update_all_prices")
def update_all_prices():
    db = SessionLocal()
    try:
        portfolio = db.query(Portfolio).first()
        if not portfolio:
            logger.warning("No default portfolio found for price updates")
            return

        holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio.id).all()
        updated = 0
        for h in holdings:
            try:
                price_data = fetch_price_data(h.symbol)

                # Debug Log
                logger.info(f"Fetched price_data for {h.symbol}: {price_data}")
                
                current_price = price_data.get("price")
                if current_price is None:
                    logger.warning(f"No price data for {h.symbol} — skipping update")
                    continue

                # Daily values from FMP
                h.daily_change = price_data.get("change")
                h.daily_change_percent = price_data.get("change_percent")

                # Current price and market value
                h.current_price = current_price
                h.market_value = current_price * h.quantity

                # All-time calculations (from purchase to current)
                if h.purchase_price and h.purchase_price != 0:
                    h.all_time_change_percent = ((current_price - h.purchase_price) / h.purchase_price) * 100
                    h.all_time_gain_loss = (current_price - h.purchase_price) * h.quantity
                else:
                    h.all_time_change_percent = None
                    h.all_time_gain_loss = None

                updated += 1
            except Exception as e:
                logger.error(f"Failed to update {h.symbol}: {str(e)}")
        db.commit()
        logger.info(f"Price update complete: {updated} holdings updated")
    except Exception as e:
        logger.error(f"Price update task failed: {str(e)}")
        db.rollback()
    finally:
        db.close()