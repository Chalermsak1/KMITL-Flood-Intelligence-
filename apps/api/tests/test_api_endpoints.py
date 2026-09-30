import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "KMITL Flood Intelligence" in data["app_name"]


@pytest.mark.asyncio
async def test_rain_current_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/rain/current")
        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "meta" in body
        assert "rain_rate_mm_hr" in body["data"]
        assert body["meta"]["source"] in ["SRC_TMD_WEATHER", "SRC_OPEN_METEO_WMO"]


@pytest.mark.asyncio
async def test_water_stations_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/water-stations")
        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert len(body["data"]) >= 3
        # Check Lat Krabang / Bangkok canal stations
        names = [s["name"] for s in body["data"]]
        assert any(any(k in n for k in ["ประเวศบุรีรมย์", "ลำปลาทิว", "จระเข้ใหญ่", "คลอง"]) for n in names)


@pytest.mark.asyncio
async def test_satellite_latest_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/satellite/latest")
        assert res.status_code == 200
        body = res.json()
        assert body["data"]["satellite_name"] == "SENTINEL-1 C-SAR"
        # Provenance disclaimer verified
        assert "Not minute-by-minute" in body["data"]["disclaimer"]
        assert body["meta"]["freshness"] == "STALE"


@pytest.mark.asyncio
async def test_shelters_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/shelters")
        assert res.status_code == 200
        body = res.json()
        assert len(body["data"]) >= 2
        # Check Auditorium
        shelter_names = [s["name"] for s in body["data"]]
        assert any("เจ้าพระยาสุรวงษ์ไวยวัฒน์" in s for s in shelter_names)
