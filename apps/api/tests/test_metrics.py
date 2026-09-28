import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_metrics_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/metrics")
        assert response.status_code == 200
        payload = response.json()
        assert "data" in payload
        assert "database" in payload["data"]
        assert "queue" in payload["data"]
        assert "incidents" in payload["data"]
        assert "reports" in payload["data"]
