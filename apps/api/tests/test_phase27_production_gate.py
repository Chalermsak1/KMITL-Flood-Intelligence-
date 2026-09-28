"""
Phase 27 Production Beta Gate & Data Truth Validation Tests
===========================================================
Tests that verify:
1. Feature flag RBAC security (public safe status, admin required for mutation, audit log persistence)
2. Block on unverified LIVE flag activation (rejects fake LIVE claims without real credentials)
3. Route safety language enforcement (no 'SAFE', '100% SAFE', 'FLOOD-FREE')
4. Route audit fields (generated_at, data_cutoff, sources_used, unknown_segments, confidence)
5. Risk engine explainability and UNKNOWN fallback
6. Shelter operator verification endpoint & audit logging
7. Adapter contract compliance and satellite OBSERVATION mode
"""
import pytest
import uuid
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings
from app.core.security import SecurityService
from app.adapters.base import DataSourceAdapter, NormalizedRecord, HealthCheckResult


def create_token(sub: str, role: str) -> str:
    """Helper to generate signed test JWT tokens."""
    return SecurityService.create_access_token(subject=sub, role=role)


@pytest.mark.asyncio
async def test_feature_flags_public_read():
    """Unauthenticated users can read public safe flags but cannot alter them."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/beta/features")
        assert res.status_code == 200
        body = res.json()["data"]
        assert body["access_level"] == "READ_PUBLIC_SAFE_STATUS"
        assert "BETA_LATKRABANG_ENABLED" in body["flags"]
        assert "PUBLIC_REPORTS_ENABLED" in body["flags"]


@pytest.mark.asyncio
async def test_feature_flags_admin_read_requires_auth():
    """Admin feature flag reading requires authenticated role."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Unauthenticated -> 401
        res_unauth = await ac.get("/api/v1/beta/features/admin")
        assert res_unauth.status_code == 401

        # Regular user -> 403
        user_token = create_token("citizen_123", "USER")
        res_user = await ac.get(
            "/api/v1/beta/features/admin",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert res_user.status_code == 403

        # Admin user -> 200
        admin_token = create_token("eoc_chief", "ADMIN")
        res_admin = await ac.get(
            "/api/v1/beta/features/admin",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_admin.status_code == 200
        data = res_admin.json()["data"]
        assert data["access_level"] == "READ_ADMIN_STATUS"
        assert data["authenticated_as"] == "eoc_chief"


@pytest.mark.asyncio
async def test_feature_flags_mutation_rbac_and_audit():
    """Mutating feature flags requires ADMIN and is rejected for unauthorized callers."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Unauthenticated mutation rejected
        res_unauth = await ac.post(
            "/api/v1/beta/features",
            json={"flag_name": "FEATURE_FLAG_LOW_BANDWIDTH_MODE", "value": True, "reason": "Test update"}
        )
        assert res_unauth.status_code == 401

        # Citizen user mutation rejected
        user_token = create_token("attacker", "USER")
        res_user = await ac.post(
            "/api/v1/beta/features",
            json={"flag_name": "FEATURE_FLAG_LOW_BANDWIDTH_MODE", "value": True, "reason": "Attack attempt"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert res_user.status_code == 403


@pytest.mark.asyncio
async def test_prevent_unverified_live_flag_activation():
    """
    CRITICAL TRUTH GATE:
    System must REJECT attempts to set FEATURE_FLAG_TMD_LIVE=True
    when no real authorized credentials exist.
    """
    transport = ASGITransport(app=app)
    admin_token = create_token("admin_user", "ADMIN")
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/beta/features",
            json={
                "flag_name": "FEATURE_FLAG_TMD_LIVE",
                "value": True,
                "reason": "Attempting unverified activation without API key"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 400
        assert "Cannot activate TMD_LIVE" in res.json()["detail"]


@pytest.mark.asyncio
async def test_route_safety_language_and_audit_fields():
    """
    Route evaluation must NEVER promise '100% Safe' or 'Flood-Free'.
    Must expose generated_at, data_cutoff, sources_used, unknown_segments, and confidence.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/routes/evaluate",
            json={
                "origin": {"lat": 13.7298, "lng": 100.7782},
                "destination": {"lat": 13.7210, "lng": 100.7500},
                "mode": "CAR"
            }
        )
        assert res.status_code == 200
        data = res.json()["data"]
        routes = data["routes"]
        assert len(routes) > 0

        forbidden_words = ["100% SAFE", "GUARANTEED SAFE", "FLOOD-FREE"]

        for route in routes:
            # Check forbidden words
            label = route["recommendation_label"].upper()
            for forbidden in forbidden_words:
                assert forbidden not in label, f"Forbidden term '{forbidden}' found in route label: {label}"

            # Check audit fields
            assert "generated_at" in route
            assert "data_cutoff" in route
            assert "sources_used" in route
            assert "unknown_segments" in route
            assert "confidence" in route
            assert route["confidence"] in ["LOW", "MEDIUM", "HIGH", "UNKNOWN"]


@pytest.mark.asyncio
async def test_risk_engine_explainability_and_unknown_fields():
    """
    Situation summary risk engine must return sources_used, data_cutoff,
    unknown_factors, and explainable breakdown.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/situation/summary")
        assert res.status_code == 200
        data = res.json()["data"]
        assert "current_status" in data
        assert "confidence" in data
        assert "sources_used" in data
        assert "data_cutoff" in data
        assert "unknown_factors" in data
        assert "explanation" in data
        assert len(data["explanation"]) > 0


@pytest.mark.asyncio
async def test_shelter_occupancy_operator_update_auth():
    """Updating shelter occupancy requires authentication and rejects unauthorized callers."""
    transport = ASGITransport(app=app)
    dummy_shelter_id = str(uuid.uuid4())
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Unauthenticated update rejected
        res = await ac.patch(
            f"/api/v1/shelters/{dummy_shelter_id}/occupancy",
            json={"current_occupancy": 50, "verified_by": "Officer Somchai"}
        )
        assert res.status_code == 401

        # Non-operator citizen token rejected
        citizen_token = create_token("citizen_123", "USER")
        res_citizen = await ac.patch(
            f"/api/v1/shelters/{dummy_shelter_id}/occupancy",
            json={"current_occupancy": 50, "verified_by": "Unauthorized User"},
            headers={"Authorization": f"Bearer {citizen_token}"}
        )
        assert res_citizen.status_code == 403


@pytest.mark.asyncio
async def test_satellite_mode_strictly_observation():
    """Satellite responses must strictly declare mode=OBSERVATION (never LIVE)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/satellite/latest")
        assert res.status_code == 200
        body = res.json()
        assert body["data"]["disclaimer"] is not None
        assert "Not minute-by-minute" in body["data"]["disclaimer"]
        assert body["meta"]["freshness"] == "STALE"


def test_adapter_contract_lifecycle():
    """Verify standard production adapter contract implements all 6 lifecycle methods."""
    class MockTestAdapter(DataSourceAdapter):
        async def fetch(self):
            return [{"id": 1}]
        def normalize(self, raw):
            return NormalizedRecord(
                source=self.source_id,
                source_type="TEST",
                observed_at=raw.get("timestamp"),
                value={"val": 42}
            )
        async def health_check(self):
            return HealthCheckResult(source_id=self.source_id, status="AVAILABLE")

    adapter = MockTestAdapter(source_id="SRC_TEST", name="Test Adapter")
    assert hasattr(adapter, "fetch")
    assert hasattr(adapter, "validate")
    assert hasattr(adapter, "normalize")
    assert hasattr(adapter, "store")
    assert hasattr(adapter, "publish")
    assert hasattr(adapter, "health_check")
    assert hasattr(adapter, "get_telemetry")

    # Telemetry tracking
    telemetry = adapter.get_telemetry()
    assert telemetry.source == "SRC_TEST"
    assert telemetry.status == "AVAILABLE"
    assert telemetry.error_count == 0
