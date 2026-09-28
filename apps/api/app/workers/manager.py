import asyncio
import logging
from typing import Dict, Any

from app.workers.tmd_worker import TMDWorker
from app.workers.bma_worker import BMAWorker
from app.workers.traffy_worker import TraffyWorker
from app.workers.satellite_worker import SatelliteWorker

logger = logging.getLogger("worker.manager")


class WorkerManager:
    def __init__(self):
        self.tmd = TMDWorker()
        self.bma = BMAWorker()
        self.traffy = TraffyWorker()
        self.satellite = SatelliteWorker()
        self._running = False

    async def run_all_once(self) -> Dict[str, Any]:
        """
        Run all independent workers concurrently with strict fault isolation.
        A failure in one worker will not affect the execution of others.
        """
        logger.info("Executing concurrent ingestion cycles across all independent workers...")
        results = await asyncio.gather(
            self.tmd.run_once(),
            self.bma.run_once(),
            self.traffy.run_once(),
            self.satellite.run_once(),
            return_exceptions=True
        )

        out = {
            "TMD": results[0] if not isinstance(results[0], Exception) else f"Error: {results[0]}",
            "BMA": results[1] if not isinstance(results[1], Exception) else f"Error: {results[1]}",
            "TRAFFY": results[2] if not isinstance(results[2], Exception) else f"Error: {results[2]}",
            "SATELLITE": results[3] if not isinstance(results[3], Exception) else f"Error: {results[3]}"
        }
        logger.info(f"Ingestion cycle completed: {out}")
        return out

    async def start_periodic_workers(self, interval_seconds: int = 900):
        """
        Run background periodic ingestion loops with configurable interval (default 15 minutes).
        """
        self._running = True
        logger.info(f"WorkerManager started periodic scheduling loop (every {interval_seconds}s)")
        while self._running:
            try:
                await self.run_all_once()
            except Exception as e:
                logger.error(f"Unexpected error in worker loop: {e}", exc_info=True)
            await asyncio.sleep(interval_seconds)

    def stop(self):
        self._running = False
        logger.info("WorkerManager periodic schedule stopped.")
