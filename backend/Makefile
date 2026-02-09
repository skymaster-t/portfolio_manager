# backend/Makefile

worker:
	celery -A app.celery_config.celery_app worker --loglevel=info

beat:
	celery -A app.celery_config.celery_app beat --loglevel=info

server:
	uvicorn app.main:app --reload
	