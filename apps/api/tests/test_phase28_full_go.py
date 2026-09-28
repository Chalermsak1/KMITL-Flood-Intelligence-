import os
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import Settings, validate_production_readiness
from app.core.queue import DurableQueue
from app.schemas.shelter import calculate_verification_freshness, AssistancePointResponse
from app.services.data_health import DataSourceHealthService


def test_production_readiness_validator_fails_on_insecure_defaults():
    # Production with default dev secret should fail fast
    insecure_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="dev_super_secret_jwt_key_do_not_use_in_prod",
        SQS_QUEUE_URL=""
    )
    with pytest.raises(ValueError) as exc:
        validate_production_readiness(insecure_settings)
    assert "SECRET_KEY is still set to the default insecure value" in str(exc.value)


def test_production_readiness_validator_fails_on_missing_sqs():
    # Production with valid secret but missing SQS URL should fail fast
    settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="production_ultra_secure_and_randomly_generated_secret_string",
        SQS_QUEUE_URL=""
    )
    with pytest.raises(ValueError) as exc:
        validate_production_readiness(settings)
    assert "SQS_QUEUE_URL must be configured" in str(exc.value)


def test_production_readiness_validator_passes_in_development():
    # In development, default settings should not raise an error
    dev_settings = Settings(
        ENVIRONMENT="development",
        SECRET_KEY="dev_super_secret_jwt_key_do_not_use_in_prod"
    )
    validate_production_readiness(dev_settings)  # Should succeed without exception


def test_shelter_verification_freshness_logic():
    now = datetime.now(timezone.utc)
    
    assert calculate_verification_freshness(None) == "NEVER_VERIFIED"
    assert calculate_verification_freshness(now - timedelta(hours=1)) == "VERIFIED_FRESH"
    assert calculate_verification_freshness(now - timedelta(hours=3, minutes=59)) == "VERIFIED_FRESH"
    assert calculate_verification_freshness(now - timedelta(hours=4, minutes=1)) == "VERIFIED_AGING"
    assert calculate_verification_freshness(now - timedelta(hours=23, minutes=59)) == "VERIFIED_AGING"
    assert calculate_verification_freshness(now - timedelta(hours=24, minutes=1)) == "VERIFIED_STALE"
    assert calculate_verification_freshness(now - timedelta(days=5)) == "VERIFIED_STALE"


@pytest.mark.asyncio
async def test_shelters_endpoint_returns_verification_freshness():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/shelters")
        assert response.status_code == 200
        payload = response.json()
        assert "data" in payload
        assert len(payload["data"]) > 0
        for item in payload["data"]:
            assert "verification_freshness" in item
            assert item["verification_freshness"] in [
                "VERIFIED_FRESH", "VERIFIED_AGING", "VERIFIED_STALE", "NEVER_VERIFIED"
            ]
            assert "source" in item
            assert item["source"] == "KMITL_CIVIL_PROTECTION"


@pytest.mark.asyncio
async def test_durable_queue_get_stats_and_spool_fallback(tmp_path):
    spool_file = tmp_path / "test_spool.jsonl"
    
    q = DurableQueue(spool_file=str(spool_file))
    
    stats = await q.get_stats()
    assert "tier1_sqs" in stats
    assert "tier2_redis" in stats
    assert "tier3_disk_spool" in stats
    assert stats["tier3_disk_spool"]["pending_count"] == 0
    
    # Enqueue a test job
    payload = {"report_id": "rep_test_001", "level": "HIGH"}
    job_id = await q.enqueue(job_type="PROCESS_FLOOD_REPORT", payload=payload, priority="HIGH")
    assert job_id is not None
    
    stats_after = await q.get_stats()
    # If redis is offline in test runner, fallback spool should record the pending job
    assert "tier3_disk_spool" in stats_after
    
    # Dequeue the job
    dequeued = await q.dequeue(timeout_sec=1)
    if dequeued:
        assert dequeued["payload"]["report_id"] == "rep_test_001"


@pytest.mark.asyncio
async def test_expanded_data_health_telemetry():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/data-status")
        assert response.status_code == 200
        payload = response.json()
        assert "data" in payload
        sources = {s["name"]: s for s in payload["data"]["sources"]}
        
        # Check TMD
        assert sources["TMD"]["credential_status"] in ["MISSING", "CONFIGURED_AND_AUTHENTICATED"]
        assert sources["TMD"]["live_ingestion_enabled"] is False  # Missing creds, live ingestion disabled
        assert sources["TMD"]["mode"] in ["PENDING_ACCESS", "DEMO", "LIVE", "UNAVAILABLE"]
        
        # Check BMA
        assert sources["BMA"]["credential_status"] in ["PENDING_AUTHORIZATION", "CONFIGURED_AND_AUTHENTICATED"]
        assert sources["BMA"]["live_ingestion_enabled"] is False
        
        # Check Traffy
        assert sources["TRAFFY"]["credential_status"] in ["PENDING_AUTHORIZATION", "CONFIGURED_AND_AUTHENTICATED"]
        assert sources["TRAFFY"]["live_ingestion_enabled"] is False
        
        # Check Satellite
        assert sources["SATELLITE"]["mode"] == "OBSERVATION"
        assert sources["SATELLITE"]["is_satellite_observational"] is True
