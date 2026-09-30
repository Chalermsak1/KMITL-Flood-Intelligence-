import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db, db_circuit_breaker
from app.services.situation import SituationService
from app.schemas.common import StandardResponse, MetaEnvelope
from app.schemas.situation import SituationSummaryResponse

router = APIRouter(tags=["Situation Awareness"])


@router.get("/situation/summary", response_model=StandardResponse[SituationSummaryResponse])
async def get_current_situation(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)

    # 1. Fast-fail if database circuit breaker is OPEN (tail latency bounded to < 1ms)
    if not db_circuit_breaker.allow_request():
        summary = SituationSummaryResponse(
            area_name="KMITL & Lat Krabang Basin",
            current_status="UNKNOWN",
            overall_risk_score=0.0,
            rain_trend="MODERATE",
            water_trend="STABLE",
            active_incidents=0,
            active_help_requests=0,
            data_quality="INSUFFICIENT",
            explanation=["Database circuit breaker OPEN (fast-fail); situation safely defaults to UNKNOWN."],
            last_updated=now,
            data_sources_available=0,
            data_sources_total=4,
            model_version="2.1.0-explainable",
            config_version="2026.09"
        )
    else:
        # 2. Strict 2.0-second bounded timeout (eliminates 30-second connection hangs)
        try:
            summary = await asyncio.wait_for(SituationService.get_summary(db), timeout=2.0)
            db_circuit_breaker.record_success()
        except Exception:
            db_circuit_breaker.record_failure()
            # Resilient fallback: Adhere to UNKNOWN-FIRST policy
            summary = SituationSummaryResponse(
                area_name="KMITL & Lat Krabang Basin",
                current_status="UNKNOWN",
                overall_risk_score=0.0,
                rain_trend="MODERATE",
                water_trend="STABLE",
                active_incidents=0,
                active_help_requests=0,
                data_quality="INSUFFICIENT",
                explanation=["Database telemetry offline; situation safely defaults to UNKNOWN."],
                last_updated=now,
                data_sources_available=0,
                data_sources_total=4,
                model_version="2.1.0-explainable",
                config_version="2026.09"
            )

    meta = MetaEnvelope(
        source="KMITL_SITUATION_FUSION_ENGINE",
        observed_at=summary.last_updated,
        ingested_at=now,
        data_age_seconds=int((now - summary.last_updated).total_seconds()),
        freshness="FRESH",
        confidence="HIGH" if summary.data_quality == "HIGH" else "MEDIUM",
        attribution="KMITL Flood Intelligence Platform (Fused from TMD, BMA, and Crowd signals)",
        mode="LIVE" if summary.data_quality != "INSUFFICIENT" else "DEMO"
    )

    return StandardResponse(data=summary, meta=meta)


@router.get("/situation/events")
async def get_situation_events(db: AsyncSession = Depends(get_db)):
    """Unified chronological real event stream (Section 17)."""
    now = datetime.now(timezone.utc)
    try:
        events = await asyncio.wait_for(SituationService.get_events(db), timeout=2.5)
    except Exception:
        events = []

    meta = MetaEnvelope(
        source="KMITL_EVENT_STREAM",
        observed_at=events[0].timestamp if events else now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Unified Situational Event Stream",
        mode="LIVE"
    )
    return StandardResponse(data=events, meta=meta)


@router.get("/situation/changes")
async def get_situation_changes(db: AsyncSession = Depends(get_db)):
    """What Changed? concise comparison view (Section 16)."""
    now = datetime.now(timezone.utc)
    try:
        changes = await asyncio.wait_for(SituationService.get_changes(db), timeout=2.5)
    except Exception:
        from app.schemas.situation import SituationChangesResponse
        changes = SituationChangesResponse(
            new_reports_count=0,
            roads_worsened_count=0,
            roads_improved_count=0,
            new_incidents_count=0,
            water_level_changes=[],
            rain_changes=[],
            road_changes=[],
            comparison_window="1 hour",
            calculated_at=now
        )

    meta = MetaEnvelope(
        source="KMITL_DELTA_ENGINE",
        observed_at=changes.calculated_at,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL 1-Hour Temporal Delta Engine",
        mode="LIVE"
    )
    return StandardResponse(data=changes, meta=meta)

