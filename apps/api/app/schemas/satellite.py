import uuid
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel
from app.models.enums import ConfidenceLevel


class SatelliteObservationResponse(BaseModel):
    id: uuid.UUID
    source_id: str
    satellite_name: str
    spatial_resolution_meters: float
    confidence: ConfidenceLevel
    acquisition_at: datetime
    processed_at: datetime
    data_age_hours: float
    water_polygons_geojson: dict
    disclaimer: str = "Observational evidence layer. Not minute-by-minute real-time."
