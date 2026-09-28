from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class RainObservationResponse(BaseModel):
    id: int
    source_id: str
    rain_rate_mm_hr: float
    rain_intensity_band: str  # NONE, LIGHT, MODERATE, HEAVY, VERY_HEAVY
    reflectivity_dbz: Optional[float] = None
    observed_at: datetime
    data_age_min: int
    coverage_area: str = "Lat Krabang Basin"
