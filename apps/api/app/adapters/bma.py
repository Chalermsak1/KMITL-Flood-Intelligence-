from datetime import datetime, timezone, timedelta
from typing import Any, List
from app.adapters.base import DataSourceAdapter, NormalizedRecord, HealthCheckResult


class BMAAdapter(DataSourceAdapter):
    def __init__(self):
        super().__init__(source_id="SRC_BMA_DDS", name="BMA Department of Drainage and Sewerage")

    async def fetch(self) -> List[Any]:
        # BMA DDS Telemetry feed mock fallback representing actual Lat Krabang canals
        now = datetime.now(timezone.utc)
        return [
            {
                "station_id": "BMA_STN_PRAWET_LOCK",
                "name": "ประตูระบายน้ำคลองประเวศบุรีรมย์ (ลาดกระบัง)",
                "lat": 13.7215,
                "lng": 100.7850,
                "station_type": "CANAL_GAUGE",
                "water_level_m_msl": 0.88,
                "delta_10m": 0.04,
                "delta_30m": 0.12,
                "delta_60m": 0.22,
                "trend": "RISING",
                "warning_threshold": 0.80,
                "critical_threshold": 1.20,
                "observed_at": now - timedelta(minutes=4),
                "is_demo": True
            },
            {
                "station_id": "BMA_STN_LAM_PLA_THIO",
                "name": "สถานีวัดระดับน้ำคลองลำปลาทิว (นิคมอุตสาหกรรมลาดกระบัง)",
                "lat": 13.7480,
                "lng": 100.7930,
                "station_type": "CANAL_GAUGE",
                "water_level_m_msl": 0.72,
                "delta_10m": 0.01,
                "delta_30m": 0.05,
                "delta_60m": 0.08,
                "trend": "RISING",
                "warning_threshold": 0.75,
                "critical_threshold": 1.10,
                "observed_at": now - timedelta(minutes=6),
                "is_demo": True
            },
            {
                "station_id": "BMA_STN_HUA_TAKHE",
                "name": "สถานีวัดระดับน้ำคลองหัวตะเข้ (ชุมชนตลาดเก่า)",
                "lat": 13.7230,
                "lng": 100.7890,
                "station_type": "CANAL_GAUGE",
                "water_level_m_msl": 0.65,
                "delta_10m": 0.02,
                "delta_30m": 0.04,
                "delta_60m": 0.06,
                "trend": "STABLE",
                "warning_threshold": 0.70,
                "critical_threshold": 1.05,
                "observed_at": now - timedelta(minutes=5),
                "is_demo": True
            }
        ]

    def normalize(self, raw: Any) -> NormalizedRecord:
        is_demo = raw.get("is_demo", True)
        return NormalizedRecord(
            source=self.source_id if not is_demo else "SRC_BMA_DDS_MOCK",
            source_type="BMA_WATER",
            location={
                "type": "Point",
                "coordinates": [raw["lng"], raw["lat"]]
            },
            observed_at=raw["observed_at"],
            value={
                "station_id": raw["station_id"],
                "name": raw["name"],
                "station_type": raw["station_type"],
                "water_level_m_msl": raw["water_level_m_msl"],
                "delta_10m": raw["delta_10m"],
                "delta_30m": raw["delta_30m"],
                "delta_60m": raw["delta_60m"],
                "trend": raw["trend"],
                "warning_threshold": raw["warning_threshold"],
                "critical_threshold": raw["critical_threshold"]
            },
            extra_metadata={
                "mode": "DEMO" if is_demo else "LIVE",
                "attribution": "Bangkok Metropolitan Administration (DDS)",
                "note": "Canal water stage indicates drainage capacity; not direct street ponding depth."
            },
            freshness="FRESH",
            confidence="HIGH"
        )

    async def health_check(self) -> HealthCheckResult:
        return HealthCheckResult(
            source_id=self.source_id,
            status="AVAILABLE",
            latency_ms=15,
            message="Mock Provider active (mode: DEMO - official DDS API pending agreement)",
            mode="DEMO"
        )
