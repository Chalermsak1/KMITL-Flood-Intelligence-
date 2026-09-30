"""002_data_sources_and_events

Revision ID: 002_data_sources_and_events
Revises: 001_initial_schema
Create Date: 2026-09-29 13:16:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '002_data_sources_and_events'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add missing columns to data_sources
    op.add_column('data_sources', sa.Column('status', sa.String(length=20), nullable=False, server_default='AVAILABLE'))
    op.add_column('data_sources', sa.Column('mode', sa.String(length=20), nullable=False, server_default='LIVE'))
    op.add_column('data_sources', sa.Column('last_attempt_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('data_sources', sa.Column('latency_ms', sa.Integer(), nullable=True))
    op.add_column('data_sources', sa.Column('records_last_success', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('data_sources', sa.Column('schema_version', sa.String(length=20), nullable=False, server_default='1.0'))
    op.add_column('data_sources', sa.Column('availability_notes', sa.Text(), nullable=True))

    # 2. flood_events
    op.create_table(
        'flood_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('area', sa.String(length=100), nullable=False, server_default='KMITL & Lat Krabang'),
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('peak_risk', sa.String(length=20), nullable=False, server_default='HIGH'),
        sa.Column('peak_reports', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('source', sa.String(length=100), nullable=False, server_default='HISTORICAL_ARCHIVE'),
        sa.Column('mode', sa.String(length=20), nullable=False, server_default='DEMO'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 3. event_snapshots
    op.create_table(
        'event_snapshots',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('snapshot_timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('rain_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('water_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('reports_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('incidents_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('risk_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('satellite_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['flood_events.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 4. source_activation_records
    op.create_table(
        'source_activation_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('source_id', sa.String(length=50), nullable=False),
        sa.Column('requested_by', sa.String(length=100), nullable=False),
        sa.Column('approved_by', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='PENDING_ACCESS'),
        sa.Column('credential_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('health_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('first_success', sa.DateTime(timezone=True), nullable=True),
        sa.Column('first_persisted_observation', sa.DateTime(timezone=True), nullable=True),
        sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rollback_flag', sa.String(length=50), nullable=False, server_default='FEATURE_FLAG_TMD_LIVE'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('source_activation_records')
    op.drop_table('event_snapshots')
    op.drop_table('flood_events')
    op.drop_column('data_sources', 'availability_notes')
    op.drop_column('data_sources', 'schema_version')
    op.drop_column('data_sources', 'records_last_success')
    op.drop_column('data_sources', 'latency_ms')
    op.drop_column('data_sources', 'last_attempt_at')
    op.drop_column('data_sources', 'mode')
    op.drop_column('data_sources', 'status')
