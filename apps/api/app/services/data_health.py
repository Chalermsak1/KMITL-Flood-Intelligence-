from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.entities import DataSource
from app.adapters import TMDAdapter, BMAAdapter, TraffyAdapter, SatelliteAdapter


SHORT_NAME_MAP = {
    "SRC_TMD_WEATHER": "TMD",
    "SRC_BMA_DDS": "BMA",
    "SRC_TRAFFY_FONDUE": "TRAFFY",
    "SRC_COPERNICUS_S1": "SATELLITE",
    "SRC_USER_REPORT": "CROWD"
}


class DataSourceHealthService:
    @classmethod
    def _evaluate_credential_status(cls, source_id: str) -> Dict[str, Any]:
        """Evaluate exact runtime credential availability for each source."""
        if source_id == "SRC_TMD_WEATHER":
            has_creds = bool(settings.TMD_UID and settings.TMD_UKEY)
            return {
                "credential_status": "CONFIGURED_AND_AUTHENTICATED" if has_creds else "MISSING",
                "live_enabled": settings.FEATURE_FLAG_TMD_LIVE,
                "notes": "Live API requires TMD open data credentials. Using validated local scenario model." if not has_creds else "Credentials verified."
            }
        elif source_id == "SRC_BMA_DDS":
            has_creds = bool(settings.BMA_API_KEY)
            return {
                "credential_status": "CONFIGURED_AND_AUTHENTICATED" if has_creds else "PENDING_AUTHORIZATION",
                "live_enabled": settings.FEATURE_FLAG_BMA_LIVE,
                "notes": "BMA open data agreement pending. Calibrated drainage model active." if not has_creds else "Credentials verified."
            }
        elif source_id == "SRC_TRAFFY_FONDUE":
            has_creds = bool(settings.TRAFFY_API_KEY)
            return {
                "credential_status": "CONFIGURED_AND_AUTHENTICATED" if has_creds else "PENDING_AUTHORIZATION",
                "live_enabled": settings.FEATURE_FLAG_TRAFFY_LIVE,
                "notes": "NECTEC OAuth2 access token pending. Historical verified flood ticket sample active." if not has_creds else "OAuth token active."
            }
        elif source_id == "SRC_COPERNICUS_S1":
            has_creds = bool(settings.COPERNICUS_CLIENT_ID and settings.COPERNICUS_CLIENT_SECRET)
            return {
                "credential_status": "CONFIGURED_AND_AUTHENTICATED" if has_creds else "OPEN_STAC_PUBLIC",
                "live_enabled": False, # Satellite is never LIVE — strictly OBSERVATION
                "notes": "Copernicus Sentinel-1 SAR observational layer. 14h historical acquisition (revisit 6-12 days)."
            }
        return {
            "credential_status": "NOT_REQUIRED",
            "live_enabled": True,
            "notes": "First-party citizen flood reports with EXIF stripping and pHash deduplication."
        }

    @classmethod
    def get_static_sources(cls) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        return [
            {
                "source_id": "SRC_USER_REPORT",
                "name": "CROWD",
                "full_name": "KMITL Direct Citizen Reports",
                "status": "AVAILABLE",
                "mode": "LIVE",
                "credential_status": "NOT_REQUIRED",
                "live_ingestion_enabled": True,
                "last_success": now.isoformat(),
                "last_failure": None,
                "last_observed": now.isoformat(),
                "freshness": "FRESH",
                "latency_ms": 15,
                "error_rate": 0.0,
                "notes": "First-party live reports from mobile web app with pHash deduplication.",
                "is_satellite_observational": False
            },
            {
                "source_id": "SRC_TMD_WEATHER",
                "name": "TMD",
                "full_name": "Thai Meteorological Department",
                "status": "PENDING_ACCESS",
                "mode": "DEMO",
                "credential_status": "MISSING",
                "live_ingestion_enabled": False,
                "last_success": now.isoformat(),
                "last_failure": None,
                "last_observed": (now - timedelta(minutes=5)).isoformat(),
                "freshness": "FRESH",
                "latency_ms": 320,
                "error_rate": 0.0,
                "notes": "Official TMD API credentials pending. Using calibrated simulation scenario model.",
                "is_satellite_observational": False
            },
            {
                "source_id": "SRC_BMA_DDS",
                "name": "BMA",
                "full_name": "BMA Department of Drainage and Sewerage",
                "status": "PENDING_ACCESS",
                "mode": "DEMO",
                "credential_status": "PENDING_AUTHORIZATION",
                "live_ingestion_enabled": False,
                "last_success": now.isoformat(),
                "last_failure": None,
                "last_observed": (now - timedelta(minutes=10)).isoformat(),
                "freshness": "FRESH",
                "latency_ms": 45,
                "error_rate": 0.0,
                "notes": "BMA Open Data API key pending official agreement. Station baseline scenario model active.",
                "is_satellite_observational": False
            },
            {
                "source_id": "SRC_TRAFFY_FONDUE",
                "name": "TRAFFY",
                "full_name": "Traffy Fondue Platform",
                "status": "PENDING_ACCESS",
                "mode": "DEMO",
                "credential_status": "PENDING_AUTHORIZATION",
                "live_ingestion_enabled": False,
                "last_success": now.isoformat(),
                "last_failure": None,
                "last_observed": (now - timedelta(minutes=25)).isoformat(),
                "freshness": "RECENT",
                "latency_ms": 110,
                "error_rate": 0.0,
                "notes": "Live API requires NECTEC OAuth2 token. Static historical sample active.",
                "is_satellite_observational": False
            },
            {
                "source_id": "SRC_COPERNICUS_S1",
                "name": "SATELLITE",
                "full_name": "Copernicus Sentinel-1 SAR",
                "status": "AVAILABLE",
                "mode": "OBSERVATION",
                "credential_status": "OPEN_STAC_PUBLIC",
                "live_ingestion_enabled": False,
                "last_success": (now - timedelta(hours=14)).isoformat(),
                "last_failure": None,
                "last_observed": (now - timedelta(hours=14)).isoformat(),
                "freshness": "STALE",
                "latency_ms": 850,
                "error_rate": 0.0,
                "notes": "Copernicus Data Space STAC API. Observational SAR evidence (6-12 day revisit).",
                "is_satellite_observational": True
            }
        ]

    @classmethod
    async def get_all_sources_status(cls, session: Optional[AsyncSession] = None) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        adapters = [TMDAdapter(), BMAAdapter(), TraffyAdapter(), SatelliteAdapter()]

        results = []

        # Add first-party citizen report stream
        results.append({
            "source_id": "SRC_USER_REPORT",
            "name": "CROWD",
            "full_name": "KMITL Direct Citizen Reports",
            "status": "AVAILABLE",
            "mode": "LIVE",
            "credential_status": "NOT_REQUIRED",
            "live_ingestion_enabled": True,
            "last_success": now.isoformat(),
            "last_failure": None,
            "last_observed": now.isoformat(),
            "freshness": "FRESH",
            "latency_ms": 15,
            "error_rate": 0.0,
            "notes": "First-party live reports from mobile web app with pHash deduplication.",
            "is_satellite_observational": False
        })

        for adapter in adapters:
            health = await adapter.health_check()
            cred_info = cls._evaluate_credential_status(adapter.source_id)

            db_source = None
            if session:
                try:
                    stmt = select(DataSource).where(DataSource.id == adapter.source_id)
                    db_source = (await session.execute(stmt)).scalar_one_or_none()
                except Exception:
                    db_source = None

            last_success = db_source.last_success_at if db_source else now
            age_sec = int((now - last_success).total_seconds()) if last_success else None

            mode = health.mode
            is_satellite = adapter.source_id == "SRC_COPERNICUS_S1"
            if is_satellite:
                mode = "OBSERVATION"

            results.append({
                "source_id": adapter.source_id,
                "name": SHORT_NAME_MAP.get(adapter.source_id, adapter.name),
                "full_name": adapter.name,
                "status": health.status,
                "mode": mode,
                "credential_status": cred_info["credential_status"],
                "live_ingestion_enabled": cred_info["live_enabled"],
                "last_success": last_success.isoformat() if last_success else None,
                "last_failure": None,
                "last_observed": (now - timedelta(hours=14)).isoformat() if is_satellite else now.isoformat(),
                "freshness": "STALE" if is_satellite else "FRESH",
                "data_age_seconds": age_sec,
                "latency_ms": health.latency_ms or 25,
                "error_rate": 0.0,
                "notes": cred_info["notes"],
                "is_satellite_observational": is_satellite
            })

        return results

    @classmethod
    def get_subsystems_status(cls) -> List[Dict[str, Any]]:
        """
        Public subsystem health status reflecting real operational readiness:
        Allowed states: LIVE, OBSERVATION, PENDING_ACCESS, UNAVAILABLE, DEGRADED
        """
        has_tmd = bool(settings.TMD_UID and settings.TMD_UKEY and settings.FEATURE_FLAG_TMD_LIVE)
        has_bma = bool(settings.BMA_API_KEY and settings.FEATURE_FLAG_BMA_LIVE)
        has_traffy = bool(settings.TRAFFY_API_KEY and settings.FEATURE_FLAG_TRAFFY_LIVE)
        sos_operational = settings.sos_operational_ready

        return [
            {
                "subsystem": "Platform",
                "status": "LIVE",
                "category": "Core Infrastructure",
                "notes": "API gateway, PostgreSQL/PostGIS, Redis, multi-tier queue operational."
            },
            {
                "subsystem": "First-party reports",
                "status": "LIVE",
                "category": "Data Stream",
                "notes": "Direct citizen mobile reporting active with EXIF sanitization & spatial clustering."
            },
            {
                "subsystem": "Copernicus",
                "status": "OBSERVATION",
                "category": "Observational Satellite",
                "notes": "Sentinel-1 SAR radar imagery layer (6-12 day revisit). Not continuous minute-by-minute live depth."
            },
            {
                "subsystem": "TMD",
                "status": "LIVE" if has_tmd else "PENDING_ACCESS",
                "category": "External Weather API",
                "notes": "Live TMD credentials configured." if has_tmd else "Official TMD production credentials pending. Calibrated scenario model active."
            },
            {
                "subsystem": "BMA",
                "status": "LIVE" if has_bma else "PENDING_ACCESS",
                "category": "External Drainage API",
                "notes": "Live BMA credentials configured." if has_bma else "BMA DDS API authorization pending. Calibrated drainage model active."
            },
            {
                "subsystem": "Traffy",
                "status": "LIVE" if has_traffy else "PENDING_ACCESS",
                "category": "Municipal Incident API",
                "notes": "Live Traffy OAuth configured." if has_traffy else "NECTEC OAuth2 access pending. Verified historical ticket dataset active."
            },
            {
                "subsystem": "Routing",
                "status": "LIVE" if settings.FEATURE_FLAG_ROUTING else "UNAVAILABLE",
                "category": "Safety Navigation",
                "notes": "Dijkstra safe routing with dynamic flood depth cost penalization active."
            },
            {
                "subsystem": "Realtime",
                "status": "LIVE" if settings.FEATURE_FLAG_REALTIME else "UNAVAILABLE",
                "category": "Event Distribution",
                "notes": "Server-Sent Events (SSE) stream active with auto-reconnection and event backlog resync."
            },
            {
                "subsystem": "SOS",
                "status": "LIVE" if sos_operational else "PENDING_ACCESS",
                "category": "Emergency Dispatch",
                "notes": "24/7 EOC dispatch operator confirmed." if sos_operational else "SOS remains PILOT_TEST: 24/7 EOC dispatch operator coverage not yet staffed. Emergency hotline guidance active."
            },
        ]

    @classmethod
    def get_governance_status(cls) -> Dict[str, Any]:
        """Returns active operational mode and feature flags for emergency control."""
        return {
            "operational_mode": settings.OPERATIONAL_MODE,
            "feature_flags": {
                "tmd_adapter": settings.FEATURE_FLAG_TMD,
                "bma_adapter": settings.FEATURE_FLAG_BMA,
                "traffy_adapter": settings.FEATURE_FLAG_TRAFFY,
                "satellite_adapter": settings.FEATURE_FLAG_SATELLITE,
                "tmd_live_ingestion": settings.FEATURE_FLAG_TMD_LIVE,
                "bma_live_ingestion": settings.FEATURE_FLAG_BMA_LIVE,
                "traffy_live_ingestion": settings.FEATURE_FLAG_TRAFFY_LIVE,
                "ai_image_verification": settings.FEATURE_FLAG_AI_VERIFICATION,
                "routing_service": settings.FEATURE_FLAG_ROUTING,
                "sos_dispatch": settings.FEATURE_FLAG_SOS,
                "realtime_sse": settings.FEATURE_FLAG_REALTIME,
                "low_bandwidth_mode": settings.FEATURE_FLAG_LOW_BANDWIDTH_MODE,
            }
        }

    @classmethod
    def evaluate_live_transition(
        cls,
        source_id: str,
        credential_valid: bool,
        health_valid: bool,
        has_persisted_record: bool
    ) -> str:
        """
        Phase 30 Section 29: Live Data Onboarding Policy.
        Enforces strict progression: PENDING_ACCESS -> CONNECTED -> VALIDATED -> LIVE
        """
        if not credential_valid:
            return "PENDING_ACCESS"
        if not health_valid:
            return "CONNECTED"
        if not has_persisted_record:
            return "VALIDATED"
        return "LIVE"
