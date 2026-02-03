from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Holding, Portfolio, PortfolioHistory, GlobalHistory
from app.utils.yahoo import batch_fetch_prices
from app.celery_config import celery_app
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

celery = celery_app

@celery.task(name="app.tasks.portfolio_history_task.save_portfolio_history_snapshot")
def save_portfolio_history_snapshot():
    db: Session = SessionLocal()
    try:
        # Fetch all holdings with current prices
        holdings = db.query(Holding).all()
        symbols = [h.symbol for h in holdings]
        price_map = batch_fetch_prices(symbols)  # Removed unsupported force_refresh

        # Update prices in holdings (same logic as router)
        now = datetime.utcnow()
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

        # Group by portfolio and compute snapshots
        portfolios = db.query(Portfolio).all()
        global_total = 0
        global_daily = 0
        global_gain = 0

        for port in portfolios:
            port_holdings = [h for h in holdings if h.portfolio_id == port.id]
            port_total = sum((h.market_value or 0) for h in port_holdings)
            port_daily = sum((h.daily_change or 0) for h in port_holdings)
            port_gain = sum((h.all_time_gain_loss or 0) for h in port_holdings)
            
            # Daily % approximation (common)
            yesterday = port_total - port_daily
            port_daily_percent = (port_daily / yesterday * 100) if yesterday > 0 else 0
            
            # All-time % (exact)
            cost_basis = port_total - port_gain
            port_all_time_percent = (port_gain / cost_basis * 100) if cost_basis > 0 else 0

            # Save per-portfolio snapshot
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

            # Accumulate for global
            global_total += port_total
            global_daily += port_daily
            global_gain += port_gain

        # Global snapshot
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
        )
        db.add(global_history)

        db.commit()
        logger.info(f"Portfolio history snapshot saved at {now}")
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving portfolio history: {e}")
    finally:
        db.close()