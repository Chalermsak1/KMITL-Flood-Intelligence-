import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.data_health import DataSourceHealthService


@pytest.mark.asyncio
async def test_data_status_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/data-status")
        assert response.status_code == 200
        payload = response.json()
        assert "data" in payload
        assert "sources" in payload["data"]
        
        sources = {s["name"]: s for s in payload["data"]["sources"]}
        assert "TMD" in sources
        assert "BMA" in sources
        assert "TRAFFY" in sources
        assert "SATELLITE" in sources

        # Verify strict data modes
        assert sources["TMD"]["mode"] in ["LIVE", "DEMO", "UNAVAILABLE", "STALE"]
        assert sources["BMA"]["mode"] in ["LIVE", "DEMO", "UNAVAILABLE", "STALE"]
        assert sources["TRAFFY"]["mode"] in ["LIVE", "DEMO", "UNAVAILABLE", "STALE"]
        assert sources["SATELLITE"]["mode"] == "OBSERVATION"
        assert sources["SATELLITE"]["is_satellite_observational"] is True

        # Metadata envelope
        assert "meta" in payload
        assert payload["meta"]["source"] == "KMITL Data Source Health Registry"


def test_data_health_service_summary():
    health = DataSourceHealthService.get_static_sources()
    assert len(health) >= 4
    for h in health:
        assert h["name"] in ["TMD", "BMA", "TRAFFY", "SATELLITE"]
        assert h["status"] is not None
        assert h["mode"] is not None
        assert isinstance(h["error_rate"], float)
