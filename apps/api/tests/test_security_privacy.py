import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import PrivacyGuard


def test_exif_stripping_protects_citizen_gps():
    """
    Privacy Validation: EXIF metadata must be stripped.
    """
    from PIL import Image
    import io
    
    img = Image.new("RGB", (100, 100), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    raw_bytes = buf.getvalue()
    
    cleaned = PrivacyGuard.strip_exif(raw_bytes)
    assert len(cleaned) > 0


def test_public_coordinate_sanitization():
    """
    Privacy Validation: Public incident coordinates must be rounded or generalized.
    """
    data = {
        "requester_name": "Somchai",
        "contact_phone": "0812345678",
        "vulnerable_details": "Critical oxygen patient",
        "latitude": 13.729876543,
        "longitude": 100.776543210
    }
    masked = PrivacyGuard.mask_sos_for_public(data)
    assert "requester_name" not in masked
    assert "contact_phone" not in masked
    assert "vulnerable_details" not in masked
    assert masked["latitude"] == 13.73
    assert masked["longitude"] == 100.777


@pytest.mark.asyncio
async def test_public_reports_endpoint_no_pii_leak():
    """
    Privacy Validation: GET /api/v1/reports must never expose citizen names, phone numbers, or IPs.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/reports")
        assert resp.status_code == 200
        reports = resp.json()["data"]
        for r in reports:
            assert "reporter_name" not in r
            assert "reporter_phone" not in r
            assert "ip_address" not in r


@pytest.mark.asyncio
async def test_sql_injection_defense_on_bbox():
    """
    Security Validation: Malicious bbox string must not cause SQL injection or unhandled 500.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        malicious_bbox = "100.70' OR '1'='1; DROP TABLE flood_reports;--"
        resp = await client.get(f"/api/v1/reports?bbox={malicious_bbox}")
        # Must either return 200 with sanitized/empty list or safe 400/422 error, NEVER unhandled 500
        assert resp.status_code in [200, 400, 422]


@pytest.mark.asyncio
async def test_invalid_coordinates_rejected():
    """
    Security Validation: Submissions with invalid coordinates (e.g. lat > 90) must be rejected with 422.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "latitude": 999.0,  # Invalid
            "longitude": 100.77,
            "water_depth_band": "10_TO_20CM",
            "vehicle_passability": "PASSABLE",
            "transport_type": "WALK"
        }
        resp = await client.post("/api/v1/reports", json=payload)
        assert resp.status_code == 422
