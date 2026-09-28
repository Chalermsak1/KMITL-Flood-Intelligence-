import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime,
    ForeignKey, BigInteger, Enum as SQLEnum, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, Mapped, mapped_column
from geoalchemy2 import Geometry

from app.core.database import Base
from app.models.enums import (
    WaterDepthBand, VehiclePassability, TransportType,
    ReportFreshness, ConfidenceLevel, IncidentStatus,
    HelpPriority, HelpStatus, HelpType
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DataSource(Base):
    __tablename__ = "data_sources"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    endpoint_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    update_frequency_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    spatial_resolution_meters: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    temporal_resolution_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reliability_score: Mapped[float] = mapped_column(Float, default=0.8)
    attribution: Mapped[str] = mapped_column(Text, nullable=False)
    license: Mapped[str] = mapped_column(Text, nullable=False)
    last_success_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    logs: Mapped[List["DataIngestionLog"]] = relationship("DataIngestionLog", back_populates="source")


class DataIngestionLog(Base):
    __tablename__ = "data_ingestion_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id: Mapped[str] = mapped_column(String(50), ForeignKey("data_sources.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # SUCCESS, FAILED, TIMEOUT
    records_ingested: Mapped[int] = mapped_column(Integer, default=0)
    http_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    execution_duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    source: Mapped["DataSource"] = relationship("DataSource", back_populates="logs")


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_number: Mapped[int] = mapped_column(Integer, autoincrement=True, unique=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    boundary = mapped_column(Geometry(geometry_type="POLYGON", srid=4326), nullable=True)
    centroid = mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    report_count: Mapped[int] = mapped_column(Integer, default=1)
    consensus_depth_band: Mapped[WaterDepthBand] = mapped_column(
        SQLEnum(WaterDepthBand, name="water_depth_band"), default=WaterDepthBand.UNKNOWN
    )
    consensus_passability: Mapped[VehiclePassability] = mapped_column(
        SQLEnum(VehiclePassability, name="vehicle_passability"), default=VehiclePassability.UNKNOWN
    )
    confidence: Mapped[ConfidenceLevel] = mapped_column(
        SQLEnum(ConfidenceLevel, name="confidence_level"), default=ConfidenceLevel.MEDIUM
    )
    status: Mapped[IncidentStatus] = mapped_column(
        SQLEnum(IncidentStatus, name="incident_status"), default=IncidentStatus.ACTIVE
    )
    first_reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    last_reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    reports: Mapped[List["FloodReport"]] = relationship("FloodReport", back_populates="incident")


class FloodReport(Base):
    __tablename__ = "flood_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    location = mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    water_depth_band: Mapped[WaterDepthBand] = mapped_column(
        SQLEnum(WaterDepthBand, name="water_depth_band"), nullable=False
    )
    vehicle_passability: Mapped[VehiclePassability] = mapped_column(
        SQLEnum(VehiclePassability, name="vehicle_passability"), default=VehiclePassability.UNKNOWN
    )
    transport_type: Mapped[TransportType] = mapped_column(
        SQLEnum(TransportType, name="transport_type"), default=TransportType.CAR
    )
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    image_quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_image_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_flood_detected: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    ai_road_detected: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    ai_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_estimated_depth_band: Mapped[Optional[WaterDepthBand]] = mapped_column(
        SQLEnum(WaterDepthBand, name="water_depth_band"), nullable=True
    )
    verification_status: Mapped[str] = mapped_column(String(20), default="UNVERIFIED")
    confidence: Mapped[ConfidenceLevel] = mapped_column(
        SQLEnum(ConfidenceLevel, name="confidence_level"), default=ConfidenceLevel.LOW
    )
    freshness: Mapped[ReportFreshness] = mapped_column(
        SQLEnum(ReportFreshness, name="report_freshness"), default=ReportFreshness.FRESH
    )
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    incident_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True
    )

    incident: Mapped[Optional["Incident"]] = relationship("Incident", back_populates="reports")


class WaterStation(Base):
    __tablename__ = "water_stations"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    source_id: Mapped[str] = mapped_column(String(50), ForeignKey("data_sources.id"), nullable=False)
    station_type: Mapped[str] = mapped_column(String(50), nullable=False)  # CANAL_GAUGE, RETENTION_POND
    location = mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    warning_threshold_meters: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    critical_threshold_meters: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    observations: Mapped[List["WaterObservation"]] = relationship("WaterObservation", back_populates="station")


class WaterObservation(Base):
    __tablename__ = "water_observations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    station_id: Mapped[str] = mapped_column(String(50), ForeignKey("water_stations.id"), nullable=False)
    water_level_m_msl: Mapped[float] = mapped_column(Float, nullable=False)
    water_delta_10m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    water_delta_30m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    water_delta_60m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    trend: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # RISING, STABLE, FALLING
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    station: Mapped["WaterStation"] = relationship("WaterStation", back_populates="observations")


class RainObservation(Base):
    __tablename__ = "rain_observations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source_id: Mapped[str] = mapped_column(String(50), ForeignKey("data_sources.id"), nullable=False)
    location = mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=True)
    grid_bounds = mapped_column(Geometry(geometry_type="POLYGON", srid=4326), nullable=True)
    reflectivity_dbz: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rain_rate_mm_hr: Mapped[float] = mapped_column(Float, nullable=False)
    rain_intensity_band: Mapped[str] = mapped_column(String(20), nullable=False)  # NONE, LIGHT, MODERATE, HEAVY
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class SatelliteObservation(Base):
    __tablename__ = "satellite_observations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id: Mapped[str] = mapped_column(String(50), ForeignKey("data_sources.id"), nullable=False)
    satellite_name: Mapped[str] = mapped_column(String(50), nullable=False)
    footprint = mapped_column(Geometry(geometry_type="POLYGON", srid=4326), nullable=False)
    water_polygons = mapped_column(Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=False)
    spatial_resolution_meters: Mapped[float] = mapped_column(Float, default=30.0)
    confidence: Mapped[ConfidenceLevel] = mapped_column(
        SQLEnum(ConfidenceLevel, name="confidence_level"), default=ConfidenceLevel.MEDIUM
    )
    acquisition_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    extra_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)


class RiskObservation(Base):
    __tablename__ = "risk_observations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id: Mapped[str] = mapped_column(String(50), nullable=False)
    boundary = mapped_column(Geometry(geometry_type="POLYGON", srid=4326), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)  # LOW, MODERATE, HIGH, CRITICAL, UNKNOWN
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0 to 100
    confidence: Mapped[ConfidenceLevel] = mapped_column(
        SQLEnum(ConfidenceLevel, name="confidence_level"), default=ConfidenceLevel.MEDIUM
    )
    data_quality: Mapped[str] = mapped_column(String(20), default="MEDIUM")
    contributing_factors: Mapped[dict] = mapped_column(JSONB, nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Road(Base):
    __tablename__ = "roads"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)  # OSM Way ID
    name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    highway_type: Mapped[str] = mapped_column(String(50), nullable=False)
    geometry = mapped_column(Geometry(geometry_type="LINESTRING", srid=4326), nullable=False)
    elevation_m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    current_flood_exposure: Mapped[str] = mapped_column(String(20), default="UNKNOWN")
    current_depth_band: Mapped[WaterDepthBand] = mapped_column(
        SQLEnum(WaterDepthBand, name="water_depth_band"), default=WaterDepthBand.UNKNOWN
    )
    latest_incident_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=True
    )
    last_evaluated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class HelpRequest(Base):
    __tablename__ = "help_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_number: Mapped[int] = mapped_column(Integer, autoincrement=True, unique=True)
    requester_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    location = mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    help_type: Mapped[HelpType] = mapped_column(
        SQLEnum(HelpType, name="help_type"), nullable=False, default=HelpType.OTHER
    )
    priority: Mapped[HelpPriority] = mapped_column(
        SQLEnum(HelpPriority, name="help_priority"), default=HelpPriority.MEDIUM
    )
    people_count: Mapped[int] = mapped_column(Integer, default=1)
    vulnerable_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    current_water_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[HelpStatus] = mapped_column(
        SQLEnum(HelpStatus, name="help_status"), default=HelpStatus.OPEN
    )
    assigned_to: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class AssistancePoint(Base):
    __tablename__ = "assistance_points"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    point_type: Mapped[str] = mapped_column(String(50), nullable=False)  # SHELTER, MEDICAL, FOOD_WATER
    location = mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    capacity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    current_occupancy: Mapped[int] = mapped_column(Integer, default=0)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    contact_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    operating_hours: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    actor_id: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    target_table: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    old_value: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
