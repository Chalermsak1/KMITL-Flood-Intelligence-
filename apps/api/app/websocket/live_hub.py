import asyncio
import json
import logging
from typing import Set
from fastapi import WebSocket, WebSocketDisconnect
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)


class LiveHubManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.redis_task: asyncio.Task = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)

    async def start_redis_listener(self):
        """Background coroutine listening to Redis 'flood:events' channel."""
        logger.info("Starting Redis pub/sub listener for 'flood:events'...")
        while True:
            try:
                client = await get_redis_client()
                pubsub = client.pubsub()
                await pubsub.subscribe("flood:events")
                logger.info("Subscribed to Redis channel: flood:events")

                async for message in pubsub.listen():
                    if message["type"] == "message":
                        data = message["data"]
                        await self.broadcast(data)
            except asyncio.CancelledError:
                logger.info("Redis listener task cancelled.")
                break
            except Exception as e:
                logger.warning(f"Redis listener connection error: {e}. Retrying in 3 seconds...")
                await asyncio.sleep(3.0)


hub_manager = LiveHubManager()
