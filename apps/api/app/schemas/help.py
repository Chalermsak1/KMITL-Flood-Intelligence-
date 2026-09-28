import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.enums import HelpType, HelpPriority, HelpStatus


class HelpRequestCreate(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    help_type: HelpType
    priority: HelpPriority = Field(default=HelpPriority.MEDIUM)
    requester_name: Optional[str] = Field(None, max_length=100)
    contact_phone: Optional[str] = Field(None, max_length=50)
    people_count: int = Field(default=1, ge=1)
    vulnerable_details: Optional[str] = None
    current_water_level: Optional[str] = None
    description: Optional[str] = None


class HelpRequestResponse(BaseModel):
    id: uuid.UUID
    ticket_number: int
    requester_name: Optional[str] = None
    contact_phone: Optional[str] = None
    latitude: float
    longitude: float
    help_type: HelpType
    priority: HelpPriority
    people_count: int
    vulnerable_details: Optional[str] = None
    current_water_level: Optional[str] = None
    description: Optional[str] = None
    status: HelpStatus
    assigned_to: Optional[str] = None
    created_at: datetime
