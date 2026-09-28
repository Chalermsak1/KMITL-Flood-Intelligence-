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
    metrics, beta
)

# Configure structured logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("kmitl_flood_api")


from app.workers.queue_worker import AsyncQueueWorker

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing KMITL Flood Intelligence Platform API...")
    # Launch Redis listener task in background
    hub_manager.redis_task = asyncio.create_task(hub_manager.start_redis_listener())
    queue_worker = AsyncQueueWorker()
    queue_worker_task = asyncio.create_task(queue_worker.start())
    yield
    logger.info("Shutting down API and closing connections...")
    queue_worker.stop()
    queue_worker_task.cancel()
    if hub_manager.redis_task:
        hub_manager.redis_task.cancel()
    await close_redis_client()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Real-Time Flood Situational Awareness & Assistance Platform API for KMITL and Lat Krabang",
    lifespan=lifespan
)

class SecurityHeadersMiddleware:
    """
    Pure ASGI Production Security Headers:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY (clickjacking protection)
    - Referrer-Policy: strict-origin-when-cross-origin
    - Content-Security-Policy: restrict dangerous scripts
    - Strict-Transport-Security: HSTS when in production
    - Body size guard: rejects oversized requests (>10MB) with 413
    Avoids Starlette BaseHTTPMiddleware memory-channel deadlocks on SSE/WebSockets.
    """
    MAX_BODY_BYTES = 10 * 1024 * 1024  # 10MB limit

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Check content-length header
        for name, value in scope.get("headers", []):
            if name.lower() == b"content-length":
                try:
                    if int(value.decode("latin1")) > self.MAX_BODY_BYTES:
                        body = b'{"detail":"Payload Too Large: request body exceeds 10MB limit."}'
                        await send({
                            "type": "http.response.start",
                            "status": 413,
                            "headers": [
                                (b"content-type", b"application/json"),
                                (b"content-length", str(len(body)).encode("latin1")),
                            ],
                        })
                        await send({
                            "type": "http.response.body",
                            "body": body,
                        })
                        return
                except ValueError:
                    pass
                break

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-content-type-options", b"nosniff"))
                headers.append((b"x-frame-options", b"DENY"))
                headers.append((b"referrer-policy", b"strict-origin-when-cross-origin"))
                headers.append((b"content-security-policy", b"default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline';"))
                if settings.ENVIRONMENT.lower() == "production":
                    headers.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


# Mount Middlewares
app.add_middleware(SecurityHeadersMiddleware)
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
app.include_router(beta.router, prefix="/api/v1")


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
        "phase": "26-LIMITED-BETA",
        "docs_url": "/docs",
        "health_check": "/api/v1/health",
        "situation_summary": "/api/v1/situation/summary",
        "beta_coverage": "/api/v1/beta/coverage",
        "feature_flags": "/api/v1/beta/features",
        "sos_status": "/api/v1/help/status",
    }
