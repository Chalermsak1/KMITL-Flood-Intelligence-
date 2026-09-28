import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel


def calculate_verification_freshness(last_verified_at: Optional[datetime]) -> str:
    """
    Categorize shelter verification age:
    - VERIFIED_FRESH: < 4 hours ago
    - VERIFIED_AGING: 4 - 24 hours ago
    - VERIFIED_STALE: > 24 hours ago
    - NEVER_VERIFIED: None
    """
    if last_verified_at is None:
        return "NEVER_VERIFIED"
    now = datetime.now(timezone.utc)
    if last_verified_at.tzinfo is None:
        last_verified_at = last_verified_at.replace(tzinfo=timezone.utc)
    age = now - last_verified_at
    if age < timedelta(hours=4):
        return "VERIFIED_FRESH"
    elif age < timedelta(hours=24):
        return "VERIFIED_AGING"
    else:
        return "VERIFIED_STALE"


class AssistancePointResponse(BaseModel):
    id: uuid.UUID
    name: str
    point_type: str  # SHELTER, MEDICAL, FOOD_WATER, BOAT_PICKUP
    latitude: float
    longitude: float
    capacity: Optional[int] = None
    current_occupancy: int = 0
    is_verified: bool = False
    verified_by: Optional[str] = None
    contact_number: Optional[str] = None
    operating_hours: Optional[str] = None
    last_verified_at: Optional[datetime] = None
    verification_freshness: str = "NEVER_VERIFIED"  # VERIFIED_FRESH, VERIFIED_AGING, VERIFIED_STALE, NEVER_VERIFIED
    source: str = "KMITL_CIVIL_PROTECTION"
    # Explicit occupancy truth status
    # OCCUPANCY_NOT_VERIFIED — not tracked by operators in real-time
    # OPERATOR_LOGGED        — operator manually updated
    # SENSOR_LIVE            — reserved for future sensor integration
    occupancy_status: str = "OCCUPANCY_NOT_VERIFIED"
