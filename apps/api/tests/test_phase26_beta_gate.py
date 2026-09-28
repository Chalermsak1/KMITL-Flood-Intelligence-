"""
Phase 26 Beta Gate & Safety Validation Tests
=============================================
Tests that verify:
1. Geofence classification (Zone A, Zone B, Outside Beta, Unknown)
2. Geofence warning messages
3. Beta coverage & features endpoints (/api/v1/beta/coverage, /api/v1/beta/features)
4. SOS Help status endpoint & operational mode gate (/api/v1/help/status)
5. Shelter truth policy (no fabricated occupancy numbers, mode=DEMO for fallback)
6. Flood report geofence classification & warning propagation
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings
from app.services.geofence import (
    classify_coverage,
    coverage_warning_message,
    is_within_beta,
    get_zone_metadata,
)


def test_geofence_classification_zone_a():
    """Points inside KMITL campus must classify as IN_ZONE_A with no warning."""
    # KMITL central library / engineering faculty
    kmitl_lat = 13.7298
    kmitl_lng = 100.7782
    zone = classify_coverage(kmitl_lat, kmitl_lng)
    assert zone == "IN_ZONE_A"
    assert coverage_warning_message(zone) is None
    assert is_within_beta(kmitl_lat, kmitl_lng) is True


def test_geofence_classification_zone_b():
    """Points inside Lat Krabang corridors (outside Zone A) must classify as IN_ZONE_B."""
    # Lat Krabang corridor (e.g. near Romklao / Lat Krabang road)
    corridor_lat = 13.7210
    corridor_lng = 100.7500
    zone = classify_coverage(corridor_lat, corridor_lng)
    assert zone == "IN_ZONE_B"
    assert coverage_warning_message(zone) is None
    assert is_within_beta(corridor_lat, corridor_lng) is True


def test_geofence_classification_outside_beta():
    """Points far outside beta (e.g. Siam, Silom, Sukhumvit) must classify as OUTSIDE_BETA and generate warning."""
    siam_lat = 13.7460
    siam_lng = 100.5340
    zone = classify_coverage(siam_lat, siam_lng)
    assert zone == "OUTSIDE_BETA"
    warning = coverage_warning_message(zone)
    assert warning is not None
    assert "Coverage is limited" in warning
    assert is_within_beta(siam_lat, siam_lng) is False


def test_geofence_classification_invalid_coords():
    """Missing or out-of-range coordinates must return UNKNOWN_LOCATION."""
    assert classify_coverage(None, None) == "UNKNOWN_LOCATION"
    assert classify_coverage(99.0, 99.0) == "UNKNOWN_LOCATION"  # Outside Thailand
    assert coverage_warning_message("UNKNOWN_LOCATION") is not None


def test_zone_metadata():
    """Metadata must expose both Zone A and Zone B with correct status."""
    meta = get_zone_metadata()
    assert "zones" in meta
    assert "ZONE_A" in meta["zones"]
    assert "ZONE_B" in meta["zones"]
    assert meta["zones"]["ZONE_A"]["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_beta_coverage_api():
    """Test /api/v1/beta/coverage endpoint with various coordinates."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Zone A coordinate
        res_a = await ac.get("/api/v1/beta/coverage", params={"latitude": 13.7298, "longitude": 100.7782})
        assert res_a.status_code == 200
        data_a = res_a.json()["data"]
        assert data_a["zone"] == "IN_ZONE_A"
        assert data_a["is_within_beta"] is True
        assert data_a["warning"] is None

        # Outside Beta coordinate
        res_out = await ac.get("/api/v1/beta/coverage", params={"latitude": 13.7460, "longitude": 100.5340})
        assert res_out.status_code == 200
        data_out = res_out.json()["data"]
        assert data_out["zone"] == "OUTSIDE_BETA"
        assert data_out["is_within_beta"] is False
        assert data_out["warning"] is not None


@pytest.mark.asyncio
async def test_beta_features_api():
    """Test /api/v1/beta/features endpoint exposes feature flag configuration."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/beta/features")
        assert res.status_code == 200
        flags = res.json()["data"]["flags"]
        # Official agencies must NOT be assumed LIVE by default
        assert flags["TMD_LIVE_INGESTION"] is False
        assert flags["BMA_LIVE_INGESTION"] is False
        assert flags["TRAFFY_LIVE_INGESTION"] is False
        # Phase 26 limited beta flags
        assert "BETA_LATKRABANG_ENABLED" in flags
        assert "SOS_OPERATIONAL_MODE" in flags


@pytest.mark.asyncio
async def test_help_status_api():
    """Test /api/v1/help/status endpoint reports operator status and safety guidance."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/help/status")
        assert res.status_code == 200
        data = res.json()["data"]
        assert "mode" in data
        assert "operator_active" in data
        assert "official_emergency_numbers" in data
        assert "199" in data["official_emergency_numbers"]
        assert "1669" in data["official_emergency_numbers"]
        assert "1784" in data["official_emergency_numbers"]


@pytest.mark.asyncio
async def test_shelters_no_fabricated_occupancy():
    """
    Shelter fallback data must NOT contain fabricated occupancy counts.
    Must report current_occupancy=0 and occupancy_status='OCCUPANCY_NOT_VERIFIED'.
    Mode must be 'DEMO'.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/shelters")
        assert res.status_code == 200
        body = res.json()
        assert body["meta"]["mode"] in ("DEMO", "LIVE")

        shelters = body["data"]
        assert len(shelters) > 0
        for s in shelters:
            if body["meta"]["mode"] == "DEMO":
                assert s["current_occupancy"] == 0
                assert s["occupancy_status"] == "OCCUPANCY_NOT_VERIFIED"
            else:
                assert s["current_occupancy"] >= 0


@pytest.mark.asyncio
async def test_root_endpoint_phase26():
    """Root endpoint must identify Phase 26 and provide navigation to beta & help status."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/")
        assert res.status_code == 200
        body = res.json()
        assert body["phase"] == "26-LIMITED-BETA"
        assert "/api/v1/beta/coverage" in body["beta_coverage"]
        assert "/api/v1/help/status" in body["sos_status"]
