# backend/app/utils/yahoo.py
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
                # Always get 'Close' column
                closes = data['Close']

                # If multi-symbol, select the column for this symbol
                if isinstance(closes, pd.DataFrame):
                    if symbol not in closes.columns:
                        logger.warning(f"Yahoo Finance: No Close data for {symbol}")
                        results[symbol] = {"price": None, "change": None, "change_percent": None}
                        continue
                    closes = closes[symbol]

                # Now closes is always a Series
                closes = closes.dropna()
                if closes.empty:
                    logger.warning(f"Yahoo Finance: No valid close prices for {symbol}")
                    results[symbol] = {"price": None, "change": None, "change_percent": None}
                    continue

                price = float(closes.iloc[-1])
                prev_close = float(closes.iloc[-2]) if len(closes) > 1 else price
                change = price - prev_close
                change_percent = (change / prev_close) * 100 if prev_close != 0 else 0.0

                logger.info(f"Yahoo Finance SUCCESS {symbol}: price={price:.4f}, change={change:+.4f}, change%={change_percent:+.2f}%")

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