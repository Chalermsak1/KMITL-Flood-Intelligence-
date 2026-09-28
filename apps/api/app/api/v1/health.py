import time
from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.core.redis import get_redis_client
from app.core.queue import job_queue
from app.core.config import settings

router = APIRouter(tags=["Health & Diagnostics"])


@router.get("/health")
async def health_check():
    """General health check for backward compatibility."""
    return {
        "status": "ok",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/health/live")
async def liveness_check():
    """Liveness probe: verifies process is alive and responsive."""
    return {
        "status": "live",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/ready")
@router.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """
    Readiness probe: verifies ONLY required dependencies needed to serve traffic.
    Fails ONLY if database or cache/queue are unavailable.
    Optional external adapters (TMD, BMA, Traffy) do NOT degrade readiness.
    """
    required_checks: Dict[str, str] = {
        "database": "unknown",
        "redis": "unknown"
    }

    # 1. Required: Database
    try:
        start = time.time()
        await db.execute(text("SELECT 1"))
        db_lat = int((time.time() - start) * 1000)
        required_checks["database"] = f"connected ({db_lat}ms)"
    except Exception as e:
        required_checks["database"] = f"failed: {str(e)}"

    # 2. Required: Redis / Valkey
    try:
        start = time.time()
        client = await get_redis_client()
        await client.ping()
        redis_lat = int((time.time() - start) * 1000)
        required_checks["redis"] = f"connected ({redis_lat}ms)"
    except Exception as e:
        required_checks["redis"] = f"failed: {str(e)}"

    is_ready = all("connected" in v for v in required_checks.values())
    if not is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unready",
                "required_checks": required_checks,
                "message": "Critical dependency failure. Service cannot accept traffic."
            }
        )

    return {
        "status": "ready",
        "required_checks": required_checks,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/health/deps")
async def dependency_health_check(db: AsyncSession = Depends(get_db)):
    """
    Comprehensive dependency health:
    Explicitly tracks required vs optional upstream services with latencies and failure impact.
    """
    now = datetime.now(timezone.utc)
    deps: Dict[str, Any] = {}

    # 1. PostgreSQL + PostGIS (Required)
    try:
        t0 = time.time()
        await db.execute(text("SELECT 1"))
        lat = int((time.time() - t0) * 1000)
        deps["database"] = {
            "required": True,
            "status": "HEALTHY",
            "type": "PostgreSQL 16 + PostGIS 3.4",
            "latency_ms": lat
        }
    except Exception as e:
        deps["database"] = {
            "required": True,
            "status": "UNAVAILABLE",
            "type": "PostgreSQL 16 + PostGIS 3.4",
            "error": str(e)
        }

    # 2. Redis Cache / PubSub (Required)
    try:
        t0 = time.time()
        client = await get_redis_client()
        await client.ping()
        lat = int((time.time() - t0) * 1000)
        deps["redis"] = {
            "required": True,
            "status": "HEALTHY",
            "type": "Redis / Valkey PubSub & Fast Cache",
            "latency_ms": lat
        }
    except Exception as e:
        deps["redis"] = {
            "required": True,
            "status": "UNAVAILABLE",
            "type": "Redis / Valkey PubSub & Fast Cache",
            "error": str(e)
        }

    # 3. Multi-tier Queue (Required)
    queue_stats = await job_queue.get_stats()
    deps["queue"] = {
        "required": True,
        "status": "HEALTHY" if queue_stats["tier2_redis"]["available"] or queue_stats["tier3_disk_spool"]["path"] else "DEGRADED",
        "tier1_sqs": queue_stats["tier1_sqs"],
        "tier2_redis": queue_stats["tier2_redis"],
        "tier3_disk_spool": queue_stats["tier3_disk_spool"]
    }

    # 4. Object Storage (Optional / Configured)
    s3_bucket = getattr(settings, "S3_BUCKET_NAME", "")
    deps["object_storage"] = {
        "required": False,
        "status": "CONFIGURED" if s3_bucket else "LOCAL_EMBEDDED",
        "bucket": s3_bucket or "local_filesystem"
    }

    # 5. External Adapters (Optional with graceful fallbacks)
    has_tmd = bool(settings.TMD_UID and settings.TMD_UKEY and settings.FEATURE_FLAG_TMD_LIVE)
    deps["tmd_weather"] = {
        "required": False,
        "status": "LIVE" if has_tmd else "PENDING_ACCESS",
        "fallback_mode": "CALIBRATED_SCENARIO_RADAR",
        "impact": "Graceful degradation: local radar model active"
    }

    has_bma = bool(settings.BMA_API_KEY and settings.FEATURE_FLAG_BMA_LIVE)
    deps["bma_drainage"] = {
        "required": False,
        "status": "LIVE" if has_bma else "PENDING_ACCESS",
        "fallback_mode": "CALIBRATED_DRAINAGE_MODEL",
        "impact": "Graceful degradation: hydraulic drainage model active"
    }

    has_traffy = bool(settings.TRAFFY_API_KEY and settings.FEATURE_FLAG_TRAFFY_LIVE)
    deps["traffy_fondue"] = {
        "required": False,
        "status": "LIVE" if has_traffy else "PENDING_ACCESS",
        "fallback_mode": "HISTORICAL_VERIFIED_TICKETS",
        "impact": "Graceful degradation: verified historical flood tickets active"
    }

    deps["copernicus_s1"] = {
        "required": False,
        "status": "OBSERVATION",
        "revisit_cadence": "6-12 days",
        "impact": "Observational SAR flood layer. Never used as real-time minute depth."
    }

    overall_healthy = (
        deps["database"]["status"] == "HEALTHY" and
        deps["redis"]["status"] == "HEALTHY"
    )

    return {
        "overall_status": "HEALTHY" if overall_healthy else "DEGRADED",
        "dependencies": deps,
        "timestamp": now.isoformat()
    }
