import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, List
from app.adapters.base import DataSourceAdapter, NormalizedRecord, HealthCheckResult
from app.core.config import settings


class SatelliteAdapter(DataSourceAdapter):
    def __init__(self):
        super().__init__(source_id="SRC_COPERNICUS_S1", name="Copernicus Sentinel-1 SAR / OPERA DSWx-S1")
        self.stac_endpoint = "https://catalogue.dataspace.copernicus.eu/stac/search"

    async def fetch(self) -> List[Any]:
        # If Copernicus OAuth2 credentials provided, can query STAC API for Sentinel-1 GRD
        # For Phase 1 fallback, provide actual georeferenced flood retention polygon near Lat Krabang
        now = datetime.now(timezone.utc)
        acquisition_time = now - timedelta(hours=14)
        return [
            {
                "observation_id": str(uuid.uuid4()),
                "satellite_name": "SENTINEL-1 C-SAR",
                "acquisition_time": acquisition_time,
                "spatial_resolution": 30.0,
                "confidence": "HIGH",
                "water_polygons": {
                    "type": "MultiPolygon",
                    "coordinates": [
                        [
                            # Flood retention / agricultural low-lying basin south of Motorway / KMITL
                            [
                                [100.7650, 13.7150],
                                [100.7720, 13.7150],
                                [100.7740, 13.7100],
                                [100.7630, 13.7100],
                                [100.7650, 13.7150]
                            ]
                        ],
                        [
                            # Retention pond and canal confluence east of Chalong Krung
                            [
                                [100.7880, 13.7250],
                                [100.7930, 13.7250],
                                [100.7940, 13.7200],
                                [100.7870, 13.7200],
                                [100.7880, 13.7250]
                            ]
                        ]
                    ]
                },
                "footprint": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [100.6500, 13.6500],
                            [100.9000, 13.6500],
                            [100.9000, 13.8200],
                            [100.6500, 13.8200],
                            [100.6500, 13.6500]
                        ]
                    ]
                },
                "is_demo": True
            }
        ]

    def normalize(self, raw: Any) -> NormalizedRecord:
        is_demo = raw.get("is_demo", True)
        return NormalizedRecord(
            source=self.source_id if not is_demo else "SRC_COPERNICUS_S1_MOCK",
            source_type="SATELLITE",
            location=raw["footprint"],
            observed_at=raw["acquisition_time"],
            value={
                "satellite_name": raw["satellite_name"],
                "spatial_resolution_meters": raw["spatial_resolution"],
                "water_polygons": raw["water_polygons"],
                "confidence": raw["confidence"]
            },
            extra_metadata={
                "mode": "DEMO" if is_demo else "LIVE",
                "attribution": "European Space Agency (ESA) Copernicus / NASA OPERA",
                "disclaimer": "Observational evidence layer. Not minute-by-minute real-time."
            },
            freshness="STALE",  # 14 hours old is observational evidence, not minute-by-minute
            confidence=raw["confidence"]
        )

    async def health_check(self) -> HealthCheckResult:
        if settings.COPERNICUS_CLIENT_ID and settings.COPERNICUS_CLIENT_SECRET:
            return HealthCheckResult(
                source_id=self.source_id,
                status="AVAILABLE",
                message="Copernicus OAuth credentials configured",
                mode="LIVE"
            )
        return HealthCheckResult(
            source_id=self.source_id,
            status="AVAILABLE",
            latency_ms=12,
            message="Mock Provider active (mode: DEMO - Sentinel-1 SAR evidence layer)",
            mode="DEMO"
        )
