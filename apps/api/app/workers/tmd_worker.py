import logging
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from geoalchemy2.shape import from_shape
from shapely.geometry import Point

from app.adapters.tmd import TMDAdapter
from app.core.database import AsyncSessionLocal
from app.core.redis import publish_event
from app.models.entities import DataSource, RainObservation, DataIngestionLog

logger = logging.getLogger("worker.tmd")


class TMDWorker:
    def __init__(self):
        self.adapter = TMDAdapter()
        self.source_id = "SRC_TMD_WEATHER"

    async def run_once(self) -> int:
        """
        Execute a single ingestion cycle for TMD weather and rainfall.
        """
        start_time = datetime.now(timezone.utc)
        logger.info(f"Starting ingestion cycle for {self.source_id}")

        async with AsyncSessionLocal() as session:
            try:
                # 1. Fetch from adapter
                records = await self.adapter.fetch()
                normalized = [self.adapter.normalize(r) for r in records if self.adapter.validate(r)]
                now = datetime.now(timezone.utc)
                latency_ms = int((now - start_time).total_seconds() * 1000)

                # 2. Persist records to database
                persisted_count = 0
                for item in normalized:
                    raw = item.raw_data
                    geom_point = from_shape(Point(item.longitude, item.latitude), srid=4326)
                    rain_obs = RainObservation(
                        id=uuid.uuid4(),
                        station_id=item.external_id,
                        station_name=raw.get("station_name", "TMD Station"),
                        latitude=item.latitude,
                        longitude=item.longitude,
                        geom=geom_point,
                        rainfall_1h_mm=raw.get("rainfall_1h_mm", 0.0),
                        rainfall_24h_mm=raw.get("rainfall_24h_mm", 0.0),
                        rainfall_intensity_band=raw.get("intensity", "LIGHT"),
                        temperature_c=raw.get("temperature_c"),
                        relative_humidity_pct=raw.get("humidity_pct"),
                        observed_at=item.observed_at,
                        ingested_at=now,
                        source_id=self.source_id
                    )
                    session.add(rain_obs)
                    persisted_count += 1

                # 3. Update DataSource telemetry
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

                # 4. Ingestion audit log
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

                # 5. Broadcast realtime event
                await publish_event("RAIN_UPDATED", {
                    "source": "TMD",
                    "mode": ds.mode if ds else "LIVE",
                    "records_count": persisted_count,
                    "timestamp": now.isoformat()
                })

                logger.info(f"TMD ingestion complete: {persisted_count} records processed in {latency_ms}ms")
                return persisted_count

            except Exception as e:
                await session.rollback()
                logger.error(f"TMD ingestion failed: {e}", exc_info=True)
                now = datetime.now(timezone.utc)
                stmt = select(DataSource).where(DataSource.id == self.source_id)
                ds = (await session.execute(stmt)).scalar_one_or_none()
                if ds:
                    ds.status = "DEGRADED"
                    ds.last_error_at = now
                    ds.last_error_message = str(e)
                    await session.commit()
                return 0
