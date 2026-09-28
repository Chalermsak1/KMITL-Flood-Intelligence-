from datetime import datetime, timezone, timedelta
from typing import Any, List
from app.adapters.base import DataSourceAdapter, NormalizedRecord, HealthCheckResult


class TraffyAdapter(DataSourceAdapter):
    def __init__(self):
        super().__init__(source_id="SRC_TRAFFY_FONDUE", name="Traffy Fondue Open Data")

    async def fetch(self) -> List[Any]:
        now = datetime.now(timezone.utc)
        return [
            {
                "ticket_id": "TF-20260928-8821",
                "category": "น้ำท่วม",
                "description": "น้ำท่วมขังผิวถนนหน้าหอพัก FBT ถนนฉลองกรุง มอเตอร์ไซค์สัญจรลำบาก",
                "latitude": 13.7310,
                "longitude": 100.7810,
                "timestamp": now - timedelta(minutes=18),
                "state": "inprogress",
                "is_demo": True
            },
            {
                "ticket_id": "TF-20260928-8835",
                "category": "น้ำท่วม",
                "description": "น้ำรอการระบายซอยเกกหลง ทางออกถนนร่มเกล้า ระดับน้ำประมาณทางเท้า",
                "latitude": 13.7265,
                "longitude": 100.7680,
                "timestamp": now - timedelta(minutes=32),
                "state": "forwarded",
                "is_demo": True
            }
        ]

    def normalize(self, raw: Any) -> NormalizedRecord:
        is_demo = raw.get("is_demo", True)
        return NormalizedRecord(
            source=self.source_id if not is_demo else "SRC_TRAFFY_FONDUE_MOCK",
            source_type="TRAFFY",
            location={
                "type": "Point",
                "coordinates": [raw["longitude"], raw["latitude"]]
            },
            observed_at=raw["timestamp"],
            value={
                "ticket_id": raw["ticket_id"],
                "category": raw["category"],
                "description": raw["description"],
                "state": raw["state"]
            },
            extra_metadata={
                "mode": "DEMO" if is_demo else "LIVE",
                "attribution": "Traffy Fondue Platform (NECTEC/BMA)"
            },
            freshness="RECENT",
            confidence="MEDIUM"
        )

    async def health_check(self) -> HealthCheckResult:
        return HealthCheckResult(
            source_id=self.source_id,
            status="PENDING_ACCESS",
            latency_ms=10,
            message="Traffy Fondue live tickets require NECTEC OAuth2 token (mode: DEMO / HISTORICAL)",
            mode="DEMO"
        )
