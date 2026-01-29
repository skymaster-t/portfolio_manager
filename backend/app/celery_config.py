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
    backend=REDIS_URL,
    include=["app.tasks.update_prices"]  # Explicitly include the tasks module
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Toronto",
    enable_utc=True,
)

# Auto-discover tasks in app.tasks package (scalable for future tasks)
celery_app.autodiscover_tasks(['app.tasks'])

# Beat schedule
celery_app.conf.beat_schedule = {
    "update-stock-prices-every-15-min": {
        "task": "app.tasks.update_all_prices",  # Matches @celery_app.task decorator name
        "schedule": 900.0,  # 15 minutes
    },
}