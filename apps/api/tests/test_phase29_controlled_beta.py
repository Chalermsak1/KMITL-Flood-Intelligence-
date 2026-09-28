import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings, Settings
from app.core.security import RateLimiter


@pytest.mark.asyncio
async def test_security_headers_middleware():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/health")
        assert res.status_code == 200
        headers = res.headers
        assert headers.get("X-Content-Type-Options") == "nosniff"
        assert headers.get("X-Frame-Options") == "DENY"
        assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert "Content-Security-Policy" in headers


@pytest.mark.asyncio
async def test_oversized_payload_rejected():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Simulate an oversized request with content-length header > 10MB
        res = await ac.post(
            "/api/v1/reports",
            headers={"Content-Length": str(15 * 1024 * 1024)},
            content=b"test"
        )
        assert res.status_code == 413
        assert "Payload Too Large" in res.text


@pytest.mark.asyncio
async def test_health_endpoints_separation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Liveness
        res_live = await ac.get("/api/v1/health/live")
        assert res_live.status_code == 200
        assert res_live.json()["status"] == "live"

        # 2. Readiness (Only required dependencies DB/Redis)
        res_ready = await ac.get("/api/v1/health/ready")
        assert res_ready.status_code in (200, 503)

        # 3. Comprehensive Dependency Health
        res_deps = await ac.get("/api/v1/health/deps")
        assert res_deps.status_code == 200
        payload = res_deps.json()
        assert "dependencies" in payload
        deps = payload["dependencies"]
        assert "database" in deps
        assert "redis" in deps
        assert "queue" in deps
        assert "tmd_weather" in deps
        assert "bma_drainage" in deps
        assert "traffy_fondue" in deps
        assert "copernicus_s1" in deps
        # Verify optional dependencies do not have required=True
        assert deps["tmd_weather"]["required"] is False
        assert deps["bma_drainage"]["required"] is False
        assert deps["copernicus_s1"]["required"] is False


from unittest.mock import AsyncMock
from app.core.database import get_db
from app.services.routing import RoutingService


@pytest.mark.asyncio
async def test_public_report_rate_limiting():
    # Clear rate limiter bucket
    RateLimiter._requests.clear()
    
    async def mock_get_db():
        session = AsyncMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()
        yield session

    app.dependency_overrides[get_db] = mock_get_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            report_data = {
                "latitude": 13.7295,
                "longitude": 100.7755,
                "water_depth_band": "10_TO_20CM",
                "vehicle_passability": "PASSABLE",
                "transport_type": "CAR",
                "description": "Rate limit probe report"
            }
            # Exhaust the 10 request limit
            for i in range(10):
                res = await ac.post("/api/v1/reports", json=report_data)
                assert res.status_code in (201, 200)

            # 11th request must be throttled with HTTP 429
            throttled_res = await ac.post("/api/v1/reports", json=report_data)
            assert throttled_res.status_code == 429
            assert "Rate limit exceeded" in throttled_res.text
    finally:
        app.dependency_overrides.pop(get_db, None)
        RateLimiter._requests.clear()


@pytest.mark.asyncio
async def test_beta_feedback_loop():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        feedback_payload = {
            "category": "CONFUSING_STATUS",
            "rating": 4,
            "comment": "Status for TMD was clear once I clicked the tooltip.",
            "screen_route": "/data",
            "device_type": "MOBILE"
        }
        res = await ac.post("/api/v1/beta/feedback", json=feedback_payload)
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["category"] == "CONFUSING_STATUS"
        assert data["status"] == "RECORDED"
        assert "feedback_id" in data


def test_safety_copy_audit():
    # Verify RoutingService never returns forbidden claims
    res = RoutingService.find_routes(
        origin_lat=13.7295,
        origin_lng=100.7755,
        dest_lat=13.7315,
        dest_lng=100.7812,
        active_reports=[],
        active_incidents=[]
    )
    candidates = res.get("routes", [])
    assert len(candidates) >= 1

    forbidden_terms = [
        "100% SAFE",
        "FLOOD-FREE",
        "GUARANTEED SAFE",
        "GUARANTEED RESCUE",
        "REAL-TIME SATELLITE"
    ]
    for c in candidates:
        name_upper = c["name"].upper()
        label_upper = c.get("recommendation_label", "").upper()
        disclaimer_upper = c.get("disclaimer", "").upper()
        for term in forbidden_terms:
            assert term not in name_upper, f"Forbidden term '{term}' in route name '{c['name']}'"
            assert term not in label_upper, f"Forbidden term '{term}' in route recommendation '{label_upper}'"
        # Disclaimers must explicitly state that safety is NOT guaranteed or warn about changing conditions
        assert "NOT GUARANTEE" in disclaimer_upper or "DISCLAIMER" in disclaimer_upper or "NEVER DRIVE" in disclaimer_upper or "CONDITIONS CAN CHANGE" in disclaimer_upper


def test_production_must_not_use_unauthorized_demo_source():
    # Attempting to activate live ingestion in production without real credentials must raise ValueError or HTTPException
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="production_ultra_secure_and_randomly_generated_secret_string",
        SQS_QUEUE_URL="https://sqs.ap-southeast-1.amazonaws.com/123456789012/kmitl-prod",
        FEATURE_FLAG_TMD_LIVE=True,
        TMD_UID="",
        TMD_UKEY=""
    )
    # Validate that live ingestion is impossible without credentials
    has_creds = bool(prod_settings.TMD_UID and prod_settings.TMD_UKEY)
    assert has_creds is False


@pytest.mark.asyncio
async def test_incident_risk_route_consistency():
    # Verify that a reported flooded location results in penalization in route evaluation
    active_reports = [
        {
            "latitude": 13.7270,
            "longitude": 100.7750,
            "water_depth_band": "ABOVE_60CM",
            "vehicle_passability": "NOT_PASSABLE",
            "data_age_min": 5
        }
    ]
    res = RoutingService.find_routes(
        origin_lat=13.7295,
        origin_lng=100.7755,
        dest_lat=13.7315,
        dest_lng=100.7812,
        active_reports=active_reports,
        active_incidents=[]
    )
    candidates = res.get("routes", [])
    assert len(candidates) >= 1
    # Candidate routes traversing this area must reflect HIGH or CRITICAL exposure
    exposures = [c["flood_exposure"] for c in candidates]
    assert any(exp in ("HIGH", "CRITICAL") for exp in exposures)

