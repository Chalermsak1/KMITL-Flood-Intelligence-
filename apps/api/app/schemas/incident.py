import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.enums import WaterDepthBand, VehiclePassability, ConfidenceLevel, IncidentStatus


class IncidentResponse(BaseModel):
    id: uuid.UUID
    incident_number: int
    title: str
    latitude: float = 13.7278
    longitude: float = 100.7782
    report_count: int = 1
    consensus_depth_band: WaterDepthBand = WaterDepthBand.UNKNOWN
    consensus_passability: VehiclePassability = VehiclePassability.UNKNOWN
    confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM
    status: IncidentStatus = IncidentStatus.ACTIVE
    first_reported_at: datetime
    last_reported_at: datetime
    last_report_age_min: int = 0
    admin_notes: Optional[str] = None

