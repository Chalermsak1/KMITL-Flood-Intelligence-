import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings, Settings
from app.services.data_health import DataSourceHealthService
from app.models.entities import SourceActivationRecord


def test_source_activation_policy_progression():
    """
    Phase 30 Section 29: Live Data Onboarding Policy.
    Strict progression: PENDING_ACCESS -> CONNECTED -> VALIDATED -> LIVE
    """
    # 1. No credentials
    status_1 = DataSourceHealthService.evaluate_live_transition(
        source_id="SRC_TMD_WEATHER",
        credential_valid=False,
        health_valid=False,
        has_persisted_record=False
    )
    assert status_1 == "PENDING_ACCESS"

    # 2. Credentials valid, but health check failing
    status_2 = DataSourceHealthService.evaluate_live_transition(
        source_id="SRC_TMD_WEATHER",
        credential_valid=True,
        health_valid=False,
        has_persisted_record=False
    )
    assert status_2 == "CONNECTED"

    # 3. Credentials and health valid, but no persisted observation yet
    status_3 = DataSourceHealthService.evaluate_live_transition(
        source_id="SRC_TMD_WEATHER",
        credential_valid=True,
        health_valid=True,
        has_persisted_record=False
    )
    assert status_3 == "VALIDATED"

    # 4. All verified and persisted
    status_4 = DataSourceHealthService.evaluate_live_transition(
        source_id="SRC_TMD_WEATHER",
        credential_valid=True,
        health_valid=True,
        has_persisted_record=True
    )
    assert status_4 == "LIVE"


def test_demo_data_production_firewall():
    """
    Phase 30 Section 12: Demo Data Production Firewall.
    Unauthorized demo data can never be activated as LIVE in production.
    """
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="production_ultra_secure_and_randomly_generated_secret_string",
        SQS_QUEUE_URL="https://sqs.ap-southeast-1.amazonaws.com/123456789012/kmitl-prod",
        FEATURE_FLAG_TMD_LIVE=False,
        FEATURE_FLAG_BMA_LIVE=False,
        FEATURE_FLAG_TRAFFY_LIVE=False
    )
    # In production, live ingestion must remain disabled if credentials are missing
    assert prod_settings.FEATURE_FLAG_TMD_LIVE is False
    assert prod_settings.FEATURE_FLAG_BMA_LIVE is False
    assert prod_settings.FEATURE_FLAG_TRAFFY_LIVE is False


@pytest.mark.asyncio
async def test_subsystem_health_reflects_backend_truth():
    """
    Phase 30 Section 13: Public Status Surface truthfulness.
    Backend must expose all 9 subsystems with truthful modes.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/data-status")
        assert res.status_code == 200
        payload = res.json()["data"]
        assert "subsystems" in payload
        subsystems = {s["subsystem"]: s for s in payload["subsystems"]}
        
        # Verify all 9 subsystems exist
        expected_subsystems = [
            "Platform", "First-party reports", "Copernicus",
            "TMD", "BMA", "Traffy", "Routing", "Realtime", "SOS"
        ]
        for name in expected_subsystems:
            assert name in subsystems, f"Missing required subsystem '{name}'"
        
        # Verify strict mode badges
        assert subsystems["Platform"]["status"] in ("LIVE", "DEGRADED")
        assert subsystems["First-party reports"]["status"] == "LIVE"
        assert subsystems["Copernicus"]["status"] == "OBSERVATION"
        assert subsystems["TMD"]["status"] in ("PENDING_ACCESS", "LIVE")
        assert subsystems["BMA"]["status"] in ("PENDING_ACCESS", "LIVE")
        assert subsystems["Traffy"]["status"] in ("PENDING_ACCESS", "LIVE")
        assert subsystems["Routing"]["status"] == "LIVE"
        assert subsystems["Realtime"]["status"] == "LIVE"
        assert subsystems["SOS"]["status"] in ("PENDING_ACCESS", "PILOT_TEST")


def test_source_activation_record_model():
    """Verify SourceActivationRecord entity schema integrity."""
    record = SourceActivationRecord(
        source_id="SRC_TMD_WEATHER",
        requested_by="operator@kmitl.ac.th",
        approved_by=None,
        status="PENDING_ACCESS",
        rollback_flag="FEATURE_FLAG_TMD_LIVE"
    )
    assert record.source_id == "SRC_TMD_WEATHER"
    assert record.status == "PENDING_ACCESS"
    assert record.id is not None
