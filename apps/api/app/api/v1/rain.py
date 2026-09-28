from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.common import StandardResponse, MetaEnvelope
from app.schemas.rain import RainObservationResponse
from app.adapters.tmd import TMDAdapter

router = APIRouter(tags=["Rain & Weather Radar"])


@router.get("/rain/current", response_model=StandardResponse[RainObservationResponse])
async def get_current_rain(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    adapter = TMDAdapter()
    raw_list = await adapter.fetch()
    norm = adapter.normalize(raw_list[0]) if raw_list else None

    age_min = max(0, int((now - norm.observed_at).total_seconds() / 60.0)) if norm else 0

    resp_data = RainObservationResponse(
        id=1,
        source_id=norm.source if norm else "SRC_TMD_WEATHER",
        rain_rate_mm_hr=norm.value.get("rain_rate_mm_hr", 18.2) if norm else 18.2,
        rain_intensity_band=norm.value.get("rain_intensity_band", "MODERATE") if norm else "MODERATE",
        reflectivity_dbz=norm.value.get("reflectivity_dbz", 38.0) if norm else 38.0,
        observed_at=norm.observed_at if norm else now,
        data_age_min=age_min,
        coverage_area="Lat Krabang Basin / KMITL Campus"
    )

    meta = MetaEnvelope(
        source="SRC_TMD_WEATHER",
        observed_at=resp_data.observed_at,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="Thai Meteorological Department (TMD)",
        mode=norm.extra_metadata.get("mode", "DEMO") if norm else "DEMO"
    )

    return StandardResponse(data=resp_data, meta=meta)
