import os
import requests
from fastapi import HTTPException

def get_fmp_quote_url(symbol: str) -> str:
    base = os.getenv("FMP_BASE_URL", "https://financialmodelingprep.com")
    api_key = os.getenv("FMP_API_KEY")
    if not api_key:
        raise ValueError("FMP_API_KEY missing in .env")
    # Correct stable endpoint uses query param ?symbol=
    return f"{base}/stable/quote?symbol={symbol.upper()}&apikey={api_key}"

def fetch_price_data(symbol: str):
    url = get_fmp_quote_url(symbol)
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()  # Raise for HTTP errors
        data = resp.json()
        if not data or len(data) == 0 or 'price' not in data[0]:
            raise HTTPException(status_code=400, detail=f"No price data returned for {symbol} — check symbol, API key, or subscription")
        quote = data[0]
        return {
            "price": quote.get("price"),
            "change": quote.get("change"),
            "change_percent": quote.get("changePercentage"),
        }
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"FMP API request failed for {symbol}: {str(e)}")