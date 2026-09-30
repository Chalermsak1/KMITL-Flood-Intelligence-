from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from geoalchemy2.functions import ST_X, ST_Y

from app.core.database import get_db
from app.models.entities import FloodReport, Incident
from app.schemas.road import (
    RoadCollectionResponse,
    RoadHistoryPoint,
    DrainageCollectionResponse,
)
from app.services.road_network import RoadNetworkService

router = APIRouter(tags=["Road-Level Flood Intelligence & Drainage"])


@router.get("/roads/status", response_model=RoadCollectionResponse)
async def get_road_network_status(
    time_offset: str = Query("NOW", description="Time evolution cutoff: NOW, 1H_AGO, 3H_AGO, 6H_AGO, 24H_AGO"),
    bbox: Optional[str] = Query(None, description="Bounding box filter minLng,minLat,maxLng,maxLat"),
    db: AsyncSession = Depends(get_db)
):
    """
    Expose real-data road segment flood conditions for KMITL and Lat Krabang.
    Strictly follows Real Data policy: returns UNKNOWN / NO_EVIDENCE when no real evidence exists.
    Never returns fake 0cm or 'SAFE' for unobserved roads.
    """
    now = datetime.now(timezone.utc)

    # Fetch real reports from DB (past 24h) using PostGIS ST_X/ST_Y
    cutoff_24h = now - timedelta(hours=24)
    rep_query = select(
        FloodReport.id,
        ST_Y(FloodReport.location).label("latitude"),
        ST_X(FloodReport.location).label("longitude"),
        FloodReport.water_depth_band,
        FloodReport.vehicle_passability,
        FloodReport.observed_at,
        FloodReport.confidence
    ).where(FloodReport.observed_at >= cutoff_24h).order_by(FloodReport.observed_at.desc())
    rep_rows = (await db.execute(rep_query)).all()

    all_reports = []
    for r in rep_rows:
        all_reports.append({
            "id": str(r.id),
            "latitude": r.latitude,
            "longitude": r.longitude,
            "water_depth_band": r.water_depth_band.value if hasattr(r.water_depth_band, "value") else str(r.water_depth_band),
            "vehicle_passability": r.vehicle_passability.value if hasattr(r.vehicle_passability, "value") else str(r.vehicle_passability),
            "observed_at": r.observed_at,
            "confidence": r.confidence.value if hasattr(r.confidence, "value") else str(r.confidence)
        })

    # Fetch active incidents using PostGIS ST_X/ST_Y
    inc_query = select(
        Incident.id,
        Incident.incident_number,
        ST_Y(Incident.centroid).label("latitude"),
        ST_X(Incident.centroid).label("longitude"),
        Incident.consensus_depth_band,
        Incident.confidence,
        Incident.report_count
    ).where(Incident.status == "ACTIVE")
    inc_rows = (await db.execute(inc_query)).all()

    active_incidents = []
    for inc in inc_rows:
        active_incidents.append({
            "id": str(inc.id),
            "incident_number": inc.incident_number,
            "latitude": inc.latitude,
            "longitude": inc.longitude,
            "consensus_depth_band": inc.consensus_depth_band.value if hasattr(inc.consensus_depth_band, "value") else str(inc.consensus_depth_band),
            "confidence": inc.confidence.value if hasattr(inc.confidence, "value") else str(inc.confidence),
            "report_count": inc.report_count
        })

    road_features = RoadNetworkService.evaluate_roads(
        active_reports=all_reports,
        all_reports_history=all_reports,
        active_incidents=active_incidents,
        time_offset=time_offset.upper()
    )

    return RoadCollectionResponse(
        type="FeatureCollection",
        features=road_features,
        time_offset=time_offset.upper()
    )


@router.get("/roads/{segment_id}/history", response_model=List[RoadHistoryPoint])
async def get_road_segment_history(
    segment_id: str = Path(..., description="Road segment ID (e.g. SEG_CHALONG_KRUNG_CAMPUS)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve chronological historical observations for a specific road segment.
    Only returns real historical data — never fabricates history.
    """
    now = datetime.now(timezone.utc)
    cutoff_24h = now - timedelta(hours=24)

    rep_query = select(
        FloodReport.id,
        ST_Y(FloodReport.location).label("latitude"),
        ST_X(FloodReport.location).label("longitude"),
        FloodReport.water_depth_band,
        FloodReport.observed_at,
        FloodReport.confidence
    ).where(FloodReport.observed_at >= cutoff_24h).order_by(FloodReport.observed_at.asc())
    rep_rows = (await db.execute(rep_query)).all()

    all_reports = []
    for r in rep_rows:
        all_reports.append({
            "id": str(r.id),
            "latitude": r.latitude,
            "longitude": r.longitude,
            "water_depth_band": r.water_depth_band.value if hasattr(r.water_depth_band, "value") else str(r.water_depth_band),
            "observed_at": r.observed_at,
            "confidence": r.confidence.value if hasattr(r.confidence, "value") else str(r.confidence)
        })

    history = RoadNetworkService.get_segment_history(
        segment_id=segment_id,
        all_reports=all_reports,
        incidents=[]
    )
    return history


@router.get("/drainage/network", response_model=DrainageCollectionResponse)
async def get_drainage_network():
    """
    Expose Lat Krabang drainage canals, pumping stations, and retention infrastructure as GeoJSON.
    """
    drainage_features = RoadNetworkService.get_drainage_features()
    return DrainageCollectionResponse(
        type="FeatureCollection",
        features=drainage_features
    )
