.PHONY: help up down build logs test migrate seed clean

help:
	@echo "KMITL Flood Intelligence - CLI Commands"
	@echo "========================================"
	@echo "make up        - Start all services (db, redis, api, web) via Docker Compose"
	@echo "make down      - Stop all running services"
	@echo "make build     - Rebuild docker containers"
	@echo "make logs      - Follow container logs"
	@echo "make test      - Run backend unit and integration test suite"
	@echo "make migrate   - Apply Alembic database migrations"
	@echo "make seed      - Seed initial baseline data sources and shelters"
	@echo "make clean     - Remove cached pyc, node_modules, and docker volumes"

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

migrate:
	docker compose exec api alembic upgrade head

seed:
	docker compose exec api python -m app.scripts.seed_data

test:
	docker compose exec api pytest -v

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
