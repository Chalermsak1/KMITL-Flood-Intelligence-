import logging
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from geoalchemy2.shape import from_shape
from shapely.geometry import Point

from app.adapters.traffy import TraffyAdapter
from app.core.database import AsyncSessionLocal
from app.core.redis import publish_event
from app.models.entities import DataSource, FloodReport, DataIngestionLog
from app.models.enums import WaterDepthBand, VehiclePassability, TransportType, ReportFreshness, ConfidenceLevel

logger = logging.getLogger("worker.traffy")


class TraffyWorker:
    def __init__(self):
        self.adapter = TraffyAdapter()
        self.source_id = "SRC_TRAFFY_FONDUE"

    async def run_once(self) -> int:
        """
        Execute a single ingestion cycle for Traffy Fondue community reports.
        """
        start_time = datetime.now(timezone.utc)
        logger.info(f"Starting ingestion cycle for {self.source_id}")

        async with AsyncSessionLocal() as session:
            try:
                records = await self.adapter.fetch()
                normalized = [self.adapter.normalize(r) for r in records if self.adapter.validate(r)]
                now = datetime.now(timezone.utc)
                latency_ms = int((now - start_time).total_seconds() * 1000)

                persisted_count = 0
                for item in normalized:
                    raw = item.raw_data
                    geom_point = from_shape(Point(item.longitude, item.latitude), srid=4326)
                    report = FloodReport(
                        id=uuid.uuid4(),
                        latitude=item.latitude,
                        longitude=item.longitude,
                        geom=geom_point,
                        water_depth_band=WaterDepthBand.BAND_10_TO_20CM,
                        vehicle_passability=VehiclePassability.PASSABLE_CAUTION,
                        transport_type=TransportType.COMMUTER,
                        description=raw.get("comment") or f"Traffy Fondue report #{item.external_id}",
                        photo_url=raw.get("photo_url"),
                        source_id=self.source_id,
                        external_report_id=item.external_id,
                        freshness=ReportFreshness.RECENT,
                        confidence=ConfidenceLevel.MEDIUM,
                        observed_at=item.observed_at,
                        ingested_at=now
                    )
                    session.add(report)
                    persisted_count += 1

                stmt = select(DataSource).where(DataSource.id == self.source_id)
                ds = (await session.execute(stmt)).scalar_one_or_none()
                if ds:
                    ds.status = "AVAILABLE" if self.adapter.api_key else "MOCK_ONLY"
                    ds.mode = "LIVE" if self.adapter.api_key else "DEMO"
                    ds.last_success_at = now
                    ds.last_attempt_at = now
                    ds.latency_ms = latency_ms
                    ds.records_last_success = persisted_count
                    ds.last_error_message = None

                log_entry = DataIngestionLog(
                    id=uuid.uuid4(),
                    source_id=self.source_id,
                    status="SUCCESS",
                    records_ingested=persisted_count,
                    duration_ms=latency_ms,
                    error_message=None
                )
                session.add(log_entry)
                await session.commit()

                logger.info(f"Traffy ingestion complete: {persisted_count} records processed in {latency_ms}ms")
                return persisted_count

            except Exception as e:
                await session.rollback()
                logger.error(f"Traffy ingestion failed: {e}", exc_info=True)
                now = datetime.now(timezone.utc)
                stmt = select(DataSource).where(DataSource.id == self.source_id)
                ds = (await session.execute(stmt)).scalar_one_or_none()
                if ds:
                    ds.status = "DEGRADED"
                    ds.last_error_at = now
                    ds.last_error_message = str(e)
                    await session.commit()
                return 0
