from datetime import datetime, timezone
from typing import Generic, TypeVar, Optional, List, Any
from pydantic import BaseModel, Field

T = TypeVar("T")


class MetaEnvelope(BaseModel):
    source: str = Field(..., description="Data source identifier or provenance tag")
    observed_at: datetime = Field(..., description="Timestamp when observation was captured in real-world")
    ingested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp when ingested by KMITL system")
    data_age_seconds: int = Field(default=0, description="Lag between real-world observation and system availability")
    freshness: str = Field(
        default="FRESH",
        description="FRESH | RECENT | AGING | STALE | EXPIRED | UNKNOWN"
    )
    confidence: str = Field(default="MEDIUM", description="LOW | MEDIUM | HIGH")
    attribution: str = Field(default="KMITL Flood Intelligence", description="Legal / Open Data attribution")
    mode: str = Field(
        default="LIVE",
        description=(
            "LIVE — real-time institutional feed | "
            "DEMO — mock or reference data | "
            "OBSERVATION — satellite/sensor snapshot at a point in time | "
            "PREDICTION — model output | "
            "STALE — beyond freshness window | "
            "EXPIRED — no longer actionable | "
            "UNAVAILABLE — source offline | "
            "PENDING_ACCESS — credentials not yet established"
        )
    )


class StandardResponse(BaseModel, Generic[T]):
    data: T
    meta: MetaEnvelope
    # Optional list of non-fatal warnings (SOS operator status, coverage zone, etc.)
    warnings: Optional[List[str]] = Field(default=None, description="Non-fatal operational warnings the client should surface to the user")


class GeoPoint(BaseModel):
    type: str = "Point"
    coordinates: List[float] = Field(..., min_length=2, max_length=2, description="[longitude, latitude]")


class GeoPolygon(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]


class GeoMultiPolygon(BaseModel):
    type: str = "MultiPolygon"
    coordinates: List[List[List[List[float]]]]


class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: dict
    properties: dict


class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]
