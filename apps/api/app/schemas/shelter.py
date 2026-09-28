import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AssistancePointResponse(BaseModel):
    id: uuid.UUID
    name: str
    point_type: str  # SHELTER, MEDICAL, FOOD_WATER, BOAT_PICKUP
    latitude: float
    longitude: float
    capacity: Optional[int] = None
    current_occupancy: int = 0
    is_verified: bool = False
    contact_number: Optional[str] = None
    operating_hours: Optional[str] = None
    last_verified_at: Optional[datetime] = None
