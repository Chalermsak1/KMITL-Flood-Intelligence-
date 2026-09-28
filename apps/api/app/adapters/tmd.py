import time
from datetime import datetime, timezone, timedelta
from typing import Any, List
import httpx

from app.adapters.base import DataSourceAdapter, NormalizedRecord, HealthCheckResult
from app.core.config import settings


class TMDAdapter(DataSourceAdapter):
    def __init__(self):
        super().__init__(source_id="SRC_TMD_WEATHER", name="Thai Meteorological Department")
        self.endpoint = "https://data.tmd.go.th/api/WeatherToday/V2/"

    async def fetch(self) -> List[Any]:
        # If API key is provided, attempt live fetch with timeout and fallback
        if settings.TMD_UID and settings.TMD_UKEY:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(
                        self.endpoint,
                        params={"uid": settings.TMD_UID, "ukey": settings.TMD_UKEY, "format": "json"}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        stations = data.get("Stations", [])
                        # Filter to Bangkok / Suvarnabhumi if available
                        return stations or [data]
            except Exception:
                pass  # Gracefully fall back to Mock Demo

        # Mock Fallback Provider (Tagged explicitly with mode: DEMO)
        return [
            {
                "StationNameTh": "สถานีอุตุนิยมวิทยาสุวรรณภูมิ (ลาดกระบัง)",
                "StationNameEng": "Suvarnabhumi Station (Lat Krabang)",
                "Latitude": 13.6900,
                "Longitude": 100.7500,
                "Rainfall24Hr": 48.5,
                "RainfallRate": 18.2,  # mm/hr
                "RainIntensity": "MODERATE",
                "ReflectivityDbz": 38.0,
                "ObservationTime": datetime.now(timezone.utc) - timedelta(minutes=7),
                "IsDemo": True
            }
        ]

    def normalize(self, raw: Any) -> NormalizedRecord:
        is_demo = raw.get("IsDemo", False)
        observed_at = raw.get("ObservationTime", datetime.now(timezone.utc))
        if isinstance(observed_at, str):
            try:
                observed_at = datetime.fromisoformat(observed_at)
            except Exception:
                observed_at = datetime.now(timezone.utc)

        return NormalizedRecord(
            source=self.source_id if not is_demo else "SRC_TMD_WEATHER_MOCK",
            source_type="TMD",
            location={
                "type": "Point",
                "coordinates": [float(raw.get("Longitude", 100.7782)), float(raw.get("Latitude", 13.7298))]
            },
            observed_at=observed_at,
            value={
                "rain_rate_mm_hr": float(raw.get("RainfallRate", 0.0)),
                "rain_intensity_band": raw.get("RainIntensity", "MODERATE"),
                "reflectivity_dbz": float(raw.get("ReflectivityDbz", 35.0)),
                "rainfall_24hr_mm": float(raw.get("Rainfall24Hr", 0.0)),
                "station_name": raw.get("StationNameTh", "Suvarnabhumi")
            },
            extra_metadata={
                "mode": "DEMO" if is_demo else "LIVE",
                "attribution": "Thai Meteorological Department (Open Data)",
                "note": "Radar reflectivity & station rain gauge. Not surface road water depth."
            },
            freshness="FRESH",
            confidence="HIGH" if not is_demo else "MEDIUM"
        )

    async def health_check(self) -> HealthCheckResult:
        if not (settings.TMD_UID and settings.TMD_UKEY):
            return HealthCheckResult(
                source_id=self.source_id,
                status="DEGRADED",
                message="No TMD UID/UKEY configured; using validated MockProvider (mode: DEMO)",
                mode="DEMO"
            )
        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(self.endpoint, params={"uid": settings.TMD_UID, "ukey": settings.TMD_UKEY})
                elapsed = int((time.perf_counter() - start) * 1000)
                if res.status_code == 200:
                    return HealthCheckResult(source_id=self.source_id, status="AVAILABLE", latency_ms=elapsed, mode="LIVE")
                return HealthCheckResult(source_id=self.source_id, status="DEGRADED", latency_ms=elapsed, message=f"HTTP {res.status_code}", mode="DEMO")
        except Exception as e:
            return HealthCheckResult(source_id=self.source_id, status="UNAVAILABLE", message=str(e), mode="DEMO")
