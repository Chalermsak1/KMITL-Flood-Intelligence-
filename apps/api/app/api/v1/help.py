import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from geoalchemy2.functions import ST_X, ST_Y

from pydantic import BaseModel
from app.core.database import get_db
from app.core.config import settings
from app.core.redis import publish_event
from app.models.entities import HelpRequest, AuditLog
from app.models.enums import HelpStatus, HelpPriority, HelpType
from app.schemas.common import StandardResponse, MetaEnvelope
from app.schemas.help import HelpRequestCreate, HelpRequestResponse
from app.services.geofence import classify_coverage, coverage_warning_message

router = APIRouter(tags=["Emergency Assistance & SOS"])


def _sos_operator_status() -> dict:
    """Return current SOS operational mode and operator coverage status."""
    if settings.sos_operational_ready:
        return {
            "mode": "OPERATIONAL",
            "operator_coverage": "OPERATOR_RESPONSE_EXPECTED",
            "operator_contact": settings.SOS_OPERATOR_CONTACT,
            "warning": None,
        }
    else:
        return {
            "mode": settings.SOS_OPERATIONAL_MODE,
            "operator_coverage": "OPERATOR_RESPONSE_NOT_VERIFIED",
            # Phase 26: User must see this. Never imply rescue is guaranteed.
            "warning": (
                "This is a pilot test system. Submitting a help request does NOT guarantee "
                "immediate operator response. For life-threatening emergencies, call 191 (Police), "
                "199 (Fire/Rescue), or 1669 (Medical Emergency)."
            ),
        }


@router.get("/help/status")
async def get_sos_status():
    """
    Returns the current SOS operational mode.
    Clients should display operator_coverage to users BEFORE they submit.
    """
    now = datetime.now(timezone.utc)
    op_status = _sos_operator_status()
    data = {
        "feature_enabled": settings.FEATURE_FLAG_SOS,
        "mode": op_status["mode"],
        "operator_active": settings.sos_operational_ready,
        "operator_coverage": op_status["operator_coverage"],
        "operator_contact": op_status.get("operator_contact"),
        "warning": op_status.get("warning"),
        "official_emergency_numbers": {
            "191": "Police",
            "199": "Fire and Rescue",
            "1669": "Medical Emergency (EMS)",
            "1784": "DDPM Disaster Hotline",
            "kmitl_security": "02-329-8000 (ext 3100)",
        },
    }

    meta = MetaEnvelope(
        source="SRC_SOS_GATEWAY",
        observed_at=now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Emergency Dispatch Gateway",
        mode="LIVE",
    )

    warnings = [op_status["warning"]] if op_status.get("warning") else None
    return StandardResponse(data=data, meta=meta, warnings=warnings)


@router.post("/help", response_model=StandardResponse[HelpRequestResponse], status_code=status.HTTP_201_CREATED)
async def submit_help_request(request_in: HelpRequestCreate, db: AsyncSession = Depends(get_db)):
    if not settings.FEATURE_FLAG_SOS:
        raise HTTPException(status_code=503, detail="SOS feature is currently disabled. Call 191/199/1669 for emergencies.")

    now = datetime.now(timezone.utc)

    # Geofence classification for coverage warning
    zone = classify_coverage(request_in.latitude, request_in.longitude)
    zone_warning = coverage_warning_message(zone)

    # Calculate automated priority based on vulnerability & people count
    priority = request_in.priority
    if request_in.help_type in [HelpType.TRAPPED, HelpType.EVACUATION] or request_in.vulnerable_details:
        priority = HelpPriority.CRITICAL

    # Generate sequential ticket number
    ticket_num = (await db.execute(select(func.nextval("help_requests_ticket_seq")))).scalar() or 1001

    new_help = HelpRequest(
        ticket_number=ticket_num,
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
        "sos_mode": settings.SOS_OPERATIONAL_MODE,
        "coverage_zone": zone,
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

    # SOS operational status embedded in meta so frontend can surface it
    sos_status = _sos_operator_status()

    meta = MetaEnvelope(
        source="KMITL_EMERGENCY_DISPATCH",
        observed_at=now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Emergency Operations Center",
        mode="LIVE",
        data_age_seconds=0
    )

    return StandardResponse(
        data=resp_data,
        meta=meta,
        # Phase 26: Operational warnings surfaced at API level
        warnings=[w for w in [sos_status.get("warning"), zone_warning] if w]
    )


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

    rows = []
    try:
        result = await db.execute(query)
        rows = result.all()
    except Exception:
        rows = []

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
        mode="LIVE",
        data_age_seconds=0
    )

    return StandardResponse(data=items, meta=meta)


class HelpTriageRequest(BaseModel):
    status: HelpStatus
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    actor_id: str = "EOC_OPERATOR_01"


@router.patch("/admin/help/{help_id}/triage")
async def triage_help_request(
    help_id: uuid.UUID,
    payload: HelpTriageRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(HelpRequest).where(HelpRequest.id == help_id)
    help_req = (await db.execute(stmt)).scalar_one_or_none()
    if not help_req:
        raise HTTPException(status_code=404, detail="Help request not found")

    old_status = help_req.status.value
    help_req.status = payload.status
    if payload.assigned_to:
        help_req.assigned_to = payload.assigned_to

    # Log to AuditLog
    audit = AuditLog(
        actor_id=payload.actor_id,
        action="UPDATE_STATUS",
        target_table="help_requests",
        target_id=help_id,
        old_value={"status": old_status},
        new_value={"status": payload.status.value, "assigned_to": payload.assigned_to},
        reason=payload.notes or f"Status updated to {payload.status.value}"
    )
    db.add(audit)
    await db.commit()

    # Emit real-time event
    now = datetime.now(timezone.utc)
    await publish_event("HELP_STATUS_CHANGED", {
        "help_id": str(help_id),
        "ticket_number": help_req.ticket_number,
        "old_status": old_status,
        "new_status": payload.status.value,
        "assigned_to": payload.assigned_to,
        "timestamp": now.isoformat()
    })

    return {"status": "SUCCESS", "message": f"Help request #{help_req.ticket_number} transitioned to {payload.status.value}"}
