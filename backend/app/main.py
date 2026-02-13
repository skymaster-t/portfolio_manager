# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
from datetime import datetime

# Existing logging config (kept as-is – production-ready)
logging.basicConfig(
    level=logging.INFO,  # Use DEBUG for even more detail during testing
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# Explicitly load .env from the app directory (kept)
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

REDIS_URL = os.getenv("REDIS_URL")
if not REDIS_URL:
    raise ValueError("REDIS_URL not found in .env file")

r = redis.Redis.from_url(REDIS_URL)

app = FastAPI()

# Direct import of each router object (industry-standard, avoids AttributeError)
from app.routers.debug import router as debug_router
from app.routers.holdings import router as holdings_router
from app.routers.portfolios import router as portfolios_router
from app.routers.budget import router as budget_router

app.include_router(holdings_router)
app.include_router(portfolios_router)
app.include_router(budget_router)
app.include_router(debug_router, prefix="/debug")

# Existing CORS middleware (kept unchanged)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Existing endpoints (kept unchanged)
@app.get("/")
def read_root():
    return {"message": "FastAPI backend running", "redis_connected": r.ping()}

@app.get("/price/{ticker}")
def get_price(ticker: str):
    cached = r.get(f"price:{ticker}")
    if cached:
        return {"ticker": ticker, "price": float(cached), "source": "cache"}
    return {"ticker": ticker, "price": "fallback_value", "source": "db/fmp"}

# Current FX rate endpoint (for frontend currency toggle)
@app.get("/fx/current")
def get_current_fx_rate():
    rate_str = r.get("fx:USDCAD")
    if rate_str:
        rate = float(rate_str.decode("utf-8"))
    else:
        rate = 1.37  # Realistic fallback
    return {
        "usdcad_rate": rate,  # 1 USD = rate CAD
        "timestamp": datetime.utcnow().isoformat()
    }