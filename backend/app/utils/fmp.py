# backend/app/utils/fmp.py (FULL updated file – primary FMP with Yahoo fallback via new function; production-ready hybrid)
import os
import requests
from fastapi import HTTPException
import logging
from app.utils.yahoo import fetch_yahoo_sector_weightings  # ← NEW: import fallback

logger = logging.getLogger(__name__)

def get_fmp_base_url() -> str:
    base = os.getenv("FMP_BASE_URL", "https://financialmodelingprep.com")
    api_key = os.getenv("FMP_API_KEY")
    if not api_key:
        raise ValueError("FMP_API_KEY missing in .env")
    return base, api_key

def get_fmp_quote_url(symbol: str) -> str:
    base, api_key = get_fmp_base_url()
    return f"{base}/stable/quote?symbol={symbol.upper()}&apikey={api_key}"

def get_etf_sector_weightings_url(symbol: str) -> str:
    base, api_key = get_fmp_base_url()
    return f"{base}/stable/etf/sector-weightings?symbol={symbol.upper()}&apikey={api_key}"

def get_stock_profile_url(symbol: str) -> str:
    base, api_key = get_fmp_base_url()
    return f"{base}/stable/profile?symbol={symbol.upper()}&apikey={api_key}"

def fetch_price_data(symbol: str):
    url = get_fmp_quote_url(symbol)
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if not data or len(data) == 0 or 'price' not in data[0]:
            raise HTTPException(status_code=400, detail=f"No price data returned for {symbol} — check symbol, API key, or subscription")
        quote = data[0]
        return {
            "price": quote.get("price"),
            "change": quote.get("change"),
            "change_percent": quote.get("changePercentage"),
            "open": quote.get("open"),
            "previous_close": quote.get("previousClose"),
            "day_high": quote.get("dayHigh"),
            "day_low": quote.get("dayLow"),
            "volume": quote.get("volume"),
            "name": quote.get("name"),
            "exchange": quote.get("exchange"),
            "timestamp": quote.get("timestamp"),
        }
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"FMP API request failed for {symbol}: {str(e)}")

# HYBRID: Primary FMP → Yahoo fallback if no sectors
def fetch_sector_weightings(symbol: str, is_etf: bool = False):
    """
    Hybrid sector fetch:
    1. FMP free tier (/stable/ query-param endpoints)
    2. If no sectors → Yahoo fallback (reuses existing yfinance)
    3. Final fallback → "Other"
    """
    def try_fmp() -> list:
        if is_etf:
            url = get_etf_sector_weightings_url(symbol)
        else:
            url = get_stock_profile_url(symbol)
        logger.info(f"Primary: FMP sector fetch for {symbol} ({'ETF' if is_etf else 'stock'}): {url}")

        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            logger.info(f"FMP raw response for {symbol}: {data}")

            weightings = []
            if is_etf:
                if not data:
                    return []
                total_pct = sum(item.get("weightPercentage", 0) for item in data)
                if total_pct == 0:
                    return []
                for item in data:
                    sector = item.get("sector")
                    if sector:
                        weight = item.get("weightPercentage", 0) / total_pct
                        weightings.append({"sector": sector, "weight": round(weight, 6)})
            else:
                if not data or not data[0].get("sector"):
                    return []
                weightings.append({"sector": data[0]["sector"], "weight": 1.0})

            if weightings:
                logger.info(f"FMP success → weightings for {symbol}: {weightings}")
                return weightings
            return []

        except requests.RequestException as e:
            logger.warning(f"FMP sector request failed for {symbol}: {str(e)}")
            return []

    fmp_weightings = try_fmp()
    if fmp_weightings:
        return fmp_weightings

    # Yahoo fallback (uses existing yahoo.py yfinance logic)
    yahoo_weightings = fetch_yahoo_sector_weightings(symbol)
    if yahoo_weightings and yahoo_weightings[0]["sector"] != "Other":
        return yahoo_weightings

    # Final fallback
    logger.warning(f"Both FMP & Yahoo failed → forcing 'Other' for {symbol}")
    return [{"sector": "Other", "weight": 1.0}]