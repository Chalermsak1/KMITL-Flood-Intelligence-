import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.enums import WaterDepthBand, VehiclePassability, ConfidenceLevel, IncidentStatus


class IncidentResponse(BaseModel):
    id: uuid.UUID
    incident_number: int
    title: str
    latitude: float
    longitude: float
    report_count: int
    consensus_depth_band: WaterDepthBand
    consensus_passability: VehiclePassability
    confidence: ConfidenceLevel
    status: IncidentStatus
    first_reported_at: datetime
    last_reported_at: datetime
    last_report_age_min: int
    admin_notes: Optional[str] = None
