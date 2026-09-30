from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class RoadProperties(BaseModel):
    road_segment_id: str
    road_name: str
    road_type: str
    status: str = Field(..., description="NO_EVIDENCE, WATER_PRESENT, FLOODED, SEVERELY_FLOODED, BLOCKED, UNKNOWN")
    water_depth_cm: Optional[float] = None
    water_depth_display: Optional[str] = None
    measurement_status: str = Field("UNKNOWN", description="OBSERVED, REPORTED, ESTIMATED, UNKNOWN")
    trend: str = Field("UNKNOWN", description="INCREASING, DECREASING, STABLE, UNKNOWN")
    change_1h_cm: Optional[float] = None
    change_3h_cm: Optional[float] = None
    change_24h_cm: Optional[float] = None
    flow_direction: Optional[str] = "UNKNOWN"
    flow_status: str = Field("UNKNOWN", description="OBSERVED, ESTIMATED, UNKNOWN")
    flow_confidence: str = Field("UNKNOWN", description="LOW, MEDIUM, HIGH, UNKNOWN")
    flow_intensity: str = Field("UNKNOWN", description="LOW, MEDIUM, HIGH, UNKNOWN")
    flow_story: Optional[str] = None
    flow_origin: Optional[str] = None
    flow_path_steps: List[Dict[str, Any]] = []
    flow_path_coordinates: List[List[float]] = []
    flow_explanation: Optional[Dict[str, Any]] = None
    drainage_destination: Optional[str] = "UNKNOWN"
    drainage_status: str = Field("UNKNOWN", description="ESTIMATED, UNKNOWN")
    drainage_confidence: str = Field("UNKNOWN", description="LOW, MEDIUM, HIGH, UNKNOWN")
    source: str = "No Recent Evidence"
    observed_at: Optional[datetime] = None
    updated_at: datetime
    freshness: str = "UNKNOWN"
    confidence: str = "UNKNOWN"
    elevation_m: float
    length_km: float
    corroborating_reports: int = 0
    source_inputs: List[str] = []


class RoadGeometry(BaseModel):
    type: str = "LineString"
    coordinates: List[List[float]]


class RoadFeature(BaseModel):
    type: str = "Feature"
    id: str
    geometry: RoadGeometry
    properties: RoadProperties


class RoadCollectionResponse(BaseModel):
    type: str = "FeatureCollection"
    features: List[RoadFeature]
    time_offset: str = "NOW"


class RoadHistoryPoint(BaseModel):
    timestamp: datetime
    water_depth_cm: Optional[float] = None
    water_depth_display: Optional[str] = None
    measurement_status: str
    status: str
    source: str
    confidence: str


class DrainageProperties(BaseModel):
    drainage_id: str
    name: str
    drainage_type: str  # PRIMARY_CANAL, CANAL_JUNCTION, PUMP_STATION, RETENTION_BASIN
    capacity_note: Optional[str] = None
    current_status: str  # OPERATIONAL, RISING, NORMAL, PUMPING
    monitored_by: str = "BMA / KMITL Water Resources"


class DrainageGeometry(BaseModel):
    type: str  # LineString or Point
    coordinates: Any


class DrainageFeature(BaseModel):
    type: str = "Feature"
    id: str
    geometry: DrainageGeometry
    properties: DrainageProperties


class DrainageCollectionResponse(BaseModel):
    type: str = "FeatureCollection"
    features: List[DrainageFeature]
