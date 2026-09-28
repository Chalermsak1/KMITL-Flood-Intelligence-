import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.redis import close_redis_client
from app.websocket.live_hub import hub_manager
from app.api.v1 import (
    health, situation, reports, incidents,
    water, rain, satellite, help, shelters,
    data_status, routing, replay, realtime_sse,
    metrics
)

# Configure structured logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("kmitl_flood_api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing KMITL Flood Intelligence Platform API...")
    # Launch Redis listener task in background
    hub_manager.redis_task = asyncio.create_task(hub_manager.start_redis_listener())
    yield
    logger.info("Shutting down API and closing connections...")
    if hub_manager.redis_task:
        hub_manager.redis_task.cancel()
    await close_redis_client()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Real-Time Flood Situational Awareness & Assistance Platform API for KMITL and Lat Krabang",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST Routers under /api/v1
app.include_router(health.router, prefix="/api/v1")
app.include_router(situation.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(incidents.router, prefix="/api/v1")
app.include_router(water.router, prefix="/api/v1")
app.include_router(rain.router, prefix="/api/v1")
app.include_router(satellite.router, prefix="/api/v1")
app.include_router(help.router, prefix="/api/v1")
app.include_router(shelters.router, prefix="/api/v1")
app.include_router(data_status.router, prefix="/api/v1")
app.include_router(routing.router, prefix="/api/v1")
app.include_router(replay.router, prefix="/api/v1")
app.include_router(realtime_sse.router, prefix="/api/v1")
app.include_router(metrics.router, prefix="/api/v1")


# Real-time WebSocket endpoint
@app.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket):
    await hub_manager.connect(websocket)
    try:
        while True:
            # Keep connection open and receive potential client pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        hub_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error: {e}")
        hub_manager.disconnect(websocket)


@app.get("/")
async def root():
    return {
        "platform": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
        "health_check": "/api/v1/health",
        "situation_summary": "/api/v1/situation/summary"
    }
