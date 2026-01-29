from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis
from dotenv import load_dotenv
from pathlib import Path
import os

from app.routers import holdings
from app.routers import portfolios

# Explicitly load .env from the app directory
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

REDIS_URL = os.getenv("REDIS_URL")
if not REDIS_URL:
    raise ValueError("REDIS_URL not found in .env file")

r = redis.Redis.from_url(REDIS_URL)

app = FastAPI()

app.include_router(holdings.router)
app.include_router(portfolios.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "FastAPI backend running", "redis_connected": r.ping()}

@app.get("/price/{ticker}")
def get_price(ticker: str):
    cached = r.get(f"price:{ticker}")
    if cached:
        return {"ticker": ticker, "price": float(cached), "source": "cache"}
    return {"ticker": ticker, "price": "fallback_value", "source": "db/fmp"}