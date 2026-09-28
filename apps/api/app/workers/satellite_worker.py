import logging
import uuid
import json
from datetime import datetime, timezone
from sqlalchemy import select
from geoalchemy2.shape import from_shape
from shapely.geometry import shape

from app.adapters.satellite import SatelliteAdapter
from app.core.database import AsyncSessionLocal
from app.core.redis import publish_event
from app.models.entities import DataSource, SatelliteObservation, DataIngestionLog

logger = logging.getLogger("worker.satellite")


class SatelliteWorker:
    def __init__(self):
        self.adapter = SatelliteAdapter()
        self.source_id = "SRC_COPERNICUS_S1"

    async def run_once(self) -> int:
        """
        Execute a single ingestion cycle for Copernicus Sentinel-1 SAR imagery.
        Mode is strictly OBSERVATION (acquired hours/days ago).
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
                    geom_mp = from_shape(shape(raw["water_polygons"]), srid=4326)
                    geom_fp = from_shape(shape(raw["footprint"]), srid=4326)

                    sat_obs = SatelliteObservation(
                        id=uuid.uuid4(),
                        source_id=self.source_id,
                        satellite_name=raw.get("satellite_name", "SENTINEL-1 C-SAR"),
                        product_id=raw.get("observation_id", str(uuid.uuid4())),
                        collection="SENTINEL-1-GRD",
                        spatial_resolution_meters=raw.get("spatial_resolution", 30.0),
                        confidence=raw.get("confidence", "HIGH"),
                        acquisition_at=item.observed_at,
                        processed_at=now,
                        footprint_geom=geom_fp,
                        water_polygons_geom=geom_mp,
                        asset_metadata={
                            "polarisation": "VV+VH",
                            "orbit_state": "descending",
                            "stac_catalog": "Copernicus Data Space Ecosystem (CDSE)"
                        }
                    )
                    session.add(sat_obs)
                    persisted_count += 1

                stmt = select(DataSource).where(DataSource.id == self.source_id)
                ds = (await session.execute(stmt)).scalar_one_or_none()
                if ds:
                    ds.status = "AVAILABLE"
                    ds.mode = "OBSERVATION"
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

                await publish_event("SATELLITE_UPDATED", {
                    "source": "Copernicus Sentinel-1",
                    "mode": "OBSERVATION",
                    "records_count": persisted_count,
                    "timestamp": now.isoformat()
                })

                logger.info(f"Satellite ingestion complete: {persisted_count} records processed in {latency_ms}ms")
                return persisted_count

            except Exception as e:
                await session.rollback()
                logger.error(f"Satellite ingestion failed: {e}", exc_info=True)
                now = datetime.now(timezone.utc)
                stmt = select(DataSource).where(DataSource.id == self.source_id)
                ds = (await session.execute(stmt)).scalar_one_or_none()
                if ds:
                    ds.status = "DEGRADED"
                    ds.last_error_at = now
                    ds.last_error_message = str(e)
                    await session.commit()
                return 0
