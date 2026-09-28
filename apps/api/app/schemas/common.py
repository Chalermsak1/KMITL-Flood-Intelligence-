from datetime import datetime, timezone
from typing import Generic, TypeVar, Optional, List, Any
from pydantic import BaseModel, Field

T = TypeVar("T")


class MetaEnvelope(BaseModel):
    source: str = Field(..., description="Data source identifier or provenance tag")
    observed_at: datetime = Field(..., description="Timestamp when observation was captured in real-world")
    ingested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp when ingested by KMITL system")
    data_age_seconds: int = Field(default=0, description="Lag between real-world observation and system availability")
    freshness: str = Field(default="FRESH", description="FRESH, RECENT, AGING, STALE, EXPIRED")
    confidence: str = Field(default="MEDIUM", description="LOW, MEDIUM, HIGH")
    attribution: str = Field(default="KMITL Flood Intelligence", description="Legal / Open Data attribution")
    mode: str = Field(default="LIVE", description="LIVE or DEMO")


class StandardResponse(BaseModel, Generic[T]):
    data: T
    meta: MetaEnvelope


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
