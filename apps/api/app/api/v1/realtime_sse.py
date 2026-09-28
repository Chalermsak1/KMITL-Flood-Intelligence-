import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator

from fastapi import APIRouter, Query, Request, Header
from fastapi.responses import StreamingResponse
import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger("api.realtime_sse")
router = APIRouter(tags=["Public Realtime Events (SSE)"])

REDIS_CHANNEL = "flood:events"


def is_in_bbox(lat: Optional[float], lng: Optional[float], bbox_str: Optional[str]) -> bool:
    """
    Check if a coordinate point falls inside client's viewport bounding box.
    bbox formatted as 'minLng,minLat,maxLng,maxLat'.
    If no bbox is requested or event has no location, defaults to True.
    """
    if not bbox_str or lat is None or lng is None:
        return True
    try:
        parts = [float(p.strip()) for p in bbox_str.split(",")]
        if len(parts) != 4:
            return True
        min_lng, min_lat, max_lng, max_lat = parts
        return min_lat <= lat <= max_lat and min_lng <= lng <= max_lng
    except Exception:
        return True


async def event_generator(
    request: Request,
    bbox: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    Asynchronous event generator streaming Server-Sent Events (SSE).
    Subscribes to Redis Pub/Sub fanout, filters by viewport bbox, and emits deduplicated events.
    """
    r = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe(REDIS_CHANNEL)

    # Initial connection confirmation event
    welcome_event_id = str(uuid.uuid4())
    welcome_data = {
        "event_id": welcome_event_id,
        "event_type": "CONNECTED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "KMITL Realtime Hub",
        "version": "1.0",
        "geo_scope": bbox or "ALL_LAT_KRABANG",
        "payload": {
            "status": "connected",
            "message": "Subscribed to KMITL Flood Intelligence SSE feed"
        }
    }
    yield f"id: {welcome_event_id}\nevent: CONNECTED\ndata: {json.dumps(welcome_data)}\n\n"

    try:
        while True:
            # Check client disconnection
            if await request.is_disconnected():
                logger.info("SSE client disconnected.")
                break

            try:
                # Non-blocking get message with 15s timeout for keepalive
                msg = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=15.0)
                if msg and msg.get("type") == "message":
                    raw_data = json.loads(msg["data"])
                    event_type = raw_data.get("event") or raw_data.get("event_type", "MESSAGE")
                    payload = raw_data.get("data") or raw_data.get("payload", {})
                    event_id = raw_data.get("event_id") or str(uuid.uuid4())
                    timestamp = raw_data.get("timestamp") or datetime.now(timezone.utc).isoformat()

                    # Viewport Bounding Box Filtering
                    lat = payload.get("latitude") or payload.get("lat")
                    lng = payload.get("longitude") or payload.get("lng")
                    if bbox and not is_in_bbox(lat, lng, bbox):
                        continue  # Skip events outside client's viewport

                    envelope = {
                        "event_id": event_id,
                        "event_type": event_type,
                        "timestamp": timestamp,
                        "source": raw_data.get("source", "KMITL Flood Intelligence"),
                        "version": "1.0",
                        "geo_scope": bbox or "ALL_LAT_KRABANG",
                        "payload": payload
                    }

                    yield f"id: {event_id}\nevent: {event_type}\ndata: {json.dumps(envelope)}\n\n"
            except asyncio.TimeoutError:
                # Send SSE keepalive comment to maintain connection through proxies/Cloudflare
                yield ": keepalive\n\n"

    except Exception as e:
        logger.error(f"SSE streaming exception: {e}")
    finally:
        await pubsub.unsubscribe(REDIS_CHANNEL)
        await pubsub.close()
        await r.close()


@router.get("/realtime/events")
async def sse_events_stream(
    request: Request,
    bbox: Optional[str] = Query(None, description="Client viewport BBox: minLng,minLat,maxLng,maxLat")
):
    """
    Public One-Way Realtime Streaming Endpoint (SSE).
    Lightweight, CDN-friendly, horizontal-scaling fanout via Redis Pub/Sub.
    """
    return StreamingResponse(
        event_generator(request, bbox),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable Nginx/Cloudflare response buffering
        }
    )
