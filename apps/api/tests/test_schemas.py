import pytest
from pydantic import ValidationError
from app.schemas.report import FloodReportCreate
from app.models.enums import WaterDepthBand, VehiclePassability, TransportType


def test_valid_flood_report_create():
    valid = FloodReportCreate(
        latitude=13.7298,
        longitude=100.7782,
        water_depth_band=WaterDepthBand.DEPTH_20_TO_40CM,
        vehicle_passability=VehiclePassability.DIFFICULT,
        transport_type=TransportType.CAR,
        description="น้ำท่วมผิวถนนฉลองกรุง"
    )
    assert valid.latitude == 13.7298
    assert valid.longitude == 100.7782
    assert valid.water_depth_band == WaterDepthBand.DEPTH_20_TO_40CM


def test_invalid_coordinates_reject():
    # Latitude > 90 must fail
    with pytest.raises(ValidationError):
        FloodReportCreate(
            latitude=95.0,
            longitude=100.7782,
            water_depth_band=WaterDepthBand.BELOW_10CM
        )

    # Longitude < -180 must fail
    with pytest.raises(ValidationError):
        FloodReportCreate(
            latitude=13.7298,
            longitude=-185.0,
            water_depth_band=WaterDepthBand.BELOW_10CM
        )


def test_invalid_depth_band_reject():
    with pytest.raises(ValidationError):
        FloodReportCreate(
            latitude=13.7298,
            longitude=100.7782,
            water_depth_band="EXACTLY_35_CM"  # Invalid exact depth! Must use depth band enum
        )
