"""001_initial_schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-28 11:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import geoalchemy2

revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable PostGIS & UUID extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis;')
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')

    # 2. Data Sources
    op.create_table(
        'data_sources',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('source_type', sa.String(length=50), nullable=False),
        sa.Column('endpoint_url', sa.Text(), nullable=True),
        sa.Column('update_frequency_minutes', sa.Integer(), nullable=False),
        sa.Column('spatial_resolution_meters', sa.Float(), nullable=True),
        sa.Column('temporal_resolution_minutes', sa.Integer(), nullable=True),
        sa.Column('reliability_score', sa.Float(), nullable=False),
        sa.Column('attribution', sa.Text(), nullable=False),
        sa.Column('license', sa.Text(), nullable=False),
        sa.Column('last_success_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_error_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_error_message', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 3. Data Ingestion Logs
    op.create_table(
        'data_ingestion_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('source_id', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('records_ingested', sa.Integer(), nullable=False),
        sa.Column('http_status', sa.Integer(), nullable=True),
        sa.Column('execution_duration_ms', sa.Integer(), nullable=True),
        sa.Column('error_details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['source_id'], ['data_sources.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # 4. Incidents Table
    op.create_table(
        'incidents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('incident_number', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('boundary', geoalchemy2.types.Geometry(geometry_type='POLYGON', srid=4326), nullable=True),
        sa.Column('centroid', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('report_count', sa.Integer(), nullable=False),
        sa.Column('consensus_depth_band', sa.String(length=50), nullable=False),
        sa.Column('consensus_passability', sa.String(length=50), nullable=False),
        sa.Column('confidence', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('first_reported_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_reported_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('incident_number')
    )
    op.execute('CREATE INDEX idx_incidents_centroid ON incidents USING GIST (centroid);')

    # 5. Flood Reports Table
    op.create_table(
        'flood_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', sa.String(length=100), nullable=True),
        sa.Column('location', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('water_depth_band', sa.String(length=50), nullable=False),
        sa.Column('vehicle_passability', sa.String(length=50), nullable=False),
        sa.Column('transport_type', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('photo_url', sa.Text(), nullable=True),
        sa.Column('image_hash', sa.String(length=64), nullable=True),
        sa.Column('image_quality_score', sa.Float(), nullable=True),
        sa.Column('is_image_verified', sa.Boolean(), nullable=False),
        sa.Column('ai_flood_detected', sa.Boolean(), nullable=True),
        sa.Column('ai_road_detected', sa.Boolean(), nullable=True),
        sa.Column('ai_confidence', sa.Float(), nullable=True),
        sa.Column('ai_estimated_depth_band', sa.String(length=50), nullable=True),
        sa.Column('verification_status', sa.String(length=20), nullable=False),
        sa.Column('confidence', sa.String(length=50), nullable=False),
        sa.Column('freshness', sa.String(length=50), nullable=False),
        sa.Column('observed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('incident_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['incident_id'], ['incidents.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.execute('CREATE INDEX idx_flood_reports_location ON flood_reports USING GIST (location);')
    op.create_index('idx_flood_reports_observed_at', 'flood_reports', ['observed_at'])

    # 6. Water Stations Table
    op.create_table(
        'water_stations',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('source_id', sa.String(length=50), nullable=False),
        sa.Column('station_type', sa.String(length=50), nullable=False),
        sa.Column('location', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('warning_threshold_meters', sa.Float(), nullable=True),
        sa.Column('critical_threshold_meters', sa.Float(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['source_id'], ['data_sources.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.execute('CREATE INDEX idx_water_stations_location ON water_stations USING GIST (location);')

    # 7. Water Observations Table
    op.create_table(
        'water_observations',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('station_id', sa.String(length=50), nullable=False),
        sa.Column('water_level_m_msl', sa.Float(), nullable=False),
        sa.Column('water_delta_10m', sa.Float(), nullable=True),
        sa.Column('water_delta_30m', sa.Float(), nullable=True),
        sa.Column('water_delta_60m', sa.Float(), nullable=True),
        sa.Column('trend', sa.String(length=20), nullable=True),
        sa.Column('observed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ingested_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['station_id'], ['water_stations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_water_obs_time', 'water_observations', ['station_id', 'observed_at'])

    # 8. Rain Observations Table
    op.create_table(
        'rain_observations',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('source_id', sa.String(length=50), nullable=False),
        sa.Column('location', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326), nullable=True),
        sa.Column('grid_bounds', geoalchemy2.types.Geometry(geometry_type='POLYGON', srid=4326), nullable=True),
        sa.Column('reflectivity_dbz', sa.Float(), nullable=True),
        sa.Column('rain_rate_mm_hr', sa.Float(), nullable=False),
        sa.Column('rain_intensity_band', sa.String(length=20), nullable=False),
        sa.Column('observed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ingested_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['source_id'], ['data_sources.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # 9. Satellite Observations Table
    op.create_table(
        'satellite_observations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('source_id', sa.String(length=50), nullable=False),
        sa.Column('satellite_name', sa.String(length=50), nullable=False),
        sa.Column('footprint', geoalchemy2.types.Geometry(geometry_type='POLYGON', srid=4326), nullable=False),
        sa.Column('water_polygons', geoalchemy2.types.Geometry(geometry_type='MULTIPOLYGON', srid=4326), nullable=False),
        sa.Column('spatial_resolution_meters', sa.Float(), nullable=False),
        sa.Column('confidence', sa.String(length=50), nullable=False),
        sa.Column('acquisition_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['source_id'], ['data_sources.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.execute('CREATE INDEX idx_sat_water_polygons ON satellite_observations USING GIST (water_polygons);')

    # 10. Risk Observations Table
    op.create_table(
        'risk_observations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('zone_id', sa.String(length=50), nullable=False),
        sa.Column('boundary', geoalchemy2.types.Geometry(geometry_type='POLYGON', srid=4326), nullable=False),
        sa.Column('risk_level', sa.String(length=20), nullable=False),
        sa.Column('risk_score', sa.Float(), nullable=False),
        sa.Column('confidence', sa.String(length=50), nullable=False),
        sa.Column('data_quality', sa.String(length=20), nullable=False),
        sa.Column('contributing_factors', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('observed_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 11. Roads Table
    op.create_table(
        'roads',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=True),
        sa.Column('highway_type', sa.String(length=50), nullable=False),
        sa.Column('geometry', geoalchemy2.types.Geometry(geometry_type='LINESTRING', srid=4326), nullable=False),
        sa.Column('elevation_m', sa.Float(), nullable=True),
        sa.Column('current_flood_exposure', sa.String(length=20), nullable=False),
        sa.Column('current_depth_band', sa.String(length=50), nullable=False),
        sa.Column('latest_incident_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('last_evaluated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['latest_incident_id'], ['incidents.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.execute('CREATE INDEX idx_roads_geometry ON roads USING GIST (geometry);')

    # 12. Help Requests (SOS) Table
    op.create_table(
        'help_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ticket_number', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('requester_name', sa.String(length=100), nullable=True),
        sa.Column('contact_phone', sa.String(length=50), nullable=True),
        sa.Column('location', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('help_type', sa.String(length=50), nullable=False),
        sa.Column('priority', sa.String(length=50), nullable=False),
        sa.Column('people_count', sa.Integer(), nullable=False),
        sa.Column('vulnerable_details', sa.Text(), nullable=True),
        sa.Column('current_water_level', sa.String(length=50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('assigned_to', sa.String(length=100), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticket_number')
    )
    op.execute('CREATE INDEX idx_help_requests_location ON help_requests USING GIST (location);')

    # 13. Assistance Points Table
    op.create_table(
        'assistance_points',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('point_type', sa.String(length=50), nullable=False),
        sa.Column('location', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=True),
        sa.Column('current_occupancy', sa.Integer(), nullable=False),
        sa.Column('is_verified', sa.Boolean(), nullable=False),
        sa.Column('contact_number', sa.String(length=50), nullable=True),
        sa.Column('operating_hours', sa.String(length=100), nullable=True),
        sa.Column('last_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.execute('CREATE INDEX idx_assistance_points_location ON assistance_points USING GIST (location);')

    # 14. Audit Logs Table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('actor_id', sa.String(length=100), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('target_table', sa.String(length=50), nullable=False),
        sa.Column('target_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('old_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('new_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('assistance_points')
    op.drop_table('help_requests')
    op.drop_table('roads')
    op.drop_table('risk_observations')
    op.drop_table('satellite_observations')
    op.drop_table('rain_observations')
    op.drop_table('water_observations')
    op.drop_table('water_stations')
    op.drop_table('flood_reports')
    op.drop_table('incidents')
    op.drop_table('data_ingestion_logs')
    op.drop_table('data_sources')
