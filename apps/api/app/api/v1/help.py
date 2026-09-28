import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from geoalchemy2.functions import ST_X, ST_Y

from app.core.database import get_db
from app.core.redis import publish_event
from app.models.entities import HelpRequest
from app.models.enums import HelpStatus, HelpPriority, HelpType
from app.schemas.common import StandardResponse, MetaEnvelope
from app.schemas.help import HelpRequestCreate, HelpRequestResponse

router = APIRouter(tags=["Emergency Assistance & SOS"])


@router.post("/help", response_model=StandardResponse[HelpRequestResponse], status_code=status.HTTP_201_CREATED)
async def submit_help_request(request_in: HelpRequestCreate, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)

    # Calculate automated priority based on vulnerability & people count
    priority = request_in.priority
    if request_in.help_type in [HelpType.TRAPPED, HelpType.EVACUATION] or request_in.vulnerable_details:
        priority = HelpPriority.CRITICAL

    new_help = HelpRequest(
        requester_name=request_in.requester_name or "Anonymous Citizen",
        contact_phone=request_in.contact_phone,
        location=f"SRID=4326;POINT({request_in.longitude} {request_in.latitude})",
        help_type=request_in.help_type,
        priority=priority,
        people_count=request_in.people_count,
        vulnerable_details=request_in.vulnerable_details,
        current_water_level=request_in.current_water_level,
        description=request_in.description,
        status=HelpStatus.OPEN
    )

    db.add(new_help)
    await db.commit()
    await db.refresh(new_help)

    # Publish real-time event to Redis for immediate triage on EOC dashboard
    await publish_event("HELP_REQUEST_CREATED", {
        "request_id": str(new_help.id),
        "ticket_number": new_help.ticket_number,
        "latitude": request_in.latitude,
        "longitude": request_in.longitude,
        "help_type": request_in.help_type.value,
        "priority": priority.value,
        "people_count": request_in.people_count,
        "created_at": now.isoformat()
    })

    resp_data = HelpRequestResponse(
        id=new_help.id,
        ticket_number=new_help.ticket_number,
        requester_name=new_help.requester_name,
        contact_phone=new_help.contact_phone,
        latitude=request_in.latitude,
        longitude=request_in.longitude,
        help_type=new_help.help_type,
        priority=new_help.priority,
        people_count=new_help.people_count,
        vulnerable_details=new_help.vulnerable_details,
        current_water_level=new_help.current_water_level,
        description=new_help.description,
        status=new_help.status,
        assigned_to=new_help.assigned_to,
        created_at=new_help.created_at
    )

    meta = MetaEnvelope(
        source="KMITL_EMERGENCY_DISPATCH",
        observed_at=now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Emergency Operations Center",
        mode="LIVE"
    )

    return StandardResponse(data=resp_data, meta=meta)


@router.get("/help", response_model=StandardResponse[List[HelpRequestResponse]])
async def list_help_requests(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    query = select(
        HelpRequest.id,
        HelpRequest.ticket_number,
        HelpRequest.requester_name,
        HelpRequest.contact_phone,
        ST_Y(HelpRequest.location).label("latitude"),
        ST_X(HelpRequest.location).label("longitude"),
        HelpRequest.help_type,
        HelpRequest.priority,
        HelpRequest.people_count,
        HelpRequest.vulnerable_details,
        HelpRequest.current_water_level,
        HelpRequest.description,
        HelpRequest.status,
        HelpRequest.assigned_to,
        HelpRequest.created_at
    ).order_by(HelpRequest.created_at.desc()).limit(50)

    result = await db.execute(query)
    rows = result.all()

    items = [
        HelpRequestResponse(
            id=r.id,
            ticket_number=r.ticket_number,
            requester_name=r.requester_name,
            contact_phone=r.contact_phone,
            latitude=r.latitude,
            longitude=r.longitude,
            help_type=r.help_type,
            priority=r.priority,
            people_count=r.people_count,
            vulnerable_details=r.vulnerable_details,
            current_water_level=r.current_water_level,
            description=r.description,
            status=r.status,
            assigned_to=r.assigned_to,
            created_at=r.created_at
        )
        for r in rows
    ]

    meta = MetaEnvelope(
        source="KMITL_EMERGENCY_DISPATCH",
        observed_at=items[0].created_at if items else now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Emergency Dispatch System",
        mode="LIVE"
    )

    return StandardResponse(data=items, meta=meta)
