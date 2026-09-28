import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.routing import RoutingService


def test_routing_service_candidate_routes():
    res = RoutingService.find_routes(
        origin_lat=13.7298,
        origin_lng=100.7782,
        dest_lat=13.7180,
        dest_lng=100.7850,
        mode="CAR",
        active_reports=[
            {
                "latitude": 13.7300,
                "longitude": 100.7780,
                "water_depth_band": "20_TO_40CM",
                "data_age_min": 8
            }
        ]
    )

    assert "routes" in res
    assert len(res["routes"]) >= 2
    # Verify strict wording: "LOWER OBSERVED FLOOD EXPOSURE", never "100% Safe Route"
    assert not any("100% Safe" in r["name"] or "Safe Route" in r.get("recommendation_label", "") for r in res["routes"])
    for r in res["routes"]:
        assert "disclaimer" in r
        assert "Conditions can change rapidly" in r["disclaimer"]
        assert r["distance_km"] > 0
        assert r["estimated_travel_minutes"] > 0
        assert r["flood_exposure"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"]


@pytest.mark.asyncio
async def test_route_evaluation_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "origin": {"lat": 13.7298, "lng": 100.7782},
            "destination": {"lat": 13.7180, "lng": 100.7850},
            "mode": "CAR"
        }
        response = await ac.post("/api/v1/routes/evaluate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "routes" in data["data"]
        assert len(data["data"]["routes"]) >= 2
        assert data["meta"]["source"] == "KMITL Routing Decision Support Engine"
