from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class NormalizedRecord(BaseModel):
    source: str = Field(..., description="Unique source code, e.g. SRC_TMD_WEATHER")
    source_type: str = Field(..., description="TMD, BMA_WATER, TRAFFY, SATELLITE, CROWD")
    location: Optional[Dict[str, Any]] = Field(None, description="GeoJSON geometry or {'latitude': lat, 'longitude': lng}")
    observed_at: datetime = Field(..., description="Observation timestamp")
    ingested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    value: Dict[str, Any] = Field(..., description="Normalized metric payload")
    extra_metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata including mode: LIVE or DEMO")
    freshness: str = Field(default="FRESH", description="FRESH, RECENT, AGING, STALE, EXPIRED")
    confidence: str = Field(default="MEDIUM", description="LOW, MEDIUM, HIGH")


class HealthCheckResult(BaseModel):
    source_id: str
    status: str  # AVAILABLE, DEGRADED, UNAVAILABLE
    latency_ms: Optional[int] = None
    message: str = "OK"
    mode: str = "LIVE"  # LIVE or DEMO


class DataSourceAdapter(ABC):
    def __init__(self, source_id: str, name: str):
        self.source_id = source_id
        self.name = name

    @abstractmethod
    async def fetch(self) -> List[Any]:
        """Fetch raw records from the data provider (HTTP, STAC, or mock)."""
        pass

    @abstractmethod
    def normalize(self, raw_data: Any) -> NormalizedRecord:
        """Convert a raw provider payload into the unified NormalizedRecord format."""
        pass

    def validate(self, record: NormalizedRecord) -> bool:
        """Validate spatial and temporal sanity checks."""
        if not record.source or not record.observed_at:
            return False
        # Optional location check (latitude between -90 and 90, longitude between -180 and 180)
        if record.location and "coordinates" in record.location:
            coords = record.location["coordinates"]
            if isinstance(coords, list) and len(coords) >= 2:
                lng, lat = coords[0], coords[1]
                if not (-180.0 <= lng <= 180.0 and -90.0 <= lat <= 90.0):
                    return False
        return True

    @abstractmethod
    async def health_check(self) -> HealthCheckResult:
        """Probe the upstream API health."""
        pass
