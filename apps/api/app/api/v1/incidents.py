import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from geoalchemy2.functions import ST_X, ST_Y, ST_MakeEnvelope, ST_Intersects

from app.core.database import get_db
from app.core.redis import publish_event
from app.models.entities import Incident, AuditLog
from app.models.enums import IncidentStatus, WaterDepthBand, VehiclePassability, ConfidenceLevel
from app.schemas.common import StandardResponse, MetaEnvelope
from app.schemas.incident import IncidentResponse

logger = logging.getLogger("api.incidents")
router = APIRouter(tags=["Flood Incidents"])

DEFAULT_LAT = 13.7278
DEFAULT_LNG = 100.7782


def to_utc(dt: Optional[datetime]) -> datetime:
    """Ensure datetime is UTC timezone-aware to prevent offset-naive subtraction 500 errors."""
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.get("/incidents", response_model=StandardResponse[List[IncidentResponse]])
async def list_active_incidents(
    bbox: Optional[str] = Query(None, description="Bounding box 'minLng,minLat,maxLng,maxLat'"),
    status: Optional[str] = Query("ACTIVE", description="Incident status: ACTIVE, RESOLVED, ALL"),
    db: AsyncSession = Depends(get_db)
):
    now = datetime.now(timezone.utc)

    query = select(
        Incident.id,
        Incident.incident_number,
        Incident.title,
        ST_Y(Incident.centroid).label("latitude"),
        ST_X(Incident.centroid).label("longitude"),
        Incident.report_count,
        Incident.consensus_depth_band,
        Incident.consensus_passability,
        Incident.confidence,
        Incident.status,
        Incident.first_reported_at,
        Incident.last_reported_at,
        Incident.admin_notes
    ).order_by(Incident.last_reported_at.desc())

    # Case-insensitive status filter
    if status and status.strip().upper() != "ALL":
        normalized_status = status.strip().upper()
        # Verify valid status enum or map safely
        valid_statuses = {s.value for s in IncidentStatus}
        if normalized_status in valid_statuses:
            query = query.where(Incident.status == normalized_status)
        else:
            # If an unknown status was requested, return empty list safely
            query = query.where(Incident.status == "UNKNOWN_NONEXISTENT_STATUS")

    if bbox:
        try:
            parts = [float(p.strip()) for p in bbox.split(",")]
            if len(parts) == 4:
                min_lng, min_lat, max_lng, max_lat = parts
                query = query.where(
                    ST_Intersects(
                        Incident.centroid,
                        ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
                    )
                )
            else:
                raise ValueError("Expected 4 comma-separated coordinates")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid bbox format. Use 'minLng,minLat,maxLng,maxLat'")

    try:
        result = await db.execute(query)
        rows = result.all()
    except Exception as e:
        logger.error(f"Error querying incidents from database: {e}")
        raise HTTPException(status_code=500, detail="Unable to retrieve incidents from database")

    items: List[IncidentResponse] = []
    for r in rows:
        last_rep = to_utc(r.last_reported_at)
        first_rep = to_utc(r.first_reported_at)
        age_min = max(0, int((now - last_rep).total_seconds() / 60.0))

        # Safe coordinate extraction
        lat = float(r.latitude) if r.latitude is not None else DEFAULT_LAT
        lng = float(r.longitude) if r.longitude is not None else DEFAULT_LNG

        # Safe enum casting
        depth = r.consensus_depth_band if isinstance(r.consensus_depth_band, WaterDepthBand) else WaterDepthBand.UNKNOWN
        passability = r.consensus_passability if isinstance(r.consensus_passability, VehiclePassability) else VehiclePassability.UNKNOWN
        conf = r.confidence if isinstance(r.confidence, ConfidenceLevel) else ConfidenceLevel.MEDIUM
        inc_status = r.status if isinstance(r.status, IncidentStatus) else IncidentStatus.ACTIVE

        items.append(
            IncidentResponse(
                id=r.id,
                incident_number=r.incident_number,
                title=r.title or f"Incident #{r.incident_number}",
                latitude=lat,
                longitude=lng,
                report_count=r.report_count or 1,
                consensus_depth_band=depth,
                consensus_passability=passability,
                confidence=conf,
                status=inc_status,
                first_reported_at=first_rep,
                last_reported_at=last_rep,
                last_report_age_min=age_min,
                admin_notes=r.admin_notes
            )
        )

    observed_time = items[0].last_reported_at if items else now

    meta = MetaEnvelope(
        source="KMITL_INCIDENT_CLUSTERING_ENGINE",
        observed_at=observed_time,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Incident Aggregation Service (Spatio-Temporal DBSCAN)",
        mode="LIVE"
    )

    return StandardResponse(data=items, meta=meta)


@router.get("/incidents/{incident_id}", response_model=StandardResponse[IncidentResponse])
async def get_incident_detail(
    incident_id: uuid.UUID = Path(..., description="Unique incident identifier"),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve details for a single incident by UUID."""
    now = datetime.now(timezone.utc)
    query = select(
        Incident.id,
        Incident.incident_number,
        Incident.title,
        ST_Y(Incident.centroid).label("latitude"),
        ST_X(Incident.centroid).label("longitude"),
        Incident.report_count,
        Incident.consensus_depth_band,
        Incident.consensus_passability,
        Incident.confidence,
        Incident.status,
        Incident.first_reported_at,
        Incident.last_reported_at,
        Incident.admin_notes
    ).where(Incident.id == incident_id)

    result = await db.execute(query)
    r = result.one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Incident not found")

    last_rep = to_utc(r.last_reported_at)
    first_rep = to_utc(r.first_reported_at)
    age_min = max(0, int((now - last_rep).total_seconds() / 60.0))
    lat = float(r.latitude) if r.latitude is not None else DEFAULT_LAT
    lng = float(r.longitude) if r.longitude is not None else DEFAULT_LNG

    depth = r.consensus_depth_band if isinstance(r.consensus_depth_band, WaterDepthBand) else WaterDepthBand.UNKNOWN
    passability = r.consensus_passability if isinstance(r.consensus_passability, VehiclePassability) else VehiclePassability.UNKNOWN
    conf = r.confidence if isinstance(r.confidence, ConfidenceLevel) else ConfidenceLevel.MEDIUM
    inc_status = r.status if isinstance(r.status, IncidentStatus) else IncidentStatus.ACTIVE

    item = IncidentResponse(
        id=r.id,
        incident_number=r.incident_number,
        title=r.title or f"Incident #{r.incident_number}",
        latitude=lat,
        longitude=lng,
        report_count=r.report_count or 1,
        consensus_depth_band=depth,
        consensus_passability=passability,
        confidence=conf,
        status=inc_status,
        first_reported_at=first_rep,
        last_reported_at=last_rep,
        last_report_age_min=age_min,
        admin_notes=r.admin_notes
    )

    meta = MetaEnvelope(
        source="KMITL_INCIDENT_CLUSTERING_ENGINE",
        observed_at=last_rep,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Incident Aggregation Service",
        mode="LIVE"
    )

    return StandardResponse(data=item, meta=meta)


@router.post("/admin/incidents/{incident_id}/status")
async def update_incident_status(
    incident_id: uuid.UUID = Path(..., description="Unique incident identifier"),
    action: str = Query(..., description="ACTIVE, RESOLVED, FALSE_REPORT"),
    admin_id: str = Query("ADMIN_EOC_1"),
    notes: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Operator endpoint to update incident status and broadcast update via Redis realtime channel."""
    normalized_action = action.strip().upper()
    valid_actions = {s.value for s in IncidentStatus}
    if normalized_action not in valid_actions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action '{action}'. Must be one of: {list(valid_actions)}"
        )

    incident = (await db.execute(select(Incident).where(Incident.id == incident_id))).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    old_status = incident.status.value if hasattr(incident.status, "value") else str(incident.status)
    incident.status = IncidentStatus(normalized_action)
    if notes:
        incident.admin_notes = notes
    if normalized_action == "RESOLVED":
        incident.resolved_at = datetime.now(timezone.utc)

    # Add audit log
    audit = AuditLog(
        actor_id=admin_id,
        action="INCIDENT_STATUS_UPDATE",
        target_table="incidents",
        target_id=incident.id,
        old_value={"status": old_status},
        new_value={"status": normalized_action, "admin_notes": incident.admin_notes},
        reason=notes or f"Operator status update to {normalized_action}"
    )
    db.add(audit)
    await db.commit()

    # Broadcast event via Redis
    try:
        await publish_event("INCIDENT_UPDATED", {
            "incident_id": str(incident.id),
            "incident_number": incident.incident_number,
            "status": normalized_action,
            "admin_notes": incident.admin_notes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.warning(f"Failed to publish Redis event for incident update: {e}")

    return {
        "incident_id": str(incident.id),
        "incident_number": incident.incident_number,
        "status": normalized_action,
        "admin_notes": incident.admin_notes
    }
