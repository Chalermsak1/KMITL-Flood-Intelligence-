from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class WaterObservationResponse(BaseModel):
    id: int
    station_id: str
    water_level_m_msl: float
    water_delta_10m: Optional[float] = None
    water_delta_30m: Optional[float] = None
    water_delta_60m: Optional[float] = None
    trend: Optional[str] = "STABLE"
    observed_at: datetime
    data_age_min: int


class WaterStationResponse(BaseModel):
    id: str
    name: str
    station_type: str
    latitude: float
    longitude: float
    warning_threshold_meters: Optional[float] = None
    critical_threshold_meters: Optional[float] = None
    current_level_m_msl: Optional[float] = None
    trend: Optional[str] = "STABLE"
    last_observed_at: Optional[datetime] = None
    data_age_min: Optional[int] = None
