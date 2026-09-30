from app.adapters.base import DataSourceAdapter, NormalizedRecord, HealthCheckResult
from app.adapters.tmd import TMDAdapter
from app.adapters.bma import BMAAdapter
from app.adapters.traffy import TraffyAdapter
from app.adapters.satellite import SatelliteAdapter
from app.adapters.thaiwater import ThaiWaterAdapter
from app.adapters.openmeteo import OpenMeteoAdapter

__all__ = [
    "DataSourceAdapter",
    "NormalizedRecord",
    "HealthCheckResult",
    "TMDAdapter",
    "BMAAdapter",
    "TraffyAdapter",
    "SatelliteAdapter",
    "ThaiWaterAdapter",
    "OpenMeteoAdapter"
]

