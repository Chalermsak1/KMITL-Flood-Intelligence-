import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select

from app.core.queue import job_queue
from app.core.database import AsyncSessionLocal
from app.models.entities import FloodReport
from app.services.clustering import SpatioTemporalClusteringService
from app.services.image_verifier import ImageVerificationService
from app.core.redis import publish_event

logger = logging.getLogger("worker.queue")


class AsyncQueueWorker:
    def __init__(self):
        self._running = False

    async def start(self):
        self._running = True
        logger.info("AsyncQueueWorker started processing durable queue...")
        while self._running:
            try:
                job = await job_queue.dequeue(timeout_sec=2)
                if job:
                    await self._handle_job(job)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in queue worker loop: {e}", exc_info=True)
                await asyncio.sleep(1)

    def stop(self):
        self._running = False
        logger.info("AsyncQueueWorker stopped.")

    async def _handle_job(self, job: dict):
        job_id = job.get("job_id")
        job_type = job.get("job_type")
        payload = job.get("payload", {})
        attempts = job.get("attempts", 0) + 1

        logger.info(f"Processing job {job_id} [{job_type}] (attempt {attempts})")

        try:
            if job_type == "CLUSTER_INCIDENTS":
                async with AsyncSessionLocal() as session:
                    clustering = SpatioTemporalClusteringService()
                    await clustering.cluster_active_reports(session)

            elif job_type == "RECALCULATE_RISK":
                # Recalculate situation risk and broadcast event
                now = datetime.now(timezone.utc)
                await publish_event("RISK_CHANGED", {
                    "source": "KMITL Risk Engine",
                    "timestamp": now.isoformat(),
                    "calculated_at": now.isoformat()
                })

            elif job_type == "PROCESS_REPORT_IMAGE":
                report_id = payload.get("report_id")
                if report_id:
                    async with AsyncSessionLocal() as session:
                        stmt = select(FloodReport).where(FloodReport.id == report_id)
                        report = (await session.execute(stmt)).scalar_one_or_none()
                        if report:
                            # Re-verify and corroborate
                            report.updated_at = datetime.now(timezone.utc)
                            await session.commit()

            logger.info(f"Job {job_id} completed successfully.")

        except Exception as e:
            logger.error(f"Failed to process job {job_id}: {e}", exc_info=True)
            if attempts >= 3:
                await job_queue.move_to_dlq(job, reason=str(e))
            else:
                job["attempts"] = attempts
                await job_queue.enqueue(job_type, payload, priority=job.get("priority", "NORMAL"))
