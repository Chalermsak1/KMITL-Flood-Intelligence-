import time
from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import redis.asyncio as aioredis

from app.core.config import settings
from app.core.database import get_db
from app.core.queue import job_queue, QUEUE_KEY, QUEUE_DLQ
from app.schemas.common import StandardResponse, MetaEnvelope

router = APIRouter(tags=["Observability & Health"])


@router.get("/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """
    Kubernetes / ECS readiness check verifying live connections to:
    - PostgreSQL + PostGIS
    - Redis Cache & PubSub
    """
    checks = {"database": "FAILED", "redis": "FAILED"}
    try:
        # Check DB
        res = await db.execute(text("SELECT 1;"))
        if res.scalar() == 1:
            checks["database"] = "HEALTHY"
    except Exception as e:
        checks["database_error"] = str(e)

    try:
        # Check Redis
        r = await job_queue.get_redis()
        pong = await r.ping()
        if pong:
            checks["redis"] = "HEALTHY"
    except Exception as e:
        checks["redis_error"] = str(e)

    if checks["database"] != "HEALTHY" or checks["redis"] != "HEALTHY":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "UNHEALTHY", "checks": checks}
        )

    return {"status": "READY", "checks": checks, "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/metrics")
async def telemetry_metrics(db: AsyncSession = Depends(get_db)):
    """
    System Metrics endpoint tracking:
    - Active reports count
    - Active incidents count
    - Queue backlog & DLQ sizes
    - DB latency
    """
    now = datetime.now(timezone.utc)
    db_latency_ms = 0.0
    db_status = "OFFLINE"
    try:
        t0 = time.time()
        await db.execute(text("SELECT 1;"))
        db_latency_ms = round((time.time() - t0) * 1000, 2)
        db_status = "UP"
    except Exception:
        db_status = "OFFLINE"
        db_latency_ms = 0.0

    # Queue sizes
    queue_backlog = 0
    dlq_size = 0
    try:
        r = await job_queue.get_redis()
        queue_backlog = await r.llen(QUEUE_KEY)
        dlq_size = await r.llen(QUEUE_DLQ)
    except Exception:
        pass

    # Incident and Report counts
    reports_count = 0
    incidents_count = 0
    try:
        rep_res = await db.execute(text("SELECT count(*) FROM flood_reports WHERE expires_at > NOW();"))
        reports_count = rep_res.scalar() or 0
        inc_res = await db.execute(text("SELECT count(*) FROM incidents WHERE status = 'ACTIVE';"))
        incidents_count = inc_res.scalar() or 0
    except Exception:
        pass

    metrics_data = {
        "service": "kmitl-flood-intelligence-api",
        "timestamp": now.isoformat(),
        "database": {
            "status": db_status,
            "latency_ms": db_latency_ms
        },
        "queue": {
            "backlog_jobs": queue_backlog,
            "dead_letter_jobs": dlq_size
        },
        "incidents": {
            "active_count": incidents_count
        },
        "reports": {
            "active_count": reports_count
        }
    }

    meta = MetaEnvelope(
        source="KMITL Prometheus/CloudWatch Telemetry Exporter",
        observed_at=now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Observability Service",
        mode="LIVE"
    )

    return StandardResponse(data=metrics_data, meta=meta)
