import pytest
from app.adapters.tmd import TMDAdapter
from app.adapters.bma import BMAAdapter
from app.adapters.traffy import TraffyAdapter
from app.adapters.satellite import SatelliteAdapter


@pytest.mark.asyncio
async def test_tmd_adapter_normalization_and_validation():
    adapter = TMDAdapter()
    raw_list = await adapter.fetch()
    assert len(raw_list) > 0

    record = adapter.normalize(raw_list[0])
    assert record.source.startswith("SRC_TMD_WEATHER")
    assert record.source_type == "TMD"
    assert "rain_rate_mm_hr" in record.value
    assert "rain_intensity_band" in record.value
    assert adapter.validate(record) is True
    # Test demo mode tagging when no real credentials provided
    assert record.extra_metadata.get("mode") in ["LIVE", "DEMO"]


@pytest.mark.asyncio
async def test_bma_adapter_normalization_and_validation():
    adapter = BMAAdapter()
    raw_list = await adapter.fetch()
    assert len(raw_list) >= 3  # Lat Krabang canal gauges

    for item in raw_list:
        record = adapter.normalize(item)
        assert record.source_type == "BMA_WATER"
        assert record.value["water_level_m_msl"] > 0
        assert record.value["trend"] in ["RISING", "STABLE", "FALLING"]
        assert adapter.validate(record) is True
        assert record.extra_metadata["mode"] == "DEMO"


@pytest.mark.asyncio
async def test_traffy_adapter_normalization_and_validation():
    adapter = TraffyAdapter()
    raw_list = await adapter.fetch()
    assert len(raw_list) > 0

    record = adapter.normalize(raw_list[0])
    assert record.source_type == "TRAFFY"
    assert "ticket_id" in record.value
    assert adapter.validate(record) is True
    assert record.extra_metadata["mode"] == "DEMO"


@pytest.mark.asyncio
async def test_satellite_adapter_observational_truth():
    adapter = SatelliteAdapter()
    raw_list = await adapter.fetch()
    assert len(raw_list) > 0

    record = adapter.normalize(raw_list[0])
    assert record.source_type == "SATELLITE"
    assert record.value["satellite_name"] == "SENTINEL-1 C-SAR"
    assert record.value["spatial_resolution_meters"] == 30.0
    # Must NOT claim minute-by-minute real-time; must be STALE / observational
    assert record.freshness == "STALE"
    assert "Observational evidence layer" in record.extra_metadata["disclaimer"]
    assert adapter.validate(record) is True
