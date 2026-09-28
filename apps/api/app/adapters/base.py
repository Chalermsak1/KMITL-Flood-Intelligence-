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
    status: str  # AVAILABLE, DEGRADED, UNAVAILABLE, PENDING_ACCESS
    latency_ms: Optional[int] = None
    message: str = "OK"
    mode: str = "LIVE"  # LIVE, DEMO, OBSERVATION, PENDING_ACCESS


class AdapterTelemetry(BaseModel):
    source: str
    status: str = "AVAILABLE"  # AVAILABLE, DEGRADED, UNAVAILABLE, PENDING_ACCESS
    last_success: Optional[datetime] = None
    last_failure: Optional[datetime] = None
    observed_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    freshness: str = "UNKNOWN"
    latency_ms: Optional[int] = None
    error_count: int = 0


class DataSourceAdapter(ABC):
    """
    Standard Production Adapter Contract (Phase 27):
    - fetch(): retrieves raw data from remote endpoint or provider
    - validate(): verifies spatial/temporal sanity
    - normalize(): converts payload to unified NormalizedRecord
    - store(): persists record into relational/cache store
    - publish(): broadcasts event to real-time event bus
    - health_check(): queries provider liveness and credential authorization
    """
    def __init__(self, source_id: str, name: str):
        self.source_id = source_id
        self.name = name
        self.telemetry = AdapterTelemetry(source=source_id)

    @abstractmethod
    async def fetch(self) -> List[Any]:
        """Fetch raw records from the data provider (HTTP, STAC, or mock)."""
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
    def normalize(self, raw_data: Any) -> NormalizedRecord:
        """Convert a raw provider payload into the unified NormalizedRecord format."""
        pass

    async def store(self, record: NormalizedRecord, session: Optional[Any] = None) -> bool:
        """Persist normalized record into database or cache. Default no-op for pull adapters."""
        return True

    async def publish(self, record: NormalizedRecord) -> bool:
        """Publish real-time notification to Redis / SSE subscribers."""
        try:
            from app.core.redis import publish_event
            await publish_event("TELEMETRY_UPDATED", {
                "source": record.source,
                "source_type": record.source_type,
                "observed_at": record.observed_at.isoformat(),
                "freshness": record.freshness
            })
            return True
        except Exception:
            return False

    @abstractmethod
    async def health_check(self) -> HealthCheckResult:
        """Probe the upstream API health."""
        pass

    def record_success(self, observed_at: Optional[datetime] = None, latency_ms: Optional[int] = None):
        """Update telemetry on successful fetch and normalization."""
        now = datetime.now(timezone.utc)
        self.telemetry.last_success = now
        self.telemetry.received_at = now
        self.telemetry.observed_at = observed_at or now
        self.telemetry.latency_ms = latency_ms
        self.telemetry.status = "AVAILABLE"
        self.telemetry.freshness = "FRESH"

    def record_failure(self, error_message: str):
        """Update telemetry on provider failure."""
        now = datetime.now(timezone.utc)
        self.telemetry.last_failure = now
        self.telemetry.error_count += 1
        self.telemetry.status = "DEGRADED" if self.telemetry.error_count < 3 else "UNAVAILABLE"

    def get_telemetry(self) -> AdapterTelemetry:
        """Return operational telemetry for health reporting."""
        return self.telemetry
