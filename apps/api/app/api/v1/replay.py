from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.common import StandardResponse, MetaEnvelope
from app.services.replay import ReplayService

router = APIRouter(tags=["Historical Event Replay & Simulation"])


@router.get("/replay/events")
async def list_replay_events(db: AsyncSession = Depends(get_db)):
    """
    List archived historical flood events available for analysis, training, and simulation.
    Explicitly labeled with mode=DEMO / OBSERVATION.
    """
    now = datetime.now(timezone.utc)
    events = await ReplayService.list_events(db)

    meta = MetaEnvelope(
        source="KMITL Historical Archive Replay Service",
        observed_at=now,
        ingested_at=now,
        freshness="AGING",
        confidence="HIGH",
        attribution="BMA DDS & TMD Historical Archives",
        mode="DEMO"
    )
    return StandardResponse(data={"events": events}, meta=meta)


@router.get("/replay/events/{event_id}/timeline")
async def get_event_timeline(event_id: str, db: AsyncSession = Depends(get_db)):
    """
    Retrieve full multi-timestep timeline for time scrubber slider in Replay UI.
    """
    now = datetime.now(timezone.utc)
    timeline_data = await ReplayService.get_timeline(event_id, db)

    meta = MetaEnvelope(
        source="KMITL Event Replay Engine",
        observed_at=now,
        ingested_at=now,
        freshness="AGING",
        confidence="HIGH",
        attribution="Historical Hydro-meteorological Records",
        mode="DEMO"
    )
    return StandardResponse(data=timeline_data, meta=meta)
