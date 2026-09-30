import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import engine


@pytest.fixture(autouse=True)
async def cleanup_db_pool():
    yield
    await engine.dispose()


@pytest.mark.asyncio
async def test_roads_status_real_data_policy():
    """
    Verify /api/v1/roads/status adheres strictly to Real Data policy:
    1. Returns valid GeoJSON FeatureCollection
    2. Road segments without evidence MUST return status='NO_EVIDENCE' and water_depth_cm=None
    3. Never returns 0 cm or 'SAFE' for unobserved roads
    4. Segments with evidence return REPORTED/OBSERVED status and water depth
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/roads/status")
        assert res.status_code == 200
        body = res.json()
        assert body["type"] == "FeatureCollection"
        assert len(body["features"]) >= 6

        for feat in body["features"]:
            props = feat["properties"]
            assert "road_segment_id" in props
            assert "status" in props
            assert props["status"] in ["NO_EVIDENCE", "WATER_PRESENT", "FLOODED", "SEVERELY_FLOODED", "BLOCKED", "UNKNOWN"]

            # NON-NEGOTIABLE RULE: If no evidence, depth must be None, not 0
            if props["status"] == "NO_EVIDENCE":
                assert props["water_depth_cm"] is None
                assert props["measurement_status"] == "UNKNOWN"
                assert props["trend"] == "UNKNOWN"
                assert props["flow_direction"] == "UNKNOWN"


@pytest.mark.asyncio
async def test_roads_status_time_travel():
    """Test time-travel evolution offset parameter."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for offset in ["NOW", "1H_AGO", "3H_AGO", "6H_AGO", "24H_AGO"]:
            res = await client.get(f"/api/v1/roads/status?time_offset={offset}")
            assert res.status_code == 200
            body = res.json()
            assert body["time_offset"] == offset


@pytest.mark.asyncio
async def test_road_history_endpoint():
    """Verify road segment history endpoint returns chronological real observations."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/roads/SEG_CHALONG_KRUNG_CAMPUS/history")
        assert res.status_code == 200
        history = res.json()
        assert isinstance(history, list)
        for point in history:
            assert "timestamp" in point
            assert "measurement_status" in point
            assert point["measurement_status"] in ["OBSERVED", "REPORTED", "ESTIMATED"]


@pytest.mark.asyncio
async def test_drainage_network_endpoint():
    """Verify drainage infrastructure returns real canals, pumps, and retention basins."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/drainage/network")
        assert res.status_code == 200
        body = res.json()
        assert body["type"] == "FeatureCollection"
        ids = [f["id"] for f in body["features"]]
        assert "DRAIN_KHLONG_PRAWET" in ids
        assert "DRAIN_PUMP_PRAWET" in ids
        assert "DRAIN_CAMPUS_RETENTION" in ids


@pytest.mark.asyncio
async def test_water_flow_trace_contract():
    """
    WATER FLOW UX REWORK Requirements:
    1. Flooded roads return ESTIMATED or OBSERVED flow status, non-empty steps, explanation.
    2. Unobserved roads strictly return UNKNOWN flow status and intensity, never fabricated.
    3. Explanation separates evidence based on vs missing evidence.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/roads/status")
        assert res.status_code == 200
        body = res.json()

        flooded_found = False
        unobserved_found = False

        for feat in body["features"]:
            props = feat["properties"]

            # Must have flow fields
            assert "flow_status" in props
            assert "flow_intensity" in props
            assert "flow_story" in props
            assert "flow_explanation" in props
            assert "flow_path_steps" in props
            assert "flow_path_coordinates" in props

            if props["status"] in ["FLOODED", "SEVERELY_FLOODED", "WATER_PRESENT"]:
                flooded_found = True
                assert props["flow_status"] in ["ESTIMATED", "OBSERVED"]
                assert props["flow_intensity"] in ["LOW", "MEDIUM", "HIGH"]
                assert len(props["flow_path_steps"]) >= 2
                assert len(props["flow_path_coordinates"]) >= 2
                assert props["flow_explanation"]["confidence"] in ["HIGH", "MEDIUM", "LOW"]
                assert len(props["flow_explanation"]["evidence_based_on"]) > 0
                assert "Direct in-situ flow velocity sensor" in props["flow_explanation"]["missing_evidence"]
                assert "Water is estimated to move" in props["flow_story"]

            elif props["status"] == "NO_EVIDENCE":
                unobserved_found = True
                assert props["flow_status"] == "UNKNOWN"
                assert props["flow_intensity"] == "UNKNOWN"
                assert props["flow_origin"] is None
                assert len(props["flow_path_steps"]) == 0
                assert props["flow_story"] == "Water movement cannot currently be determined from available observations."
                assert props["flow_explanation"]["confidence"] == "UNKNOWN"

        assert flooded_found, "Should have at least one flooded segment in test dataset"
        assert unobserved_found, "Should have at least one unobserved segment in test dataset"


@pytest.mark.asyncio
async def test_water_flow_step_sequence():
    """Verify flow path steps have valid ordered types (FLOW_ORIGIN -> LOW_POINT -> DRAINAGE_INFRA -> CANAL_DESTINATION)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/roads/status")
        body = res.json()
        campus_seg = next(f for f in body["features"] if f["properties"]["road_segment_id"] == "SEG_CHALONG_KRUNG_CAMPUS")
        steps = campus_seg["properties"]["flow_path_steps"]
        step_types = [s["type"] for s in steps]

        assert step_types[0] == "FLOW_ORIGIN"
        assert "CANAL_DESTINATION" in step_types
        assert campus_seg["properties"]["drainage_destination"] == "คลองประเวศบุรีรมย์ (Khlong Prawet Burirom)"

