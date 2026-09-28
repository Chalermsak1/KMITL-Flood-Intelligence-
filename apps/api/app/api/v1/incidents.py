from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from geoalchemy2.functions import ST_X, ST_Y, ST_MakeEnvelope, ST_Intersects

from app.core.database import get_db
from app.models.entities import Incident
from app.models.enums import IncidentStatus
from app.schemas.common import StandardResponse, MetaEnvelope
from app.schemas.incident import IncidentResponse

router = APIRouter(tags=["Flood Incidents"])


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

    if status and status != "ALL":
        query = query.where(Incident.status == status)

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
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid bbox format")

    result = await db.execute(query)
    rows = result.all()

    items = []
    for r in rows:
        age_min = max(0, int((now - r.last_reported_at).total_seconds() / 60.0))
        items.append(
            IncidentResponse(
                id=r.id,
                incident_number=r.incident_number,
                title=r.title,
                latitude=r.latitude,
                longitude=r.longitude,
                report_count=r.report_count,
                consensus_depth_band=r.consensus_depth_band,
                consensus_passability=r.consensus_passability,
                confidence=r.confidence,
                status=r.status,
                first_reported_at=r.first_reported_at,
                last_reported_at=r.last_reported_at,
                last_report_age_min=age_min,
                admin_notes=r.admin_notes
            )
        )

    meta = MetaEnvelope(
        source="KMITL_INCIDENT_CLUSTERING_ENGINE",
        observed_at=items[0].last_reported_at if items else now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Incident Aggregation Service (Spatio-Temporal DBSCAN)",
        mode="LIVE"
    )

    return StandardResponse(data=items, meta=meta)
