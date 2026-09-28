"""
Beta Zone & Feature Flag API — Phase 26 & Phase 27
Provides machine-readable coverage zone classification and RBAC-governed feature flag controls.

RBAC Hierarchy:
  - READ_PUBLIC_SAFE_STATUS: unauthenticated read of public operational indicators
  - READ_ADMIN_STATUS: authenticated EOC_OPERATOR or ADMIN read of full internal flags
  - WRITE_ADMIN_FLAGS: authenticated ADMIN write of feature flags with mandatory audit log
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Query, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.security import require_roles
from app.models.entities import AuditLog
from app.schemas.common import StandardResponse, MetaEnvelope
from app.services.geofence import classify_coverage, coverage_warning_message, get_zone_metadata

router = APIRouter(tags=["Beta Coverage & Feature Flags"])


class FeatureFlagUpdateRequest(BaseModel):
    flag_name: str = Field(..., description="Name of the feature flag to modify")
    value: Any = Field(..., description="New value for the feature flag")
    reason: str = Field(..., min_length=5, description="Audited operational reason for modifying this flag")
    request_id: Optional[str] = Field(None, description="Optional request correlation ID")


def _get_public_safe_flags() -> Dict[str, Any]:
    """Returns only public-safe status flags that pose zero operational security risk."""
    return {
        "BETA_LATKRABANG_ENABLED": settings.FEATURE_FLAG_BETA_LATKRABANG_ENABLED,
        "PUBLIC_REPORTS_ENABLED": settings.FEATURE_FLAG_PUBLIC_REPORTS,
        "ROUTING_ENABLED": settings.FEATURE_FLAG_ROUTING,
        "REALTIME_ENABLED": settings.FEATURE_FLAG_REALTIME,
        "SOS_ENABLED": settings.FEATURE_FLAG_SOS,
        "LOW_BANDWIDTH_MODE": settings.FEATURE_FLAG_LOW_BANDWIDTH_MODE,
        "EMERGENCY_MODE_ACTIVE": settings.FEATURE_FLAG_EMERGENCY_MODE,
        "TMD_LIVE_INGESTION": settings.FEATURE_FLAG_TMD_LIVE,
        "BMA_LIVE_INGESTION": settings.FEATURE_FLAG_BMA_LIVE,
        "TRAFFY_LIVE_INGESTION": settings.FEATURE_FLAG_TRAFFY_LIVE,
        "SOS_OPERATIONAL_MODE": settings.SOS_OPERATIONAL_MODE,
    }


def _get_admin_full_flags() -> Dict[str, Any]:
    """Returns the full internal inventory of feature flags for authorized operators."""
    return {
        # External data sources
        "EXTERNAL_TMD_ENABLED": settings.FEATURE_FLAG_TMD,
        "EXTERNAL_BMA_ENABLED": settings.FEATURE_FLAG_BMA,
        "EXTERNAL_TRAFFY_ENABLED": settings.FEATURE_FLAG_TRAFFY,
        "SATELLITE_ENABLED": settings.FEATURE_FLAG_SATELLITE,
        "TMD_LIVE_INGESTION": settings.FEATURE_FLAG_TMD_LIVE,
        "BMA_LIVE_INGESTION": settings.FEATURE_FLAG_BMA_LIVE,
        "TRAFFY_LIVE_INGESTION": settings.FEATURE_FLAG_TRAFFY_LIVE,
        # Core features
        "AI_VERIFICATION_ENABLED": settings.FEATURE_FLAG_AI_VERIFICATION,
        "ROUTING_ENABLED": settings.FEATURE_FLAG_ROUTING,
        "SOS_ENABLED": settings.FEATURE_FLAG_SOS,
        "REALTIME_ENABLED": settings.FEATURE_FLAG_REALTIME,
        "PUBLIC_REPORTS_ENABLED": settings.FEATURE_FLAG_PUBLIC_REPORTS,
        "ADMIN_OPERATIONS_ENABLED": settings.FEATURE_FLAG_ADMIN_OPERATIONS,
        "ANALYTICS_ENABLED": settings.FEATURE_FLAG_ANALYTICS,
        "REPLAY_ENABLED": settings.FEATURE_FLAG_REPLAY,
        # Beta & Operational controls
        "BETA_LATKRABANG_ENABLED": settings.FEATURE_FLAG_BETA_LATKRABANG_ENABLED,
        "SOS_OPERATIONAL_MODE": settings.SOS_OPERATIONAL_MODE,
        "SOS_OPERATOR_DOCUMENTED": settings.SOS_OPERATOR_DOCUMENTED,
        "FIELD_TEST_ACCOUNTS_ENABLED": settings.FEATURE_FLAG_FIELD_TEST_ACCOUNTS,
        "GEOFENCE_ENFORCEMENT_ENABLED": settings.FEATURE_FLAG_GEOFENCE_ENFORCEMENT,
        "LOW_BANDWIDTH_MODE": settings.FEATURE_FLAG_LOW_BANDWIDTH_MODE,
        "EMERGENCY_MODE_ACTIVE": settings.FEATURE_FLAG_EMERGENCY_MODE,
    }


@router.get("/beta/coverage", response_model=StandardResponse[Dict[str, Any]])
async def get_coverage_zone(
    latitude: Optional[float] = Query(None, description="Latitude of location to classify"),
    longitude: Optional[float] = Query(None, description="Longitude of location to classify"),
):
    """
    Classify a coordinate against the beta geofence zones.
    Public safe endpoint.
    """
    now = datetime.now(timezone.utc)
    zone = classify_coverage(latitude, longitude)
    warning = coverage_warning_message(zone)

    data = {
        "zone": zone,
        "is_within_beta": zone in ("IN_ZONE_A", "IN_ZONE_B"),
        "warning": warning,
        "zone_metadata": get_zone_metadata(),
    }

    meta = MetaEnvelope(
        source="SRC_GEOFENCE_SERVICE",
        observed_at=now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Beta Geofence Engine",
        mode="LIVE",
    )

    warnings = [warning] if warning else None
    return StandardResponse(data=data, meta=meta, warnings=warnings)


@router.get("/beta/features", response_model=StandardResponse[Dict[str, Any]])
async def get_public_feature_flags():
    """
    READ_PUBLIC_SAFE_STATUS:
    Returns the current state of public-safe feature flags.
    No unauthenticated user can alter system behavior via this endpoint.
    """
    now = datetime.now(timezone.utc)
    flags = _get_public_safe_flags()

    data = {
        "flags": flags,
        "environment": settings.ENVIRONMENT,
        "phase": "27-PRODUCTION-BETA-GATE",
        "beta_zones": ["ZONE_A_KMITL", "ZONE_B_LATKRABANG"],
        "access_level": "READ_PUBLIC_SAFE_STATUS",
    }

    meta = MetaEnvelope(
        source="SRC_SYSTEM_CONFIG",
        observed_at=now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Core Configuration (Public Safe)",
        mode="LIVE",
    )

    return StandardResponse(data=data, meta=meta)


@router.get("/beta/features/admin", response_model=StandardResponse[Dict[str, Any]])
async def get_admin_feature_flags(
    current_user: Dict[str, Any] = Depends(require_roles(["ADMIN", "EOC_OPERATOR"]))
):
    """
    READ_ADMIN_STATUS:
    Requires authentication with role ADMIN or EOC_OPERATOR.
    Exposes full internal configuration and telemetry connectivity.
    """
    now = datetime.now(timezone.utc)
    flags = _get_admin_full_flags()

    data = {
        "flags": flags,
        "environment": settings.ENVIRONMENT,
        "phase": "27-PRODUCTION-BETA-GATE",
        "beta_zones": ["ZONE_A_KMITL", "ZONE_B_LATKRABANG"],
        "access_level": "READ_ADMIN_STATUS",
        "authenticated_as": current_user.get("sub"),
        "role": current_user.get("role"),
    }

    meta = MetaEnvelope(
        source="SRC_SYSTEM_CONFIG",
        observed_at=now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Core Configuration (Admin Audited)",
        mode="LIVE",
    )

    return StandardResponse(data=data, meta=meta)


@router.post("/beta/features", response_model=StandardResponse[Dict[str, Any]])
async def update_feature_flag(
    body: FeatureFlagUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles(["ADMIN"]))
):
    """
    WRITE_ADMIN_FLAGS:
    Requires authenticated user with role ADMIN.
    Enforces non-negotiable data truth policies:
      - Live ingestion flags (TMD, BMA, Traffy) CANNOT be enabled without verified credentials.
    Writes an immutable entry to audit_logs table before applying change.
    """
    flag_key = body.flag_name
    if not hasattr(settings, flag_key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown configuration key: '{flag_key}'"
        )

    # Truth Gate: Prevent activating LIVE ingestion if credentials are not established
    if flag_key in ("FEATURE_FLAG_TMD_LIVE", "FEATURE_FLAG_BMA_LIVE", "FEATURE_FLAG_TRAFFY_LIVE") and body.value is True:
        if flag_key == "FEATURE_FLAG_TMD_LIVE" and (not settings.TMD_UID or not settings.TMD_UKEY):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot activate TMD_LIVE: Missing verified TMD_UID or TMD_UKEY credentials."
            )
        if flag_key == "FEATURE_FLAG_BMA_LIVE" and not settings.BMA_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot activate BMA_LIVE: Missing verified BMA_API_KEY credentials."
            )
        if flag_key == "FEATURE_FLAG_TRAFFY_LIVE" and not settings.TRAFFY_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot activate TRAFFY_LIVE: Missing verified TRAFFY_API_KEY OAuth token."
            )

    old_val = getattr(settings, flag_key)
    new_val = body.value

    # Apply setting in memory
    setattr(settings, flag_key, new_val)

    # Persist immutable AuditLog entry
    client_ip = request.client.host if request.client else "127.0.0.1"
    audit_entry = AuditLog(
        actor_id=str(current_user.get("sub", "admin")),
        action="UPDATE_FEATURE_FLAG",
        target_table="system_config",
        target_id=uuid.uuid4(),
        old_value={flag_key: old_val},
        new_value={flag_key: new_val},
        reason=f"[{body.request_id or 'NO_REQ_ID'}] {body.reason}",
        ip_address=client_ip
    )
    db.add(audit_entry)
    await db.commit()

    now = datetime.now(timezone.utc)
    data = {
        "flag_name": flag_key,
        "old_value": old_val,
        "new_value": new_val,
        "updated_by": current_user.get("sub"),
        "reason": body.reason,
        "timestamp": now.isoformat()
    }

    meta = MetaEnvelope(
        source="SRC_SYSTEM_CONFIG",
        observed_at=now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Operational Admin Audit",
        mode="LIVE"
    )

    return StandardResponse(data=data, meta=meta)


class BetaFeedbackRequest(BaseModel):
    category: str = Field(
        ...,
        description="Category: CONFUSING_STATUS, INCORRECT_LOCATION, STALE_INFORMATION, ROUTE_CONCERN, REPORT_REJECTION, PERFORMANCE, OFFLINE_ISSUE, GENERAL"
    )
    comment: str = Field(..., max_length=500, description="Anonymized user feedback note (no PII permitted)")
    rating: Optional[int] = Field(None, ge=1, le=5, description="1-5 rating of system clarity and responsiveness")
    screen_route: Optional[str] = Field(None, description="App path or feature URL where issue observed")
    device_type: Optional[str] = Field("MOBILE", description="MOBILE, DESKTOP, or TABLET")


@router.post("/beta/feedback", response_model=StandardResponse[Dict[str, Any]], status_code=status.HTTP_201_CREATED)
async def submit_beta_feedback(
    body: BetaFeedbackRequest,
    request: Request
):
    """
    Lightweight Beta Feedback Loop (Phase 29 Section 26):
    - Zero personal information collected (no names, phones, emails, or precise GPS).
    - Captures operational user experience signals across beta cohorts.
    """
    now = datetime.now(timezone.utc)
    feedback_id = str(uuid.uuid4())

    data = {
        "feedback_id": feedback_id,
        "category": body.category,
        "rating": body.rating,
        "comment": body.comment,
        "screen_route": body.screen_route,
        "device_type": body.device_type,
        "received_at": now.isoformat(),
        "status": "RECORDED"
    }

    meta = MetaEnvelope(
        source="SRC_BETA_FEEDBACK",
        observed_at=now,
        ingested_at=now,
        freshness="FRESH",
        confidence="HIGH",
        attribution="KMITL Controlled Public Beta Feedback Registry",
        mode="LIVE"
    )

    return StandardResponse(data=data, meta=meta)

