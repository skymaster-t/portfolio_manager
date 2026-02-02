from celery import Celery

# Create the Celery app
celery_app = Celery(
    "portfolio_worker",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
    include=["app.tasks.update_prices"]  # Auto-discover tasks in this module
)

# Production-ready config
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Toronto",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
)

# Beat schedule - runs every 10 minutes
celery_app.conf.beat_schedule = {
    "update-prices-every-10-minutes": {
        "task": "app.tasks.update_prices.update_all_prices",
        "schedule": 600.0,  # 600 seconds = 10 minutes
    },
}