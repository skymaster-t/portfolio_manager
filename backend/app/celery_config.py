# backend/app/celery_config.py (updated: price updates now every 1 minute during allowed window – faster, real-time feel while respecting rate limits & trading hours)
from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv
from pathlib import Path
import os

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

REDIS_URL = os.getenv("REDIS_URL")
if not REDIS_URL:
    raise ValueError("REDIS_URL not found in .env file")

celery_app = Celery(
    "worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Toronto",
    enable_utc=False,
    broker_connection_retry_on_startup=True,
)

celery_app.autodiscover_tasks(['app.tasks'])

try:
    from app.tasks.update_prices import update_all_prices
    from app.tasks.portfolio_history_task import save_portfolio_history_snapshot
    from app.tasks.portfolio_history_task import save_daily_global_snapshot
    from app.tasks.update_symbol_sectors import update_symbol_sectors
except ImportError as e:
    import logging
    logging.warning(f"Could not import tasks: {e}")

celery_app.conf.beat_schedule = {
    "update-stock-prices-every-1-min": {
        "task": "app.tasks.update_prices.update_all_prices",
        "schedule": 60.0,
    },
    "portfolio-history-snapshot": {
        "task": "app.tasks.portfolio_history_task.save_portfolio_history_snapshot",
        "schedule": 300.0,
    },
    "daily-eod-global-snapshot": {
        "task": "app.tasks.portfolio_history_task.save_daily_global_snapshot",
        "schedule": crontab(hour=16, minute=30, day_of_week='mon-fri'),
    },
    "update-symbol-sectors-twice-daily": {
        "task": "app.tasks.update_symbol_sectors.update_symbol_sectors",
        "schedule": crontab(hour='9,21', minute=0),  # 9 AM and 9 PM daily
        # No day_of_week restriction – sector data can update any day (safe & simple)
    },
}