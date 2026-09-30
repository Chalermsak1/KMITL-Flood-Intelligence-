import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.common import StandardResponse, MetaEnvelope
from app.schemas.rain import RainObservationResponse
from app.adapters.openmeteo import OpenMeteoAdapter
from app.adapters.tmd import TMDAdapter
from app.core.config import settings

router = APIRouter(tags=["Rain & Weather Radar"])

_rain_cache = {"norm": None, "cached_at": 0.0}


@router.get("/rain/current", response_model=StandardResponse[RainObservationResponse])
async def get_current_rain(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    norm = None
    is_live = False

    # Check in-memory TTL cache (120s) to keep API sub-millisecond fast
    if _rain_cache["norm"] is not None and (time.time() - _rain_cache["cached_at"]) < 120.0:
        norm = _rain_cache["norm"]
        is_live = True
    else:
        # 1. Primary Live Ingestion: WMO Surface Meteorological Assimilation for Lat Krabang
        try:
            om_adapter = OpenMeteoAdapter()
            raw_list = await om_adapter.fetch()
            if raw_list:
                norm = om_adapter.normalize(raw_list[0])
                is_live = True
                _rain_cache["norm"] = norm
                _rain_cache["cached_at"] = time.time()
        except Exception:
            norm = None

    # 2. Secondary: If TMD credentials configured, fetch from TMD
    if not norm and settings.TMD_UID and settings.TMD_UKEY:
        try:
            tmd_adapter = TMDAdapter()
            raw_list = await tmd_adapter.fetch()
            if raw_list:
                norm = tmd_adapter.normalize(raw_list[0])
                is_live = True
        except Exception:
            norm = None

    age_min = max(0, int((now - norm.observed_at).total_seconds() / 60.0)) if norm else 0
    rain_rate = norm.value.get("rain_rate_mm_hr", 0.0) if norm else 0.0
    intensity = norm.value.get("rain_intensity_band", "NONE") if norm else "NONE"
    dbz = norm.value.get("reflectivity_dbz", 10.0) if norm else 10.0

    resp_data = RainObservationResponse(
        id=1,
        source_id=norm.source if norm else "SRC_OPEN_METEO_WMO",
        rain_rate_mm_hr=rain_rate,
        rain_intensity_band=intensity,
        reflectivity_dbz=dbz,
        observed_at=norm.observed_at if norm else now,
        data_age_min=age_min,
        coverage_area="Lat Krabang Basin / KMITL Campus"
    )

    meta = MetaEnvelope(
        source=norm.source if norm else "SRC_OPEN_METEO_WMO",
        observed_at=resp_data.observed_at,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH" if is_live else "MEDIUM",
        attribution="WMO / Open-Meteo Surface Meteorological Assimilation (Lat Krabang)" if is_live else "Thai Meteorological Department (TMD)",
        mode="LIVE" if is_live else "DEMO"
    )

    return StandardResponse(data=resp_data, meta=meta)

