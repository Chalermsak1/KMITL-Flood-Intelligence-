from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.core.redis import get_redis_client
from app.core.config import settings

router = APIRouter(tags=["Health & Diagnostics"])


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT
    }


@router.get("/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    checks = {
        "database": "unknown",
        "redis": "unknown"
    }

    # Check Database
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "connected"
    except Exception as e:
        checks["database"] = f"failed: {str(e)}"

    # Check Redis
    try:
        client = await get_redis_client()
        await client.ping()
        checks["redis"] = "connected"
    except Exception as e:
        checks["redis"] = f"failed: {str(e)}"

    is_ready = checks["database"] == "connected" and checks["redis"] == "connected"
    if not is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "degraded", "checks": checks}
        )

    return {
        "status": "ready",
        "checks": checks
    }
