# backend/app/celery_config.py (updated: EOD snapshot now runs at 4:30 PM ET)
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
    from app.tasks.update_prices import update_all_prices  # noqa: F401
    from app.tasks.portfolio_history_task import save_portfolio_history_snapshot  # noqa: F401
    from app.tasks.portfolio_history_task import save_daily_global_snapshot  # noqa: F401
except ImportError as e:
    import logging
    logging.warning(f"Could not import tasks: {e}")

celery_app.conf.beat_schedule = {
    "update-stock-prices-every-5-min": {
        "task": "app.tasks.update_prices.update_all_prices",
        "schedule": 300.0,  # every 5 minutes
    },
    "portfolio-history-snapshot": {
        "task": "app.tasks.portfolio_history_task.save_portfolio_history_snapshot",
        "schedule": 300.0,  # every 5 minutes (restricted internally to 8AM-9PM on trading days)
    },
    "daily-eod-global-snapshot": {
        "task": "app.tasks.portfolio_history_task.save_daily_global_snapshot",
        "schedule": crontab(
            hour=16,      # 4:00 PM ET
            minute=30,    # 4:30 PM ET – 30 minutes after market close
            day_of_week='mon-fri',
        ),
        # Note: Task itself also checks _was_trading_day() to skip holidays
    },
}