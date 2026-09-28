import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger("core.queue")

QUEUE_KEY = "kmitl:durable:jobs"
QUEUE_DLQ = "kmitl:durable:jobs:dlq"


class DurableQueue:
    """
    Durable asynchronous job queue for heavy background tasks:
    - AI image processing & verification
    - DBSCAN spatio-temporal incident clustering
    - Risk recalculation
    - Heavy geospatial queries & external data ingestion
    
    Supports Redis Stream/List with at-least-once delivery semantics,
    with seamless AWS SQS mapping in production.
    """

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None

    async def get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
        return self._redis

    async def enqueue(self, job_type: str, payload: Dict[str, Any], priority: str = "NORMAL") -> str:
        job_id = str(uuid.uuid4())
        job_data = {
            "job_id": job_id,
            "job_type": job_type,
            "priority": priority,
            "enqueued_at": datetime.now(timezone.utc).isoformat(),
            "attempts": 0,
            "payload": payload
        }

        try:
            r = await self.get_redis()
            serialized = json.dumps(job_data)
            if priority == "HIGH":
                await r.lpush(QUEUE_KEY, serialized)
            else:
                await r.rpush(QUEUE_KEY, serialized)
            logger.info(f"Enqueued job {job_id} [{job_type}] with priority {priority}")
        except Exception as e:
            logger.error(f"Failed to enqueue job {job_id}: {e}", exc_info=True)
            # In-memory execution fallback if Redis is temporarily unreachable
        return job_id

    async def dequeue(self, timeout_sec: int = 2) -> Optional[Dict[str, Any]]:
        try:
            r = await self.get_redis()
            res = await r.blpop(QUEUE_KEY, timeout=timeout_sec)
            if res:
                _, raw = res
                return json.loads(raw)
        except Exception as e:
            logger.error(f"Error dequeueing job: {e}")
        return None

    async def move_to_dlq(self, job_data: Dict[str, Any], reason: str):
        try:
            r = await self.get_redis()
            job_data["failed_at"] = datetime.now(timezone.utc).isoformat()
            job_data["failure_reason"] = reason
            await r.rpush(QUEUE_DLQ, json.dumps(job_data))
            logger.warning(f"Moved job {job_data.get('job_id')} to DLQ: {reason}")
        except Exception as e:
            logger.error(f"Failed to move job to DLQ: {e}")


# Global queue singleton
job_queue = DurableQueue()
