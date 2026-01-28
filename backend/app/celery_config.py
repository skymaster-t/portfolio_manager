from celery import Celery
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
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Toronto",
    enable_utc=True,
)

# For scheduling (Celery Beat)
celery_app.conf.beat_schedule = {
    "update-stock-prices-every-5-min": {
        "task": "app.tasks.update_stock_prices",
        "schedule": 300.0,  # 5 minutes
    },
}