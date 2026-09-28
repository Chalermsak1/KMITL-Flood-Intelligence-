import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.entities import FloodEvent, EventSnapshot


DEFAULT_HISTORICAL_EVENT = {
    "id": "e7b0c3a1-5f28-4e89-9a14-b8163f458129",
    "name": "Lat Krabang Severe Monsoon Inundation (Historical Scenario)",
    "area": "KMITL, Chalong Krung, Hua Takhe Basin",
    "start_at": "2022-09-08T14:00:00Z",
    "end_at": "2022-09-08T18:00:00Z",
    "peak_risk": "HIGH",
    "peak_reports": 24,
    "description": "Prolonged convective rainfall exceeding 110mm in 3 hours, causing canal bank overflow along Khlong Prawet and flooding Chalong Krung roadway.",
    "source": "BMA DDS Historical Archive & TMD Radar Record",
    "mode": "DEMO"
}

# Pre-computed realistic time slices for replay
DEFAULT_SNAPSHOTS = [
    {
        "snapshot_timestamp": "2022-09-08T14:00:00Z",
        "time_label": "14:00 (Onset)",
        "rain_intensity": "MODERATE",
        "rainfall_rate_mm": 22.5,
        "canal_water_level_m": 0.65,
        "canal_status": "NORMAL",
        "active_reports_count": 2,
        "active_incidents_count": 0,
        "risk_level": "LOW",
        "risk_score": 0.25,
        "satellite_available": False,
        "summary": "Heavy dark cloud buildup over Suvarnabhumi & Lat Krabang. Rain begins."
    },
    {
        "snapshot_timestamp": "2022-09-08T15:00:00Z",
        "time_label": "15:00 (Intense Downpour)",
        "rain_intensity": "HEAVY",
        "rainfall_rate_mm": 68.0,
        "canal_water_level_m": 1.05,
        "canal_status": "WARNING",
        "active_reports_count": 8,
        "active_incidents_count": 1,
        "risk_level": "MEDIUM",
        "risk_score": 0.58,
        "satellite_available": False,
        "summary": "Severe downpour over Chalong Krung. Water accumulates 10-20cm on road edges."
    },
    {
        "snapshot_timestamp": "2022-09-08T16:00:00Z",
        "time_label": "16:00 (Peak Inundation)",
        "rain_intensity": "TORRENTIAL",
        "rainfall_rate_mm": 115.0,
        "canal_water_level_m": 1.42,
        "canal_status": "CRITICAL",
        "active_reports_count": 24,
        "active_incidents_count": 3,
        "risk_level": "HIGH",
        "risk_score": 0.88,
        "satellite_available": True,
        "satellite_note": "Sentinel-1 SAR descending pass corroborates 1.2 sq km surface water.",
        "summary": "Khlong Prawet reaches critical threshold. Road impassable for sedans near KMITL railway."
    },
    {
        "snapshot_timestamp": "2022-09-08T17:00:00Z",
        "time_label": "17:00 (Pumping & Drainage)",
        "rain_intensity": "LIGHT",
        "rainfall_rate_mm": 12.0,
        "canal_water_level_m": 1.22,
        "canal_status": "WARNING",
        "active_reports_count": 16,
        "active_incidents_count": 2,
        "risk_level": "MEDIUM",
        "risk_score": 0.62,
        "satellite_available": True,
        "summary": "Rain ceases. BMA pumping stations active. Water levels steadily receding."
    },
    {
        "snapshot_timestamp": "2022-09-08T18:00:00Z",
        "time_label": "18:00 (Recovery)",
        "rain_intensity": "NONE",
        "rainfall_rate_mm": 0.0,
        "canal_water_level_m": 0.88,
        "canal_status": "NORMAL",
        "active_reports_count": 5,
        "active_incidents_count": 1,
        "risk_level": "LOW",
        "risk_score": 0.35,
        "satellite_available": True,
        "summary": "Main roads passable with caution. Localized puddles remain on low-lying sois."
    }
]


class ReplayService:
    @classmethod
    async def list_events(cls, session: AsyncSession) -> List[Dict[str, Any]]:
        try:
            stmt = select(FloodEvent).order_by(FloodEvent.start_at.desc())
            db_events = (await session.execute(stmt)).scalars().all()
            if db_events:
                return [
                    {
                        "id": str(e.id),
                        "name": e.name,
                        "area": e.area,
                        "start_at": e.start_at.isoformat(),
                        "end_at": e.end_at.isoformat(),
                        "peak_risk": e.peak_risk,
                        "peak_reports": e.peak_reports,
                        "description": e.description,
                        "source": e.source,
                        "mode": e.mode
                    }
                    for e in db_events
                ]
        except Exception:
            pass

        return [DEFAULT_HISTORICAL_EVENT]

    @classmethod
    async def get_timeline(cls, event_id: str, session: AsyncSession) -> Dict[str, Any]:
        """
        Return the chronological slices of the event for timeline slider scrub.
        """
        return {
            "event": DEFAULT_HISTORICAL_EVENT,
            "timeline": DEFAULT_SNAPSHOTS,
            "playback_speeds": ["0.5x", "1x", "2x", "5x", "10x"],
            "mode": "DEMO"
        }
