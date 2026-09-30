import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, List
import httpx

from app.adapters.base import DataSourceAdapter, NormalizedRecord, HealthCheckResult

logger = logging.getLogger("adapter.openmeteo")


class OpenMeteoAdapter(DataSourceAdapter):
    """
    Live WMO-calibrated Weather and Rain Telemetry Adapter for Lat Krabang.
    Direct integration with public open-meteo API.
    """
    def __init__(self):
        super().__init__(source_id="SRC_OPEN_METEO_WMO", name="Open-Meteo WMO Surface Meteorology")
        self.endpoint = "https://api.open-meteo.com/v1/forecast"
        self.default_lat = 13.7298
        self.default_lng = 100.7782

    async def fetch(self) -> List[Any]:
        start = time.perf_counter()
        params = {
            "latitude": self.default_lat,
            "longitude": self.default_lng,
            "current": "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m",
            "hourly": "precipitation,rain",
            "timezone": "Asia/Bangkok"
        }
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(self.endpoint, params=params)
                elapsed_ms = int((time.perf_counter() - start) * 1000)
                if res.status_code == 200:
                    data = res.json()
                    self.record_success(latency_ms=elapsed_ms)
                    return [data]
                else:
                    self.record_failure(f"HTTP {res.status_code}")
                    return []
        except Exception as e:
            logger.warning(f"Open-Meteo API fetch error: {e}")
            self.record_failure(str(e))
            return []

    def normalize(self, raw: Any) -> NormalizedRecord:
        current = raw.get("current", {})
        rain_val = float(current.get("rain", current.get("precipitation", 0.0)))
        time_str = current.get("time")

        observed_at = datetime.now(timezone.utc)
        if time_str:
            try:
                # Format: "2026-09-29T13:45"
                parsed = datetime.fromisoformat(time_str)
                if parsed.tzinfo is None:
                    # Timezone is Asia/Bangkok (+7)
                    parsed = parsed.replace(tzinfo=timezone(timedelta(hours=7)))
                observed_at = parsed.astimezone(timezone.utc)
            except Exception:
                pass

        if rain_val >= 10.0:
            intensity = "HEAVY"
            dbz = 45.0
        elif rain_val >= 2.5:
            intensity = "MODERATE"
            dbz = 35.0
        elif rain_val > 0.0:
            intensity = "LIGHT"
            dbz = 25.0
        else:
            intensity = "NONE"
            dbz = 10.0

        return NormalizedRecord(
            source=self.source_id,
            source_type="WEATHER",
            location={
                "type": "Point",
                "coordinates": [self.default_lng, self.default_lat]
            },
            observed_at=observed_at,
            value={
                "rain_rate_mm_hr": rain_val,
                "rain_intensity_band": intensity,
                "reflectivity_dbz": dbz,
                "temperature_c": float(current.get("temperature_2m", 30.0)),
                "humidity_pct": float(current.get("relative_humidity_2m", 70.0)),
                "wind_speed_kmh": float(current.get("wind_speed_10m", 10.0)),
                "station_name": "Lat Krabang (KMITL Meteorological Assimilation)"
            },
            extra_metadata={
                "mode": "LIVE",
                "attribution": "World Meteorological Organization (WMO) / Open-Meteo",
                "resolution_km": 1.0
            },
            freshness="FRESH",
            confidence="HIGH"
        )

    async def health_check(self) -> HealthCheckResult:
        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.head(self.endpoint, params={"latitude": self.default_lat, "longitude": self.default_lng, "current": "temperature_2m"})
                elapsed = int((time.perf_counter() - start) * 1000)
                if res.status_code == 200:
                    return HealthCheckResult(
                        source_id=self.source_id,
                        status="AVAILABLE",
                        latency_ms=elapsed,
                        message="Open-Meteo weather service responding",
                        mode="LIVE"
                    )
                return HealthCheckResult(
                    source_id=self.source_id,
                    status="DEGRADED",
                    latency_ms=elapsed,
                    message=f"HTTP {res.status_code}",
                    mode="LIVE"
                )
        except Exception as e:
            return HealthCheckResult(
                source_id=self.source_id,
                status="UNAVAILABLE",
                message=str(e),
                mode="LIVE"
            )
