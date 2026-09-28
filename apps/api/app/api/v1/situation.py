from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.situation import SituationService
from app.schemas.common import StandardResponse, MetaEnvelope
from app.schemas.situation import SituationSummaryResponse

router = APIRouter(tags=["Situation Awareness"])


@router.get("/situation/summary", response_model=StandardResponse[SituationSummaryResponse])
async def get_current_situation(db: AsyncSession = Depends(get_db)):
    summary = await SituationService.get_summary(db)
    now = datetime.now(timezone.utc)

    meta = MetaEnvelope(
        source="KMITL_SITUATION_FUSION_ENGINE",
        observed_at=summary.last_updated,
        ingested_at=now,
        data_age_seconds=int((now - summary.last_updated).total_seconds()),
        freshness="FRESH",
        confidence="HIGH" if summary.data_quality == "HIGH" else "MEDIUM",
        attribution="KMITL Flood Intelligence Platform (Fused from TMD, BMA, and Crowd signals)",
        mode="LIVE"
    )

    return StandardResponse(data=summary, meta=meta)
