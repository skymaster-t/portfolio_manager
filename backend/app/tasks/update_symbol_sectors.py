# backend/app/tasks/update_symbol_sectors.py (FULL updated file – now uses FMP instead of yfinance)
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Holding, UnderlyingHolding, SymbolSectorCache, HoldingType
from app.celery_config import celery_app
from app.utils.fmp import fetch_sector_weightings
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

celery = celery_app

@celery.task(name="app.tasks.update_symbol_sectors.update_symbol_sectors")
def update_symbol_sectors():
    db: Session = SessionLocal()
    try:
        # Collect all unique symbols with their type context
        # Main holdings: need type to decide ETF vs stock
        main_symbols = db.query(Holding.symbol, Holding.type).distinct().all()
        # Underlyings: treat as stocks (single sector)
        underlying_symbols = [u[0] for u in db.query(UnderlyingHolding.symbol).distinct().all()]

        all_symbols = set(sym for sym, _ in main_symbols) | set(underlying_symbols)
        logger.info(f"Updating sector data for {len(all_symbols)} unique symbols")

        # Process main holdings (respect ETF vs stock)
        for symbol, holding_type in main_symbols:
            is_etf = holding_type == HoldingType.etf
            weightings = fetch_sector_weightings(symbol, is_etf=is_etf)

            cache = db.query(SymbolSectorCache).get(symbol)
            if cache:
                cache.weightings = weightings
                cache.last_updated = datetime.utcnow()
            else:
                db.add(SymbolSectorCache(
                    symbol=symbol,
                    weightings=weightings,
                    last_updated=datetime.utcnow()
                ))

        # Process underlyings (always as stocks)
        for symbol in underlying_symbols:
            if symbol in [s for s, _ in main_symbols]:  # Skip if already processed as main
                continue
            weightings = fetch_sector_weightings(symbol, is_etf=False)

            cache = db.query(SymbolSectorCache).get(symbol)
            if cache:
                cache.weightings = weightings
                cache.last_updated = datetime.utcnow()
            else:
                db.add(SymbolSectorCache(
                    symbol=symbol,
                    weightings=weightings,
                    last_updated=datetime.utcnow()
                ))

        db.commit()
        logger.info("FMP sector cache update completed successfully")

    except Exception as e:
        db.rollback()
        logger.error(f"Sector cache task failed: {e}", exc_info=True)
    finally:
        db.close()