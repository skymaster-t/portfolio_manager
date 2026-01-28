from app.celery_config import celery_app
from app.database import SessionLocal
import redis
import requests  # Or your FMP client
import os

r = redis.Redis.from_url(os.getenv("REDIS_URL"))

@celery_app.task(name="app.tasks.update_stock_prices")
def update_stock_prices():
    db = SessionLocal()
    # Example: Get tickers from user's holdings in DB
    tickers = ["AAPL", "GOOGL"]  # Replace with real query
    for ticker in tickers:
        # Fetch from FMP
        price = requests.get(f"https://financialmodelingprep.com/api/v3/quote/{ticker}?apikey={os.getenv('FMP_API_KEY')}").json()[0]['price']
        # Update DB (example model needed later)
        # update_holdings_price(db, ticker, price)
        # Cache in Redis (expire in 5 min)
        r.set(f"price:{ticker}", price, ex=300)
    db.close()