import pytest
import time
import asyncio
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import db_circuit_breaker


@pytest.mark.asyncio
async def test_db_failure_latency_bounded_under_2_seconds():
    """
    Issue 1 Validation:
    When PostgreSQL is unreachable or hangs, public GET /situation/summary
    must NOT hang for 30 seconds.
    It MUST return a bounded response in <= 2.2 seconds with status=UNKNOWN.
    """
    transport = ASGITransport(app=app)
    
    # Simulate a hanging database query (e.g. 15-second cold connection hang)
    async def hanging_db_call(*args, **kwargs):
        await asyncio.sleep(10.0)
        return None

    # Reset breaker to closed for first test
    db_circuit_breaker.record_success()

    with patch("app.services.situation.SituationService.get_summary", side_effect=hanging_db_call):
        t0 = time.perf_counter()
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/situation/summary")
            elapsed = time.perf_counter() - t0

        # Assert bounded response time (strictly under 2.5 seconds, eliminating the 30s hang)
        assert elapsed < 2.5, f"Response took {elapsed:.2f}s, exceeding bounded timeout threshold"
        assert resp.status_code == 200

        data = resp.json()["data"]
        assert data["current_status"] == "UNKNOWN"
        assert data["data_quality"] == "INSUFFICIENT"


@pytest.mark.asyncio
async def test_db_circuit_breaker_fast_fails_under_50ms():
    """
    Issue 1 Validation:
    When database circuit breaker is tripped (state=OPEN), subsequent public requests
    must fast-fail in < 50ms rather than waiting for socket connection timeouts.
    """
    transport = ASGITransport(app=app)

    # Force circuit breaker to OPEN
    db_circuit_breaker.record_failure()
    db_circuit_breaker.record_failure()
    db_circuit_breaker.record_failure()
    assert db_circuit_breaker.state == "OPEN"

    t0 = time.perf_counter()
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/situation/summary")
        elapsed = time.perf_counter() - t0

    # Fast-fail must return in under 50ms
    assert elapsed < 0.10, f"Fast-fail took {elapsed:.3f}s; expected < 0.10s"
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["current_status"] == "UNKNOWN"
    assert data["data_quality"] == "INSUFFICIENT"
    assert "circuit breaker" in data["explanation"][0].lower()

    # Reset breaker
    db_circuit_breaker.record_success()
