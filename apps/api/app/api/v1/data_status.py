from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.data_health import DataSourceHealthService
from app.schemas.common import StandardResponse, MetaEnvelope

router = APIRouter(tags=["Data Governance & Health"])


@router.get("/data-status")
async def get_data_sources_status(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    try:
        sources = await DataSourceHealthService.get_all_sources_status(db)
    except Exception:
        sources = DataSourceHealthService.get_static_sources()

    meta = MetaEnvelope(
        source="KMITL Data Source Health Registry",
        observed_at=now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Flood Intelligence Observability Hub",
        mode="LIVE"
    )

    governance = DataSourceHealthService.get_governance_status()
    return StandardResponse(data={"sources": sources, "governance": governance}, meta=meta)
