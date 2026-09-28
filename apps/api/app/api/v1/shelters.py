import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from geoalchemy2.functions import ST_X, ST_Y

from app.core.database import get_db
from app.core.config import settings
from app.core.security import require_roles
from app.models.entities import AssistancePoint, AuditLog
from app.schemas.common import StandardResponse, MetaEnvelope
from app.schemas.shelter import AssistancePointResponse, calculate_verification_freshness

router = APIRouter(tags=["Shelters & Assistance"])


@router.get("/shelters", response_model=StandardResponse[List[AssistancePointResponse]])
async def list_shelters_and_assistance(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    items = []
    using_fallback = False
    try:
        query = select(
            AssistancePoint.id,
            AssistancePoint.name,
            AssistancePoint.point_type,
            ST_Y(AssistancePoint.location).label("latitude"),
            ST_X(AssistancePoint.location).label("longitude"),
            AssistancePoint.capacity,
            AssistancePoint.current_occupancy,
            AssistancePoint.is_verified,
            AssistancePoint.contact_number,
            AssistancePoint.operating_hours,
            AssistancePoint.last_verified_at
        ).order_by(AssistancePoint.name.asc())

        result = await db.execute(query)
        rows = result.all()

        if rows:
            items = [
                AssistancePointResponse(
                    id=r.id,
                    name=r.name,
                    point_type=r.point_type,
                    latitude=r.latitude,
                    longitude=r.longitude,
                    capacity=r.capacity,
                    current_occupancy=r.current_occupancy,
                    is_verified=r.is_verified,
                    contact_number=r.contact_number,
                    operating_hours=r.operating_hours,
                    last_verified_at=r.last_verified_at,
                    verification_freshness=calculate_verification_freshness(r.last_verified_at),
                    source="KMITL_CIVIL_PROTECTION",
                    occupancy_status="OCCUPANCY_NOT_VERIFIED" if r.current_occupancy == 0 else "OPERATOR_LOGGED",
                )
                for r in rows
            ]
    except Exception:
        items = []

    if not items:
        # ─── Fallback seed data (DEMO mode) ────────────────────────────────────
        # CRITICAL: current_occupancy is NOT real-time — never fabricated.
        # Occupancy shown as 0 = NOT TRACKED. Must be updated by operators.
        using_fallback = True
        items = [
            AssistancePointResponse(
                id=uuid.uuid4(),
                name="ศูนย์พักพิงชั่วคราว หอประชุมเจ้าพระยาสุรวงษ์ไวยวัฒน์ (KMITL Auditorium)",
                point_type="SHELTER",
                latitude=13.7295,
                longitude=100.7755,
                capacity=350,
                current_occupancy=0,   # NOT TRACKED — operator must update
                is_verified=True,
                contact_number="02-329-8000 ต่อ 3100",
                operating_hours="24 ชั่วโมง (เปิดเฉพาะเมื่อเกิดเหตุฉุกเฉิน)",
                last_verified_at=None,
                occupancy_status="OCCUPANCY_NOT_VERIFIED",
            ),
            AssistancePointResponse(
                id=uuid.uuid4(),
                name="จุดปฐมพยาบาลและศูนย์การแพทย์ คณะแพทยศาสตร์ สจล.",
                point_type="MEDICAL",
                latitude=13.7315,
                longitude=100.7812,
                capacity=80,
                current_occupancy=0,   # NOT TRACKED — operator must update
                is_verified=True,
                contact_number="02-329-8100",
                operating_hours="24 ชั่วโมง",
                last_verified_at=None,
                occupancy_status="OCCUPANCY_NOT_VERIFIED",
            ),
            AssistancePointResponse(
                id=uuid.uuid4(),
                name="จุดรับส่งเรือฉุกเฉิน ท่าเรือคลองประเวศบุรีรมย์ (สะพานขาว สจล.)",
                point_type="BOAT_PICKUP",
                latitude=13.7268,
                longitude=100.7760,
                capacity=None,
                current_occupancy=0,
                is_verified=True,
                contact_number="081-999-8877",
                operating_hours="06:00 - 22:00 (เปิดเฉพาะช่วงน้ำท่วม)",
                last_verified_at=None,
                occupancy_status="OCCUPANCY_NOT_VERIFIED",
            )
        ]

    mode = "DEMO" if using_fallback else "LIVE"
    meta = MetaEnvelope(
        source="KMITL_CIVIL_PROTECTION",
        observed_at=now,
        ingested_at=now,
        freshness="UNKNOWN" if using_fallback else "FRESH",
        confidence="MEDIUM",
        attribution="KMITL Safety Center & Lat Krabang District Office (Operator-Verified)",
        mode=mode,
        data_age_seconds=0
    )

    return StandardResponse(data=items, meta=meta)


class ShelterOccupancyUpdateRequest(BaseModel):
    current_occupancy: int = Field(..., ge=0, description="Real verified head count logged by on-site operator")
    verified_by: str = Field(..., min_length=3, description="Name or identifier of on-site officer")
    reason: Optional[str] = Field(None, description="Reason for occupancy update")


@router.patch("/shelters/{shelter_id}/occupancy", response_model=StandardResponse[AssistancePointResponse])
async def update_shelter_occupancy(
    shelter_id: uuid.UUID,
    body: ShelterOccupancyUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles(["ADMIN", "EOC_OPERATOR"]))
):
    """
    Authenticated operator update of shelter occupancy.
    Enforces audit logging and records exact officer identifier.
    """
    now = datetime.now(timezone.utc)
    query = select(AssistancePoint).where(AssistancePoint.id == shelter_id)
    result = await db.execute(query)
    point = result.scalar_one_or_none()

    if not point:
        raise HTTPException(status_code=404, detail="Assistance point / shelter not found.")

    old_occ = point.current_occupancy
    point.current_occupancy = body.current_occupancy
    point.is_verified = True
    point.last_verified_at = now

    # Write audit log
    client_ip = request.client.host if request.client else "127.0.0.1"
    audit_entry = AuditLog(
        actor_id=str(current_user.get("sub", body.verified_by)),
        action="UPDATE_SHELTER_OCCUPANCY",
        target_table="assistance_points",
        target_id=point.id,
        old_value={"current_occupancy": old_occ},
        new_value={"current_occupancy": body.current_occupancy, "verified_by": body.verified_by},
        reason=body.reason or f"On-site verification by {body.verified_by}",
        ip_address=client_ip
    )
    db.add(audit_entry)
    await db.commit()
    await db.refresh(point)

    # Get coordinates
    coord_query = select(ST_Y(point.location).label("lat"), ST_X(point.location).label("lng")).where(AssistancePoint.id == point.id)
    coord_res = await db.execute(coord_query)
    lat_lng = coord_res.one()

    resp_data = AssistancePointResponse(
        id=point.id,
        name=point.name,
        point_type=point.point_type,
        latitude=lat_lng.lat,
        longitude=lat_lng.lng,
        capacity=point.capacity,
        current_occupancy=point.current_occupancy,
        is_verified=point.is_verified,
        verified_by=body.verified_by,
        contact_number=point.contact_number,
        operating_hours=point.operating_hours,
        last_verified_at=point.last_verified_at,
        verification_freshness=calculate_verification_freshness(point.last_verified_at),
        source="KMITL_CIVIL_PROTECTION",
        occupancy_status="OPERATOR_LOGGED",
    )

    meta = MetaEnvelope(
        source="KMITL_CIVIL_PROTECTION",
        observed_at=now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Safety Center & Lat Krabang District Office (Operator-Verified)",
        mode="LIVE",
        data_age_seconds=0
    )

    return StandardResponse(data=resp_data, meta=meta)

