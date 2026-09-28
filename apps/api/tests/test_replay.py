import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_replay_events_list_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/replay/events")
        assert response.status_code == 200
        payload = response.json()
        assert "events" in payload["data"]
        events = payload["data"]["events"]
        assert len(events) >= 1
        assert events[0]["mode"] in ["DEMO", "OBSERVATION"]
        assert payload["meta"]["mode"] == "DEMO"


@pytest.mark.asyncio
async def test_replay_timeline_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        event_id = "e7b0c3a1-5f28-4e89-9a14-b8163f458129"
        response = await ac.get(f"/api/v1/replay/events/{event_id}/timeline")
        assert response.status_code == 200
        payload = response.json()
        data = payload["data"]
        assert "timeline" in data
        assert len(data["timeline"]) >= 3
        # Timeline has sequential timestamps
        assert "14:00" in data["timeline"][0]["time_label"]
        assert "16:00" in data["timeline"][2]["time_label"]
        assert data["timeline"][2]["risk_level"] == "HIGH"
        assert data["mode"] == "DEMO"
