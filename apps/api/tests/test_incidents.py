import pytest
import uuid
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import engine
from app.api.v1.incidents import to_utc


def test_to_utc_helper():
    # Test None
    res_none = to_utc(None)
    assert res_none.tzinfo is not None

    # Test naive datetime (the cause of offset-naive 500 errors)
    naive = datetime(2026, 9, 28, 12, 0, 0)
    assert naive.tzinfo is None
    res_naive = to_utc(naive)
    assert res_naive.tzinfo == timezone.utc

    # Test aware datetime
    aware = datetime(2026, 9, 28, 12, 0, 0, tzinfo=timezone.utc)
    res_aware = to_utc(aware)
    assert res_aware.tzinfo == timezone.utc


@pytest.fixture(autouse=True)
async def cleanup_db_pool():
    yield
    await engine.dispose()


@pytest.mark.asyncio
async def test_incidents_api_full_suite():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Standard list
        resp = await client.get("/api/v1/incidents")
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "meta" in data
        assert data["meta"]["source"] == "KMITL_INCIDENT_CLUSTERING_ENGINE"
        assert isinstance(data["data"], list)

        # 2. Status filters
        resp_all = await client.get("/api/v1/incidents?status=ALL")
        assert resp_all.status_code == 200

        resp_active = await client.get("/api/v1/incidents?status=ACTIVE")
        assert resp_active.status_code == 200

        resp_lower = await client.get("/api/v1/incidents?status=active")
        assert resp_lower.status_code == 200

        resp_unknown = await client.get("/api/v1/incidents?status=NONEXISTENT_STATUS")
        assert resp_unknown.status_code == 200
        assert resp_unknown.json()["data"] == []

        # 3. Bbox filtering
        resp_valid = await client.get("/api/v1/incidents?bbox=100.7,13.7,100.8,13.8")
        assert resp_valid.status_code == 200

        resp_invalid = await client.get("/api/v1/incidents?bbox=invalid_coords")
        assert resp_invalid.status_code == 400
        assert "Invalid bbox format" in resp_invalid.json()["detail"]

        # 4. Detail endpoint
        fake_id = str(uuid.uuid4())
        resp_404 = await client.get(f"/api/v1/incidents/{fake_id}")
        assert resp_404.status_code == 404

        if data["data"]:
            real_id = data["data"][0]["id"]
            resp_detail = await client.get(f"/api/v1/incidents/{real_id}")
            assert resp_detail.status_code == 200
            assert resp_detail.json()["data"]["id"] == real_id

            # 5. Operator status update
            resp_admin = await client.post(
                f"/api/v1/admin/incidents/{real_id}/status?action=ACTIVE&notes=Auto-tested"
            )
            assert resp_admin.status_code == 200
            assert resp_admin.json()["status"] == "ACTIVE"

        # 6. Admin update invalid action
        resp_bad_act = await client.post(
            f"/api/v1/admin/incidents/{fake_id}/status?action=INVALID_ACTION"
        )
        assert resp_bad_act.status_code == 400
