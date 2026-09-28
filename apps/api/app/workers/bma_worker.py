import logging
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from geoalchemy2.shape import from_shape
from shapely.geometry import Point

from app.adapters.bma import BMAAdapter
from app.core.database import AsyncSessionLocal
from app.core.redis import publish_event
from app.models.entities import DataSource, WaterObservation, DataIngestionLog

logger = logging.getLogger("worker.bma")


class BMAWorker:
    def __init__(self):
        self.adapter = BMAAdapter()
        self.source_id = "SRC_BMA_DDS"

    async def run_once(self) -> int:
        """
        Execute a single ingestion cycle for BMA canal water level observations.
        Preserves strict distinction: Canal telemetry is not direct road depth.
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
                    water_obs = WaterObservation(
                        id=uuid.uuid4(),
                        station_id=item.external_id,
                        station_name=raw.get("station_name", "BMA Canal Gauge"),
                        latitude=item.latitude,
                        longitude=item.longitude,
                        geom=geom_point,
                        water_level_m=raw.get("water_level_m", 0.0),
                        bank_level_m=raw.get("bank_level_m", 1.5),
                        warning_threshold_m=raw.get("warning_level_m", 1.0),
                        critical_threshold_m=raw.get("critical_level_m", 1.3),
                        status=raw.get("status", "NORMAL"),
                        observed_at=item.observed_at,
                        ingested_at=now,
                        source_id=self.source_id
                    )
                    session.add(water_obs)
                    persisted_count += 1

                stmt = select(DataSource).where(DataSource.id == self.source_id)
                ds = (await session.execute(stmt)).scalar_one_or_none()
                if ds:
                    ds.status = "AVAILABLE" if self.adapter.api_token else "PENDING_ACCESS"
                    ds.mode = "LIVE" if self.adapter.api_token else "DEMO"
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

                await publish_event("WATER_UPDATED", {
                    "source": "BMA",
                    "mode": ds.mode if ds else "DEMO",
                    "records_count": persisted_count,
                    "timestamp": now.isoformat()
                })

                logger.info(f"BMA ingestion complete: {persisted_count} records processed in {latency_ms}ms")
                return persisted_count

            except Exception as e:
                await session.rollback()
                logger.error(f"BMA ingestion failed: {e}", exc_info=True)
                now = datetime.now(timezone.utc)
                stmt = select(DataSource).where(DataSource.id == self.source_id)
                ds = (await session.execute(stmt)).scalar_one_or_none()
                if ds:
                    ds.status = "DEGRADED"
                    ds.last_error_at = now
                    ds.last_error_message = str(e)
                    await session.commit()
                return 0
