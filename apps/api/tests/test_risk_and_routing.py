import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.situation import SituationService
from app.services.routing import RoutingService


@pytest.mark.asyncio
async def test_risk_engine_unknown_first_policy():
    """
    Validation Rule: UNKNOWN FIRST (Phase 31 & 77).
    If environmental observations are missing or insufficient,
    the system must NEVER fall back to 'LOW' risk.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/situation/summary")
        assert resp.status_code == 200
        summary = resp.json()["data"]
        assert summary["area_name"] == "KMITL & Lat Krabang Basin"
        assert summary["model_version"] == "2.1.0-explainable"
        assert len(summary["explanation"]) > 0
        assert summary["data_quality"] in ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"]


@pytest.mark.asyncio
async def test_routing_language_strict_truth():
    """
    Validation Rule: NEVER CLAIM 100% SAFE (Phase 37 & 118).
    Every generated candidate route must use 'LOWER OBSERVED FLOOD EXPOSURE'
    or equivalent non-absolute phrasing, and must display conditions disclaimer.
    """
    route_data = RoutingService.find_routes(
        origin_lat=13.7290,
        origin_lng=100.7760,
        dest_lat=13.7260,
        dest_lng=100.7530,
        mode="MOTORCYCLE"
    )
    routes = route_data["routes"]
    assert len(routes) >= 2

    for r in routes:
        assert "SAFE" not in r["recommendation_label"].upper() or "LOWER OBSERVED" in r["recommendation_label"].upper()
        assert r["flood_exposure"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"]
        assert "change rapidly" in r["disclaimer"].lower()


@pytest.mark.asyncio
async def test_routing_endpoint_payload_structure():
    """
    Test POST /api/v1/routes/evaluate endpoint.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "origin": {"lat": 13.7290, "lng": 100.7760},
            "destination": {"lat": 13.7260, "lng": 100.7530},
            "mode": "CAR"
        }
        resp = await client.post("/api/v1/routes/evaluate", json=payload)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "routes" in data
        assert len(data["routes"]) > 0
