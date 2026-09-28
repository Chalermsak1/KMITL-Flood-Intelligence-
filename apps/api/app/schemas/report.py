import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.enums import WaterDepthBand, VehiclePassability, TransportType, ReportFreshness, ConfidenceLevel


class FloodReportCreate(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude (WGS84)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude (WGS84)")
    water_depth_band: WaterDepthBand = Field(..., description="Estimated water depth band")
    vehicle_passability: VehiclePassability = Field(default=VehiclePassability.UNKNOWN)
    transport_type: TransportType = Field(default=TransportType.CAR)
    description: Optional[str] = Field(None, max_length=500)
    photo_url: Optional[str] = Field(None)


class FloodReportResponse(BaseModel):
    id: uuid.UUID
    latitude: float
    longitude: float
    water_depth_band: WaterDepthBand
    vehicle_passability: VehiclePassability
    transport_type: TransportType
    description: Optional[str] = None
    photo_url: Optional[str] = None
    verification_status: str
    confidence: ConfidenceLevel
    freshness: ReportFreshness
    observed_at: datetime
    data_age_min: int
    incident_id: Optional[uuid.UUID] = None
