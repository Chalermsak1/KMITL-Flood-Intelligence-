from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.entities import DataSource
from app.adapters import TMDAdapter, BMAAdapter, TraffyAdapter, SatelliteAdapter


SHORT_NAME_MAP = {
    "SRC_TMD_WEATHER": "TMD",
    "SRC_BMA_DDS": "BMA",
    "SRC_TRAFFY_FONDUE": "TRAFFY",
    "SRC_COPERNICUS_S1": "SATELLITE"
}


class DataSourceHealthService:
    @classmethod
    def get_static_sources(cls) -> List[Dict[str, Any]]:
        return [
            {
                "source_id": "SRC_TMD_WEATHER",
                "name": "TMD",
                "full_name": "Thai Meteorological Department",
                "status": "LIVE",
                "mode": "LIVE",
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "data_age_seconds": 120,
                "latency_ms": 320,
                "error_rate": 0.0,
                "notes": "TMD Open Weather API & KMITL Weather Station",
                "is_satellite_observational": False
            },
            {
                "source_id": "SRC_BMA_DDS",
                "name": "BMA",
                "full_name": "BMA Department of Drainage and Sewerage",
                "status": "PENDING_ACCESS",
                "mode": "DEMO",
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "data_age_seconds": 300,
                "latency_ms": 45,
                "error_rate": 0.0,
                "notes": "Developer token pending official BMA agreement. Mock telemetry used for demo.",
                "is_satellite_observational": False
            },
            {
                "source_id": "SRC_TRAFFY_FONDUE",
                "name": "TRAFFY",
                "full_name": "Traffy Fondue Platform",
                "status": "MOCK_ONLY",
                "mode": "DEMO",
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "data_age_seconds": 600,
                "latency_ms": 110,
                "error_rate": 0.0,
                "notes": "Live API requires NECTEC OAuth2 token. Static historical sample active.",
                "is_satellite_observational": False
            },
            {
                "source_id": "SRC_COPERNICUS_S1",
                "name": "SATELLITE",
                "full_name": "Copernicus Sentinel-1 SAR",
                "status": "AVAILABLE",
                "mode": "OBSERVATION",
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "data_age_seconds": 3600 * 14,
                "latency_ms": 850,
                "error_rate": 0.0,
                "notes": "Copernicus Data Space STAC API. Observational SAR evidence (6-12 day revisit).",
                "is_satellite_observational": True
            }
        ]

    @classmethod
    async def get_all_sources_status(cls, session: Optional[AsyncSession] = None) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        adapters = [TMDAdapter(), BMAAdapter(), TraffyAdapter(), SatelliteAdapter()]

        results = []
        for adapter in adapters:
            health = await adapter.health_check()

            db_source = None
            if session:
                try:
                    stmt = select(DataSource).where(DataSource.id == adapter.source_id)
                    db_source = (await session.execute(stmt)).scalar_one_or_none()
                except Exception:
                    db_source = None

            last_success = db_source.last_success_at if db_source else now
            age_sec = int((now - last_success).total_seconds()) if last_success else None

            mode = health.mode
            is_satellite = adapter.source_id == "SRC_COPERNICUS_S1"
            if is_satellite:
                mode = "OBSERVATION"

            results.append({
                "source_id": adapter.source_id,
                "name": SHORT_NAME_MAP.get(adapter.source_id, adapter.name),
                "full_name": adapter.name,
                "status": health.status,
                "mode": mode,
                "last_updated": last_success.isoformat() if last_success else None,
                "data_age_seconds": age_sec,
                "latency_ms": health.latency_ms or 25,
                "error_rate": 0.0,
                "notes": health.message,
                "is_satellite_observational": is_satellite
            })

        return results
