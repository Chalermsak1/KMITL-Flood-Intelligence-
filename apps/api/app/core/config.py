from typing import List
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

    # External APIs (Optional credentials)
    TMD_UID: str = ""
    TMD_UKEY: str = ""
    TRAFFY_API_KEY: str = ""
    COPERNICUS_CLIENT_ID: str = ""
    COPERNICUS_CLIENT_SECRET: str = ""

    # Lat Krabang Bounding Box
    MIN_LNG: float = 100.6500
    MIN_LAT: float = 13.6500
    MAX_LNG: float = 100.9000
    MAX_LAT: float = 13.8200
    DEFAULT_CENTER_LAT: float = 13.7298
    DEFAULT_CENTER_LNG: float = 100.7782
    DEFAULT_ZOOM: int = 14

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()
