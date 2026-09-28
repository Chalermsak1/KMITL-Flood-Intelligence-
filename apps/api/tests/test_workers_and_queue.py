import pytest
from app.core.queue import DurableQueue
from app.workers.manager import WorkerManager
from app.workers.tmd_worker import TMDWorker
from app.workers.bma_worker import BMAWorker
from app.workers.satellite_worker import SatelliteWorker


def test_worker_initialization():
    mgr = WorkerManager()
    assert mgr.tmd is not None
    assert mgr.bma is not None
    assert mgr.traffy is not None
    assert mgr.satellite is not None
    assert mgr.tmd.source_id == "SRC_TMD_WEATHER"
    assert mgr.bma.source_id == "SRC_BMA_DDS"
    assert mgr.satellite.source_id == "SRC_COPERNICUS_S1"


def test_durable_queue_singleton():
    q = DurableQueue()
    assert q is not None
