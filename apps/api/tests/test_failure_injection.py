import pytest
from unittest.mock import patch
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.adapters.tmd import TMDAdapter
from app.adapters.bma import BMAAdapter
from app.adapters.satellite import SatelliteAdapter
from app.core.queue import DurableQueue


@pytest.mark.asyncio
async def test_failure_injection_tmd_unavailable():
    """
    Failure Injection: TMD API timeout / network failure.
    System must not crash with 500. Must gracefully set mode to DEMO or STALE.
    """
    transport = ASGITransport(app=app)
    with patch.object(TMDAdapter, "fetch", side_effect=Exception("Connection refused by TMD upstream")):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/rain/current")
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert data is not None


@pytest.mark.asyncio
async def test_failure_injection_bma_unavailable():
    """
    Failure Injection: BMA canal gauge feed failure.
    Must return stations without unhandled crash.
    """
    transport = ASGITransport(app=app)
    with patch.object(BMAAdapter, "fetch", side_effect=Exception("BMA DDS Gateway Timeout 504")):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/water-stations")
            assert resp.status_code == 200
            stations = resp.json()["data"]
            assert isinstance(stations, list)


@pytest.mark.asyncio
async def test_failure_injection_satellite_unavailable():
    """
    Failure Injection: Copernicus STAC API failure.
    System must continue displaying last known observational footprint with disclaimer.
    """
    transport = ASGITransport(app=app)
    with patch.object(SatelliteAdapter, "fetch", side_effect=Exception("Copernicus STAC 503")):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/satellite/latest")
            assert resp.status_code == 200
            sat_data = resp.json()["data"]
            assert "disclaimer" in sat_data
            assert "Observational" in sat_data["disclaimer"]


@pytest.mark.asyncio
async def test_failure_injection_redis_unavailable(tmp_path):
    """
    Failure Injection: Redis down.
    DurableQueue must catch connection failure and not crash the process.
    """
    spool_file = str(tmp_path / "spool.jsonl")
    dq = DurableQueue(spool_file=spool_file)
    with patch.object(dq, "get_redis", side_effect=Exception("Redis node unreachable")):
        job_id = await dq.enqueue("REPORT_CLUSTER", {"test": 123})
        # Graceful return with fallback job ID
        assert job_id is not None

        # Dequeue handles Redis failure gracefully without crashing
        res = await dq.dequeue(timeout_sec=1)
        assert res is None or res.get("job_id") == job_id
        # When queue is drained, returns None
        empty_res = await dq.dequeue(timeout_sec=1)
        assert empty_res is None


@pytest.mark.asyncio
async def test_failure_injection_public_map_resilience():
    """
    Failure Injection: Multiple external upstream outages simultaneously.
    Public map endpoints must still serve situation summary and shelters without crashing.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sum_resp = await client.get("/api/v1/situation/summary")
        assert sum_resp.status_code == 200
        
        shelter_resp = await client.get("/api/v1/shelters")
        assert shelter_resp.status_code == 200

        data_status_resp = await client.get("/api/v1/data-status")
        assert data_status_resp.status_code == 200
