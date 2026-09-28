import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from geoalchemy2.functions import ST_X, ST_Y, ST_MakeEnvelope, ST_Intersects

from app.core.database import get_db, AsyncSessionLocal
from app.core.redis import publish_event
from app.models.entities import FloodReport
from app.models.enums import ReportFreshness, ConfidenceLevel
from app.schemas.common import StandardResponse, MetaEnvelope
from app.schemas.report import FloodReportCreate, FloodReportResponse
from app.services.clustering import SpatioTemporalClusteringService

router = APIRouter(tags=["Flood Reports"])


async def run_clustering_background():
    async with AsyncSessionLocal() as session:
        service = SpatioTemporalClusteringService()
        await service.cluster_active_reports(session)


@router.get("/reports", response_model=StandardResponse[List[FloodReportResponse]])
async def list_flood_reports(
    bbox: Optional[str] = Query(None, description="Bounding box formatted as 'minLng,minLat,maxLng,maxLat'"),
    freshness: Optional[str] = Query(None, description="Comma-separated freshness status (e.g. 'FRESH,RECENT')"),
    db: AsyncSession = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    query = select(
        FloodReport.id,
        ST_Y(FloodReport.location).label("latitude"),
        ST_X(FloodReport.location).label("longitude"),
        FloodReport.water_depth_band,
        FloodReport.vehicle_passability,
        FloodReport.transport_type,
        FloodReport.description,
        FloodReport.photo_url,
        FloodReport.verification_status,
        FloodReport.confidence,
        FloodReport.freshness,
        FloodReport.observed_at,
        FloodReport.incident_id
    ).order_by(FloodReport.observed_at.desc()).limit(100)

    # Apply Bounding Box spatial filter
    if bbox:
        try:
            parts = [float(p.strip()) for p in bbox.split(",")]
            if len(parts) == 4:
                min_lng, min_lat, max_lng, max_lat = parts
                query = query.where(
                    ST_Intersects(
                        FloodReport.location,
                        ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
                    )
                )
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid bbox format. Expected 'minLng,minLat,maxLng,maxLat'")

    # Apply Freshness filter
    if freshness:
        freshness_list = [f.strip() for f in freshness.split(",")]
        query = query.where(FloodReport.freshness.in_(freshness_list))

    result = await db.execute(query)
    rows = result.all()

    items = []
    for r in rows:
        age_min = max(0, int((now - r.observed_at).total_seconds() / 60.0))
        items.append(
            FloodReportResponse(
                id=r.id,
                latitude=r.latitude,
                longitude=r.longitude,
                water_depth_band=r.water_depth_band,
                vehicle_passability=r.vehicle_passability,
                transport_type=r.transport_type,
                description=r.description,
                photo_url=r.photo_url,
                verification_status=r.verification_status,
                confidence=r.confidence,
                freshness=r.freshness,
                observed_at=r.observed_at,
                data_age_min=age_min,
                incident_id=r.incident_id
            )
        )

    meta = MetaEnvelope(
        source="SRC_USER_REPORT",
        observed_at=items[0].observed_at if items else now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL First-Party Crowd Reports",
        mode="LIVE"
    )

    return StandardResponse(data=items, meta=meta)


@router.post("/reports", response_model=StandardResponse[FloodReportResponse], status_code=status.HTTP_201_CREATED)
async def create_flood_report(
    report_in: FloodReportCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=2)

    new_report = FloodReport(
        location=f"SRID=4326;POINT({report_in.longitude} {report_in.latitude})",
        water_depth_band=report_in.water_depth_band,
        vehicle_passability=report_in.vehicle_passability,
        transport_type=report_in.transport_type,
        description=report_in.description,
        photo_url=report_in.photo_url,
        verification_status="UNVERIFIED",
        confidence=ConfidenceLevel.MEDIUM if report_in.photo_url else ConfidenceLevel.LOW,
        freshness=ReportFreshness.FRESH,
        observed_at=now,
        expires_at=expires_at
    )

    db.add(new_report)
    await db.commit()
    await db.refresh(new_report)

    # Publish real-time event to Redis
    await publish_event("REPORT_CREATED", {
        "report_id": str(new_report.id),
        "latitude": report_in.latitude,
        "longitude": report_in.longitude,
        "water_depth_band": report_in.water_depth_band.value,
        "vehicle_passability": report_in.vehicle_passability.value,
        "transport_type": report_in.transport_type.value,
        "timestamp": now.isoformat()
    })

    # Trigger background spatio-temporal incident clustering
    background_tasks.add_task(run_clustering_background)

    resp_data = FloodReportResponse(
        id=new_report.id,
        latitude=report_in.latitude,
        longitude=report_in.longitude,
        water_depth_band=new_report.water_depth_band,
        vehicle_passability=new_report.vehicle_passability,
        transport_type=new_report.transport_type,
        description=new_report.description,
        photo_url=new_report.photo_url,
        verification_status=new_report.verification_status,
        confidence=new_report.confidence,
        freshness=new_report.freshness,
        observed_at=new_report.observed_at,
        data_age_min=0,
        incident_id=None
    )

    meta = MetaEnvelope(
        source="SRC_USER_REPORT",
        observed_at=now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Direct Citizen Report",
        mode="LIVE"
    )

    return StandardResponse(data=resp_data, meta=meta)
