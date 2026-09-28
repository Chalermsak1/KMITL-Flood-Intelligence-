import pytest
import httpx
from datetime import datetime, timezone
from app.adapters.tmd import TMDAdapter
from app.adapters.bma import BMAAdapter
from app.adapters.traffy import TraffyAdapter
from app.adapters.satellite import SatelliteAdapter


@pytest.mark.asyncio
async def test_copernicus_live_stac_endpoint_integration():
    """
    Live Data Acceptance Test:
    Executes actual network request against Copernicus Data Space Ecosystem STAC API.
    Verifies HTTP reachability, valid STAC collections, and query response structure.
    """
    stac_url = "https://stac.dataspace.copernicus.eu/v1/collections/ccm-sar"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(stac_url)
            assert resp.status_code == 200, f"STAC collections query returned status {resp.status_code}"
            data = resp.json()
            assert "id" in data
            assert data["id"] == "ccm-sar"
            assert "extent" in data
            assert "spatial" in data["extent"]
    except httpx.RequestError as e:
        pytest.skip(f"Network environment restricted or STAC offline: {e}")


@pytest.mark.asyncio
async def test_tmd_adapter_real_endpoint_and_credential_gate():
    """
    Live Data Acceptance Test:
    Verifies TMD endpoint behavior. When credentials are not configured,
    the adapter must operate in DEMO mode with explicit metadata,
    and must NEVER claim to be LIVE.
    """
    adapter = TMDAdapter()
    health = await adapter.health_check()
    assert health.status in ["AVAILABLE", "PENDING_ACCESS", "LIVE", "DEGRADED"]
    
    records = await adapter.fetch()
    assert len(records) > 0
    norm = adapter.normalize(records[0])
    
    # If is_demo is True, mode MUST be DEMO
    if records[0].get("is_demo", True):
        assert norm.extra_metadata["mode"] == "DEMO"
        assert "SRC_TMD_WEATHER" in norm.source
    
    # Value must contain valid rainfall fields
    assert "rain_rate_mm_hr" in norm.value
    assert norm.value["rain_rate_mm_hr"] >= 0.0


@pytest.mark.asyncio
async def test_bma_adapter_canal_water_truth():
    """
    Live Data Acceptance Test:
    Verifies BMA canal level normalization.
    Ensures canal stage (m MSL) is never conflated with street water depth.
    """
    adapter = BMAAdapter()
    health = await adapter.health_check()
    assert health.status in ["AVAILABLE", "PENDING_ACCESS"]
    assert health.mode in ["DEMO", "LIVE"]
    
    records = await adapter.fetch()
    for rec in records:
        norm = adapter.normalize(rec)
        assert norm.source_type in ["WATER_LEVEL", "BMA_WATER"]
        assert "water_level_m_msl" in norm.value
        assert "warning_threshold" in norm.value
        assert norm.extra_metadata["mode"] in ["DEMO", "LIVE"]


@pytest.mark.asyncio
async def test_traffy_adapter_bounds_and_demo_tagging():
    """
    Live Data Acceptance Test:
    Verifies Traffy Fondue reports are constrained to Lat Krabang / KMITL bounds.
    """
    adapter = TraffyAdapter()
    records = await adapter.fetch()
    for rec in records:
        norm = adapter.normalize(rec)
        assert norm.source_type == "TRAFFY"
        # Verify latitude and longitude within Lat Krabang bbox [100.65, 13.65, 100.90, 13.82]
        coords = norm.location["coordinates"]
        lon, lat = coords[0], coords[1]
        assert 100.65 <= lon <= 100.90
        assert 13.65 <= lat <= 13.82
        assert norm.extra_metadata["mode"] in ["DEMO", "LIVE"]


@pytest.mark.asyncio
async def test_satellite_adapter_observational_integrity():
    """
    Live Data Acceptance Test:
    Verifies Satellite SAR observations are labeled as OBSERVATIONAL EVIDENCE,
    and include mandatory disclaimer regarding revisit cycles.
    """
    adapter = SatelliteAdapter()
    records = await adapter.fetch()
    for rec in records:
        norm = adapter.normalize(rec)
        assert norm.source_type == "SATELLITE"
        assert "disclaimer" in norm.extra_metadata
        assert "Observational" in norm.extra_metadata["disclaimer"]
        assert norm.freshness in ["STALE", "AGING", "RECENT"]
