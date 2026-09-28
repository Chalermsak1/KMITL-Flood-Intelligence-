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
