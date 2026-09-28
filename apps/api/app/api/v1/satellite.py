import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.common import StandardResponse, MetaEnvelope
from app.schemas.satellite import SatelliteObservationResponse
from app.models.enums import ConfidenceLevel
from app.adapters.satellite import SatelliteAdapter

router = APIRouter(tags=["Satellite SAR Inundation"])


@router.get("/satellite/latest", response_model=StandardResponse[SatelliteObservationResponse])
async def get_latest_satellite_observation(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    try:
        raw_list = await adapter.fetch()
        norm = adapter.normalize(raw_list[0]) if raw_list else None
    except Exception:
        norm = None

    hours_age = round((now - norm.observed_at).total_seconds() / 3600.0, 1) if norm else 14.0

    resp_data = SatelliteObservationResponse(
        id=uuid.uuid4(),
        source_id=norm.source if norm else "SRC_COPERNICUS_S1",
        satellite_name=norm.value.get("satellite_name", "SENTINEL-1 C-SAR") if norm else "SENTINEL-1 C-SAR",
        spatial_resolution_meters=norm.value.get("spatial_resolution_meters", 30.0) if norm else 30.0,
        confidence=ConfidenceLevel.HIGH,
        acquisition_at=norm.observed_at if norm else now,
        processed_at=now,
        data_age_hours=hours_age,
        water_polygons_geojson=norm.value.get("water_polygons", {}) if norm else {},
        disclaimer="Observational evidence layer. Not minute-by-minute real-time."
    )

    meta = MetaEnvelope(
        source="SRC_COPERNICUS_S1",
        observed_at=resp_data.acquisition_at,
        ingested_at=now,
        freshness="STALE",  # Explicitly STALE/OBSERVATIONAL
        confidence="HIGH",
        attribution="European Space Agency (ESA) Copernicus / Sentinel-1 SAR",
        mode=norm.extra_metadata.get("mode", "DEMO") if norm else "DEMO"
    )

    return StandardResponse(data=resp_data, meta=meta)
