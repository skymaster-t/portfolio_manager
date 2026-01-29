from app.celery_config import celery_app
from app.database import SessionLocal
import redis
import requests
import os
from app.utils.fmp import fetch_price_data

r = redis.Redis.from_url(os.getenv("REDIS_URL"))

@celery_app.task
def update_all_prices():
    db = SessionLocal()
    portfolio = db.query(Portfolio).first()  # Or get_default_portfolio if you move it
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio.id).all()
    for h in holdings:
        try:
            price_data = fetch_price_data(h.symbol)
            if price_data["price"]:
                h.current_price = price_data["price"]
                h.change_percent = price_data["change_percent"]
                h.market_value = price_data["price"] * h.quantity
                h.gain_loss = (price_data["price"] - h.purchase_price) * h.quantity
            # Underlying updates if needed (add similar for underlyings)
        except Exception as e:
            print(f"Error updating {h.symbol}: {e}")  # Log error, continue
    db.commit()
    db.close()