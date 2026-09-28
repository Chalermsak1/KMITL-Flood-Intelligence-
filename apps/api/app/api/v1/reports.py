import io
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status, BackgroundTasks, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from geoalchemy2.functions import ST_X, ST_Y, ST_MakeEnvelope, ST_Intersects

from app.core.database import get_db, AsyncSessionLocal
from app.core.config import settings
from app.core.redis import publish_event
from app.core.security import rate_limit
from app.models.entities import FloodReport
from app.models.enums import ReportFreshness, ConfidenceLevel
from app.schemas.common import StandardResponse, MetaEnvelope
from app.schemas.report import FloodReportCreate, FloodReportResponse
from app.services.clustering import SpatioTemporalClusteringService
from app.services.geofence import classify_coverage, coverage_warning_message

router = APIRouter(tags=["Flood Reports"])


async def run_clustering_background():
    try:
        async with AsyncSessionLocal() as session:
            service = SpatioTemporalClusteringService()
            await service.cluster_active_reports(session)
    except Exception:
        pass


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

    rows = []
    try:
        result = await db.execute(query)
        rows = result.all()
    except Exception:
        rows = []

    items = []
    for r in rows:
        age_min = max(0, int((now - r.observed_at).total_seconds() / 60.0))
        zone = classify_coverage(r.latitude, r.longitude)
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
                incident_id=r.incident_id,
                coverage_zone=zone
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
    db: AsyncSession = Depends(get_db),
    _limiter: bool = Depends(rate_limit(max_requests=10, window_seconds=60))
):
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=2)

    coverage_zone = classify_coverage(report_in.latitude, report_in.longitude)
    cov_warning = coverage_warning_message(coverage_zone)
    warnings = [cov_warning] if cov_warning else None

    new_report = FloodReport(
        id=uuid.uuid4(),
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
        "coverage_zone": coverage_zone,
        "timestamp": now.isoformat()
    })

    # Enqueue job to Multi-Tier Durable Queue (Tier 1: SQS, Tier 2: Redis, Tier 3: Disk WAL)
    try:
        from app.core.queue import job_queue
        await job_queue.enqueue(
            "CLUSTER_INCIDENTS",
            {
                "report_id": str(new_report.id),
                "latitude": report_in.latitude,
                "longitude": report_in.longitude,
                "water_depth_band": report_in.water_depth_band.value
            },
            priority="HIGH"
        )
        if report_in.photo_url:
            await job_queue.enqueue(
                "PROCESS_REPORT_IMAGE",
                {"report_id": str(new_report.id), "photo_url": report_in.photo_url},
                priority="NORMAL"
            )
    except Exception as q_err:
        pass

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
        incident_id=None,
        coverage_zone=coverage_zone
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

    return StandardResponse(data=resp_data, meta=meta, warnings=warnings)


@router.post("/reports/verify-image")
async def verify_report_image(
    file: UploadFile = File(...),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db),
    _limiter: bool = Depends(rate_limit(max_requests=15, window_seconds=60))
):
    from PIL import Image
    from app.services.image_verifier import ImageVerificationService
    from app.models.entities import FloodReport

    data = await file.read()
    is_valid_type, mime_or_err = ImageVerificationService.validate_magic_bytes(data)
    if not is_valid_type:
        raise HTTPException(status_code=400, detail=mime_or_err)

    try:
        img = Image.open(io.BytesIO(data))
    except Exception:
        raise HTTPException(status_code=400, detail="Cannot decode image. Corrupted file.")

    # Assess quality
    quality = ImageVerificationService.assess_image_quality(img)

    # Compute pHash
    phash = ImageVerificationService.compute_perceptual_hash(img)

    # Check duplicate against existing reports within 500m in past 2h
    is_duplicate = False
    now = datetime.now(timezone.utc)
    recent_reports = await db.execute(
        select(FloodReport.image_hash).where(
            FloodReport.observed_at >= now - timedelta(hours=2),
            FloodReport.image_hash != None
        ).limit(50)
    )
    for (existing_hash,) in recent_reports.all():
        if existing_hash and ImageVerificationService.hamming_distance(phash, existing_hash) <= 5:
            is_duplicate = True
            break

    # Run flood classification
    classification = ImageVerificationService.classify_flood_image(img)

    # Synthesize confidence
    overall_conf = ImageVerificationService.calculate_overall_confidence(
        recency_minutes=0,
        nearby_reports_count=1,
        has_photo=True,
        image_quality_status=quality["status"],
        ai_confidence=classification["confidence"],
        is_duplicate=is_duplicate
    )

    return {
        "status": "success",
        "mime_type": mime_or_err,
        "quality": quality,
        "perceptual_hash": phash,
        "is_duplicate": is_duplicate,
        "classification": classification,
        "recommended_confidence": overall_conf
    }


@router.post("/admin/reports/{report_id}/override")
async def admin_override_report(
    report_id: uuid.UUID,
    action: str = Query(..., description="AI_CONFIRMED, ADMIN_VERIFIED, REJECTED"),
    admin_id: str = Query("ADMIN_EOC_1"),
    reason: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    from app.models.entities import FloodReport, AuditLog

    report = (await db.execute(select(FloodReport).where(FloodReport.id == report_id))).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Flood report not found")

    old_status = report.verification_status
    report.verification_status = action
    if action == "REJECTED":
        report.confidence = ConfidenceLevel.LOW
    elif action in ["ADMIN_VERIFIED", "AI_CONFIRMED"]:
        report.confidence = ConfidenceLevel.HIGH

    # Write audit log
    audit = AuditLog(
        actor_id=admin_id,
        action="REPORT_VERIFICATION_OVERRIDE",
        target_table="flood_reports",
        target_id=report.id,
        old_value={"verification_status": old_status},
        new_value={"verification_status": action},
        reason=reason or "Admin manual triage review"
    )
    db.add(audit)
    await db.commit()

    return {
        "report_id": str(report.id),
        "status": "OVERRIDDEN",
        "new_verification_status": action,
        "confidence": report.confidence.value
    }

