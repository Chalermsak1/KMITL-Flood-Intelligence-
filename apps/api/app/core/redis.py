import json
import logging
from typing import Optional, Any
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client: Optional[aioredis.Redis] = None


async def get_redis_client() -> aioredis.Redis:
    global redis_client
    if redis_client is None:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return redis_client


async def close_redis_client() -> None:
    global redis_client
    if redis_client is not None:
        await redis_client.close()
        redis_client = None


async def publish_event(event_type: str, payload: Any) -> None:
    """
    Publishes an event to the Redis 'flood:events' channel for real-time WebSocket distribution.
    """
    try:
        client = await get_redis_client()
        message = json.dumps({
            "event": event_type,
            "payload": payload
        }, default=str)
        await client.publish("flood:events", message)
    except Exception as e:
        logger.warning(f"Failed to publish event {event_type} to Redis: {e}")
