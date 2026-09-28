from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    APP_NAME: str = "KMITL Flood Intelligence"
    APP_VERSION: str = "1.0.0"
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://kmitl_flood_user:kmitl_flood_password_secure@localhost:5432/kmitl_flood_db"
    DATABASE_SYNC_URL: str = "postgresql://kmitl_flood_user:kmitl_flood_password_secure@localhost:5432/kmitl_flood_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security & CORS
    SECRET_KEY: str = "kmitl_super_secret_key_development_only_replace_in_prod"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # External APIs (Optional credentials — do NOT mark source LIVE unless proven)
    TMD_UID: str = ""
    TMD_UKEY: str = ""
    TRAFFY_API_KEY: str = ""
    COPERNICUS_CLIENT_ID: str = ""
    COPERNICUS_CLIENT_SECRET: str = ""
    BMA_API_KEY: str = ""

    # ─── Phase 26 Beta Zone Boundaries ────────────────────────────────────────
    # Zone A: KMITL campus + immediate roads
    ZONE_A_MIN_LNG: float = 100.7600
    ZONE_A_MIN_LAT: float = 13.7150
    ZONE_A_MAX_LNG: float = 100.7960
    ZONE_A_MAX_LAT: float = 13.7450

    # Zone B: Selected Lat Krabang corridors connected to KMITL
    ZONE_B_MIN_LNG: float = 100.7200
    ZONE_B_MIN_LAT: float = 13.6900
    ZONE_B_MAX_LNG: float = 100.8500
    ZONE_B_MAX_LAT: float = 13.7700

    # Overall bounding box for beta (Zone A ∪ Zone B)
    MIN_LNG: float = 100.6500
    MIN_LAT: float = 13.6500
    MAX_LNG: float = 100.9000
    MAX_LAT: float = 13.8200
    DEFAULT_CENTER_LAT: float = 13.7298
    DEFAULT_CENTER_LNG: float = 100.7782
    DEFAULT_ZOOM: int = 14

    # ─── Phase 26 Feature Flags ────────────────────────────────────────────────
    # Naming convention: FEATURE_FLAG_<FEATURE>
    # Must be explicitly set per environment. No feature is assumed LIVE.

    # External data source toggles
    FEATURE_FLAG_TMD: bool = False           # PENDING_ACCESS — off until credentials verified
    FEATURE_FLAG_BMA: bool = False           # PENDING_ACCESS — off until credentials verified
    FEATURE_FLAG_TRAFFY: bool = False        # PENDING_ACCESS — off until credentials verified
    FEATURE_FLAG_SATELLITE: bool = True      # OBSERVATION mode — Copernicus DEMO fallback
    FEATURE_FLAG_TMD_LIVE: bool = False      # Never True until authenticated live integration verified
    FEATURE_FLAG_BMA_LIVE: bool = False      # Never True until authenticated live integration verified
    FEATURE_FLAG_TRAFFY_LIVE: bool = False   # Never True until authenticated live integration verified

    # Core features
    FEATURE_FLAG_AI_VERIFICATION: bool = True
    FEATURE_FLAG_ROUTING: bool = True
    FEATURE_FLAG_SOS: bool = True
    FEATURE_FLAG_REALTIME: bool = True
    FEATURE_FLAG_PUBLIC_REPORTS: bool = True
    FEATURE_FLAG_ADMIN_OPERATIONS: bool = True
    FEATURE_FLAG_ANALYTICS: bool = True
    FEATURE_FLAG_REPLAY: bool = True

    # Beta controls
    FEATURE_FLAG_BETA_LATKRABANG_ENABLED: bool = True   # Zone B expanded to Lat Krabang
    FEATURE_FLAG_LOW_BANDWIDTH_MODE: bool = False        # Auto-detected client-side; override here
    FEATURE_FLAG_EMERGENCY_MODE: bool = False            # Controlled escalation only
    FEATURE_FLAG_FIELD_TEST_ACCOUNTS: bool = True        # Dedicated credentials for field testing
    FEATURE_FLAG_GEOFENCE_ENFORCEMENT: bool = True       # Enforce beta zone boundaries

    # SOS operational mode: PILOT_TEST or OPERATIONAL
    # OPERATIONAL requires documented operator ownership before enabling
    SOS_OPERATIONAL_MODE: str = "PILOT_TEST"
    SOS_OPERATOR_CONTACT: str = ""           # Required for OPERATIONAL mode
    SOS_OPERATOR_DOCUMENTED: bool = False    # Must be True for OPERATIONAL mode

    # Operational mode: NORMAL, ELEVATED, EMERGENCY
    OPERATIONAL_MODE: str = "NORMAL"

    # Clustering parameters (configurable, not hard-coded)
    CLUSTERING_DISTANCE_METERS: float = 150.0
    CLUSTERING_TIME_WINDOW_MINUTES: float = 45.0
    CLUSTERING_MIN_REPORTS: int = 2

    # Rate limiting
    REPORT_RATE_LIMIT_PER_SESSION_PER_HOUR: int = 10
    SOS_RATE_LIMIT_PER_SESSION_PER_HOUR: int = 3

    # Freshness thresholds (minutes)
    FRESHNESS_FRESH_MAX_MIN: int = 15
    FRESHNESS_RECENT_MAX_MIN: int = 30
    FRESHNESS_AGING_MAX_MIN: int = 60
    FRESHNESS_STALE_MAX_MIN: int = 120
    # Beyond STALE_MAX_MIN → EXPIRED

    # Cloud Infrastructure (AWS / Production)
    SQS_QUEUE_URL: str = ""
    SQS_DLQ_URL: str = ""
    S3_BUCKET_NAME: str = ""
    S3_REGION: str = "ap-southeast-1"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def sos_operational_ready(self) -> bool:
        """SOS is safe for operational mode only when operator ownership is documented."""
        return (
            self.SOS_OPERATIONAL_MODE == "OPERATIONAL"
            and self.SOS_OPERATOR_DOCUMENTED
            and bool(self.SOS_OPERATOR_CONTACT)
        )

    def validate_production_readiness(self) -> List[str]:
        """
        Fail-fast validation for environment separation.
        Returns a list of blocking errors if production configuration is insecure.
        """
        errors = []
        if self.ENVIRONMENT.lower() == "production":
            if self.DEBUG:
                errors.append("DEBUG mode must be False in production.")
            if "development_only" in self.SECRET_KEY or "dev_super_secret" in self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                errors.append("SECRET_KEY is still set to the default insecure value in production environment.")
            if "localhost" in self.DATABASE_URL:
                errors.append("DATABASE_URL points to localhost in production environment.")
            if not self.SQS_QUEUE_URL:
                errors.append("SQS_QUEUE_URL must be configured for Tier 1 durable queue in production.")
        return errors


settings = Settings()


def validate_production_readiness(custom_settings: Optional[Settings] = None) -> List[str]:
    """
    Module-level fast-fail validator for application startup and test suites.
    Raises ValueError if production settings fail validation.
    """
    cfg = custom_settings or settings
    errors = cfg.validate_production_readiness()
    if errors and cfg.ENVIRONMENT.lower() == "production":
        raise ValueError(f"Production readiness validation failed: {'; '.join(errors)}")
    return errors

