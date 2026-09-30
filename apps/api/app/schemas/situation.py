from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class RiskFactor(BaseModel):
    name: str
    weight: float
    score: float
    description: str
    freshness: str


class SituationSummaryResponse(BaseModel):
    area_name: str = "KMITL & Lat Krabang Basin"
    current_status: str  # LOW, MODERATE, HIGH, CRITICAL, UNKNOWN
    overall_risk_score: float  # 0 to 100
    rain_trend: str  # NONE, LIGHT, MODERATE, HEAVY, VERY_HEAVY
    water_trend: str  # RISING, STABLE, FALLING
    active_incidents: int
    active_help_requests: int
    data_quality: str  # HIGH, MEDIUM, LOW, INSUFFICIENT
    explanation: List[str]
    last_updated: datetime
    data_sources_available: int
    data_sources_total: int
    confidence: str = "MEDIUM"  # LOW, MEDIUM, HIGH, UNKNOWN
    sources_used: List[str] = ["SRC_USER_REPORT", "SRC_CANAL_SENSORS", "SRC_RADAR_TELEMETRY"]
    data_cutoff: Optional[datetime] = None
    unknown_factors: List[str] = []
    model_version: str = "2.1.0-explainable"
    config_version: str = "2026.09"


class SituationEventItem(BaseModel):
    id: str
    timestamp: datetime
    location: str
    event_type: str  # CITIZEN_REPORT, VERIFIED_INCIDENT, ROAD_STATUS, WATER_LEVEL, RAINFALL, WARNING
    source: str
    status: str      # REPORTED, OBSERVED, VERIFIED, ESTIMATED
    description: str
    details: Optional[dict] = None


class RoadStateChange(BaseModel):
    road_name: str
    segment_id: str
    previous_status: str
    current_status: str
    change_type: str  # WORSENED, IMPROVED, UNCHANGED
    depth_delta_cm: Optional[float] = None


class SituationChangesResponse(BaseModel):
    new_reports_count: int
    roads_worsened_count: int
    roads_improved_count: int
    new_incidents_count: int
    water_level_changes: List[str]
    rain_changes: List[str]
    road_changes: List[RoadStateChange]
    comparison_window: str = "1 hour"
    calculated_at: datetime

