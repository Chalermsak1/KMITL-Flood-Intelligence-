# KMITL FLOOD INTELLIGENCE — FINAL ACTUAL ARCHITECTURE

**Document Status**: AUTHORITATIVE SOURCE OF TRUTH  
**Last Reconciled**: 2026-09-28  
**Scope**: Exact running and deployable stack without speculation or obsolete descriptions.

---

## 1. Runtime Technology Stack

| Layer | Component | Version | Configuration / Details |
|---|---|---|---|
| **Frontend** | Next.js | `14.1.4` | App Router, React 18.2.0, MapLibre GL 4.1.1, TailwindCSS 3.4.1 |
| **Frontend Runtime** | Node.js | `20-alpine` (Docker) | Next.js standalone server (`node server.js`), non-root `nextjs` user (:3000) |
| **Backend API** | FastAPI | `0.110.0+` | Python 3.11-slim, Pydantic v2, SQLAlchemy 2.0 asyncpg, GeoAlchemy2 |
| **API Server** | Uvicorn | `0.28.0+` | `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 --proxy-headers` |
| **Spatial Database** | PostgreSQL | `16` | PostgreSQL 16.1 (AWS RDS / `postgis/postgis:16-3.4-alpine` Docker) |
| **Spatial Extension** | PostGIS | `3.4` | PostGIS 3.4 (Topology, Geometry, ST_DWithin, ST_MakeEnvelope) |
| **Cache & Pub/Sub** | Redis | `7.2` | Redis 7.2-alpine / AWS ElastiCache Multi-AZ (`default.redis7`), port 6379 |
| **Asynchronous Queue**| Multi-Tier Durable Queue | Native Python Async | Tier 1: AWS SQS, Tier 2: Redis List (`kmitl:durable:jobs`), Tier 3: Disk WAL (`queue_spool.jsonl`) |
| **Background Workers**| Async Worker Fleet | Native AsyncIO | `AsyncQueueWorker` (queue consumer) + `WorkerManager` (ingestion cycle) |
| **Realtime Transport**| 3-Tier Hybrid | WebSocket + SSE + Poll| Tier 1: WebSocket (`/ws/live`), Tier 2: SSE (`/api/v1/realtime/events`), Tier 3: HTTP Polling (20s) |
| **Object Storage** | Multi-Target Storage | Local FS / AWS S3 | Staging: Local volume (`/uploads`); AWS: S3 bucket (`kmitl-flood-evidence-prod`) with AES256 |
| **Deployment Mode** | Docker Compose / ECS | Multi-Container | Campus LAN/Staging: Docker Compose; AWS Prod: ECS Fargate (Terraform ready) |

---

## 2. Queue Architecture & Report Ingestion Flow

The previous documentation referencing "Celery" has been completely reconciled: Celery is **not** used. The platform operates a resilient, high-speed, Python asynchronous multi-tier durable queue.

### End-to-End Report Ingestion Trace:
```text
Citizen User (Mobile Browser)
   │
   ▼
POST /api/v1/reports
   │
   ├─► 1. Validate Schema & Geofence (classify_coverage: Zone A / Zone B / OUTSIDE_BETA)
   ├─► 2. Persist to PostgreSQL + PostGIS (FloodReport entity, status: UNVERIFIED, freshness: FRESH)
   ├─► 3. Publish to Redis Pub/Sub (Event: REPORT_CREATED on channel kmitl:events)
   │      │
   │      └─► Fanout to WebSocket Hub (/ws/live) & SSE Stream (/api/v1/realtime/events)
   │          └─► Realtime Map Update on other users' devices (<150ms)
   │
   └─► 4. Enqueue Job into DurableQueue (DurableQueue.enqueue)
          │
          ├─► Tier 1: AWS SQS (if SQS_QUEUE_URL configured)
          ├─► Tier 2: Redis List (kmitl:durable:jobs via LPUSH/RPUSH)
          └─► Tier 3: Disk WAL (queue_spool.jsonl with os.fsync on failure)
                 │
                 ▼
          AsyncQueueWorker (queue_worker.py)
                 │
                 ├─► Dequeue Job (BLPOP with 2s timeout)
                 ├─► CLUSTER_INCIDENTS: SpatioTemporalClusteringService (DBSCAN 250m / 2hr)
                 ├─► PROCESS_REPORT_IMAGE: pHash deduplication & EXIF sanitization
                 ├─► RECALCULATE_RISK: Update corridor road exposure scores
                 └─► On 3x Failure: Route to Dead Letter Queue (kmitl:durable:jobs:dlq)
```

---

## 3. Realtime Architecture

The platform supports a verified 3-tier hybrid transport architecture:
1. **Tier 1 (Primary) — WebSocket (`/ws/live`)**:
   - Bi-directional full duplex connection.
   - Handles connection tracking, ping/pong keepalives, and instant event broadcast.
2. **Tier 2 (Fallback 1) — Server-Sent Events (`/api/v1/realtime/events`)**:
   - Unidirectional HTTP streaming with keepalive comments `: keepalive\n\n` every 15s.
   - Client viewport BBox filtering (`minLng,minLat,maxLng,maxLat`) prevents over-fetching on mobile.
3. **Tier 3 (Fallback 2) — HTTP Polling**:
   - Automated client fallback if both WebSocket and SSE fail (e.g. strict corporate firewalls).
   - Polls every 20 seconds.
4. **UI Transport Status**:
   - Header badge displays real-time connection state: `WEBSOCKET LIVE`, `SSE LIVE`, or `HTTP POLLING`.

---

## 4. Database & Storage Version Standard

- **Database Standard**: **PostgreSQL 16 with PostGIS 3.4**.
  - All migrations and init scripts (`infra/docker/postgis-init.sql`) use PostGIS 3.4.
  - Spatial indexes (`GIST(location)`, `GIST(geom)`) deployed on `flood_reports`, `incidents`, `rain_observations`, and `water_level_observations`.
- **Cache Standard**: **Redis 7.2**.
  - Redis 7.2 used for sub-millisecond Pub/Sub messaging and job queue buffering.
- **Evidence Storage**:
  - Raw EXIF GPS metadata stripped before storage.
  - Perceptual hash (pHash) stored in database for near-duplicate image detection.

---

## 5. Deployment Reality & Environment Separation

- **Staging / Limited Public Beta**:
  - URL: `https://staging.flood.kmitl.ac.th` & `http://10.26.14.235:3000`
  - Host: KMITL Campus Authorized Multi-Container Server
  - Classification: **LIMITED PUBLIC BETA** (NOT full commercial production).
- **Target Commercial Production**:
  - AWS multi-AZ infrastructure (ECS Fargate, RDS PostgreSQL 16 Multi-AZ, ElastiCache Redis 7, SQS, S3) is fully defined in [`infra/production/terraform`](file:///Users/chalermsak/Desktop/KMITL%20Flood%20Intelligence/infra/production/terraform) and tested, awaiting sponsor budget sign-off.
