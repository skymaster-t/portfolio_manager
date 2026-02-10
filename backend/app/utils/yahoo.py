# backend/app/utils/yahoo.py (FULL updated file – adds Yahoo sector fallback function; keeps existing price batch fetch)
import yfinance as yf
from typing import Dict, Optional, List
import logging
from redis import Redis
from datetime import timedelta
import pandas as pd

logger = logging.getLogger(__name__)

redis = Redis(host='localhost', port=6379, db=0, decode_responses=True)

def batch_fetch_prices(symbols: List[str]) -> Dict[str, Dict[str, Optional[float]]]:
    symbols = [s.upper().strip() for s in symbols if s.strip()]
    if not symbols:
        logger.info("batch_fetch_prices: No symbols provided")
        return {}

    try:
        logger.info(f"batch_fetch_prices: Fetching {len(symbols)} symbols: {symbols}")
        data = yf.download(
            tickers=symbols,
            period="5d",
            interval="1d",
            auto_adjust=True,
            progress=False,
            threads=False,
        )

        if data.empty:
            logger.warning("Yahoo Finance: Empty data returned for all symbols")
            return {s: {"price": None, "change": None, "change_percent": None} for s in symbols}

        results = {}
        for symbol in symbols:
            try:
                closes = data['Close']
                if isinstance(closes, pd.DataFrame):
                    if symbol not in closes.columns:
                        logger.warning(f"Yahoo Finance: No Close data for {symbol}")
                        results[symbol] = {"price": None, "change": None, "change_percent": None}
                        continue
                    closes = closes[symbol]

                closes = closes.dropna()
                if closes.empty:
                    logger.warning(f"Yahoo Finance: No valid close prices for {symbol}")
                    results[symbol] = {"price": None, "change": None, "change_percent": None}
                    continue

                price = float(closes.iloc[-1])
                prev_close = float(closes.iloc[-2]) if len(closes) > 1 else price
                change = price - prev_close
                change_percent = (change / prev_close) * 100 if prev_close != 0 else 0.0

                results[symbol] = {
                    "price": price,
                    "change": change,
                    "change_percent": change_percent,
                }

                redis.setex(f"price:{symbol}", timedelta(minutes=15),
                            f"{price}|{change}|{change_percent}")

            except Exception as e_symbol:
                logger.error(f"Error processing {symbol}: {e_symbol}", exc_info=True)
                results[symbol] = {"price": None, "change": None, "change_percent": None}

        return results

    except Exception as e:
        logger.error(f"Yahoo batch fetch FAILED: {e}", exc_info=True)
        return {s: {"price": None, "change": None, "change_percent": None} for s in symbols}

def get_cached_price(symbol: str) -> Optional[Dict[str, float]]:
    cached = redis.get(f"price:{symbol.upper()}")
    if cached:
        parts = cached.split("|")
        if len(parts) == 3:
            price, change, change_percent = parts
            return {
                "price": float(price),
                "change": float(change),
                "change_percent": float(change_percent),
            }
    return None

# NEW: Yahoo sector fallback (reuses existing yfinance import)
def fetch_yahoo_sector_weightings(symbol: str) -> List[Dict[str, float]]:
    """
    Fallback sector data from yfinance.
    Returns normalized list[{"sector": str, "weight": float (0-1)}]
    On failure: returns [{"sector": "Other", "weight": 1.0}]
    """
    logger.info(f"Yahoo fallback: Fetching sector data for {symbol}")
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info

        logger.info(f"yfinance info keys for {symbol}: {list(info.keys())}")
        logger.info(f"  sectorWeightings: {info.get('sectorWeightings')}")
        logger.info(f"  sector: {info.get('sector')}")

        weightings = []
        if info.get("sectorWeightings"):
            for sector_dict in info["sectorWeightings"]:
                if sector_dict:
                    sec = list(sector_dict.keys())[0].replace("_", " ").title()
                    weight = list(sector_dict.values())[0]
                    weightings.append({"sector": sec, "weight": weight})
        elif info.get("sector"):
            weightings.append({"sector": info["sector"], "weight": 1.0})

        # Normalize
        total = sum(w["weight"] for w in weightings)
        if total > 0:
            for w in weightings:
                w["weight"] = round(w["weight"] / total, 6)
        else:
            logger.warning(f"yfinance total weight 0 for {symbol} – forcing 'Other'")
            weightings = [{"sector": "Other", "weight": 1.0}]

        if weightings and weightings[0]["sector"] != "Other":
            logger.info(f"yfinance success → weightings for {symbol}: {weightings}")
        return weightings

    except Exception as e:
        logger.warning(f"yfinance sector fallback failed for {symbol}: {str(e)}")
        return [{"sector": "Other", "weight": 1.0}]