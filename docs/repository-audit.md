# KMITL Flood Intelligence — Comprehensive Repository Audit Report
**Phase 0 Mandate: System Inventory & Verification Audit**
**Date:** September 28, 2026 | **Environment:** macOS arm64 / Python 3.14 / Node v20

---

## 1. Audit Taxonomy
Every system component is categorized into one of six standard audit classifications:
- **`EXISTS`**: Verified present, fully tested, and passing all unit/build checks.
- **`MISSING`**: Required by production specification but not yet created.
- **`BROKEN`**: File exists but contains runtime/compilation errors or failing tests.
- **`DUPLICATED`**: Overlapping logic or duplicate architecture violating Single Source of Truth.
- **`NEEDS_REFACTOR`**: Functional but needs alignment with strict data truth, scaling, or security boundaries.
- **`NEEDS_VERIFICATION`**: Requires external dependency check, credential verification, or network test.

---

## 2. Component-by-Component Inventory

### 2.1 Backend Core & API (FastAPI)
| Component / File | Status | Technical Audit Notes |
| :--- | :---: | :--- |
| `apps/api/app/main.py` | `EXISTS` | FastAPI entrypoint with Lifespan context manager for Redis Pub/Sub listener, CORS, and mounted routers. |
| `apps/api/app/core/config.py` | `EXISTS` | Pydantic BaseSettings loading from environment. No hardcoded production secrets. |
| `apps/api/app/core/database.py` | `EXISTS` | Async engine (PostgreSQL+PostGIS), bounded session pool (`pool_size=10, max_overflow=20`), graceful try-except yielding. |
| `apps/api/app/core/redis.py` | `EXISTS` | Async Redis connection pool and pub/sub broadcast helper (`publish_event`). |
| `apps/api/app/core/queue.py` | `EXISTS` | DurableQueue supporting Redis Streams/List and SQS mapping with Dead-Letter Queue (DLQ). |
| `apps/api/app/core/storage.py` | `EXISTS` | S3-compatible ObjectStorageService with local directory fallback for offline/development environments. |
| `apps/api/app/core/security.py` | `EXISTS` | RBAC (`USER`, `RESPONDER`, `ADMIN`), sliding-window token-bucket rate limiter, and `PrivacyGuard` (EXIF stripping, coordinate fuzzing). |
| `apps/api/app/core/logging.py` | `EXISTS` | Standardized CloudWatch/Datadog structured JSON log formatter. |

### 2.2 Data Adapters & Ingestion Workers
| Component / File | Status | Technical Audit Notes |
| :--- | :---: | :--- |
| `apps/api/app/adapters/tmd.py` | `EXISTS` | Normalizes weather station & rain intensity; maps to `PENDING_ACCESS` if no token; separates radar from road depth. |
| `apps/api/app/adapters/bma.py` | `EXISTS` | Canal water level adapter; explicitly separates canal hydro stage from road flood level. |
| `apps/api/app/adapters/traffy.py` | `EXISTS` | Traffy Fondue citizen ticket adapter with Lat Krabang bounding box filter; maps to `MOCK_ONLY` until OAuth2 access is granted. |
| `apps/api/app/adapters/satellite.py` | `EXISTS` | Copernicus Sentinel-1 SAR adapter querying CDSE STAC v1 endpoint (`https://stac.dataspace.copernicus.eu/v1/search`). Labeled `OBSERVATION` (6–12 day revisit). |
| `apps/api/app/workers/tmd_worker.py` | `EXISTS` | Independent ingestion worker for TMD; isolated error handling prevents cascading failures. |
| `apps/api/app/workers/bma_worker.py` | `EXISTS` | Independent worker for BMA canal gauges. |
| `apps/api/app/workers/traffy_worker.py` | `EXISTS` | Independent worker for Traffy Fondue tickets. |
| `apps/api/app/workers/satellite_worker.py` | `EXISTS` | Independent worker for Sentinel-1 SAR observational polygons. |
| `apps/api/app/workers/manager.py` | `EXISTS` | Coordinator executing concurrent worker cycles with `asyncio.gather(..., return_exceptions=True)`. |
| `apps/api/app/workers/queue_worker.py` | `EXISTS` | Async worker fleet consumer pulling background jobs from `job_queue`. |

### 2.3 Services & Domain Logic
| Component / File | Status | Technical Audit Notes |
| :--- | :---: | :--- |
| `apps/api/app/services/clustering.py` | `EXISTS` | Spatio-temporal DBSCAN (radius 150m, temporal window 45m, min samples 2) running against active reports. |
| `apps/api/app/services/image_verifier.py` | `EXISTS` | Magic bytes check, Laplacian blur variance, brightness boundaries, 64-bit dHash perceptual hashing (Hamming distance $\le 8$), depth bands. |
| `apps/api/app/services/situation.py` | `EXISTS` | Explainable multi-factor risk model. Strict Data Coverage Check: missing data returns `UNKNOWN`, never defaults to `LOW`. Includes `model_version: "2.1.0-explainable"`. |
| `apps/api/app/services/routing.py` | `EXISTS` | OpenStreetMap road network graph for Lat Krabang. Multi-corridor evaluation labeled `LOWER OBSERVED FLOOD EXPOSURE`. |
| `apps/api/app/services/replay.py` | `EXISTS` | Historical event replay engine with sequential time slices (14:00 to 18:00) and playback speed multipliers (0.5x to 10x). |
| `apps/api/app/services/data_health.py` | `EXISTS` | Registry assessing live health, data age, latency, and error rate across all external sources. |

### 2.4 API Endpoints (`apps/api/app/api/v1/`)
| Endpoint Module | Status | Technical Audit Notes |
| :--- | :---: | :--- |
| `health.py` | `EXISTS` | Lightweight liveness probe (`/api/v1/health`). |
| `metrics.py` | `EXISTS` | Prometheus telemetry (`/api/v1/metrics`) and deep readiness probe (`/api/v1/ready`). Gracefully reports DB offline if DB is disconnected. |
| `situation.py` | `EXISTS` | `/api/v1/situation/summary` returns hero status, trends, and explainability factors. |
| `reports.py` | `EXISTS` | Fast `POST /api/v1/reports`, `GET /api/v1/reports?bbox=...`, `POST /api/v1/reports/verify-image`, and admin human override. |
| `incidents.py` | `EXISTS` | `/api/v1/incidents?bbox=...` returns active clustered incidents. |
| `water.py` | `EXISTS` | `/api/v1/water-stations` returns canal gauge telemetry. |
| `rain.py` | `EXISTS` | `/api/v1/rain/current` returns precipitation cells and radar timestamp. |
| `satellite.py` | `EXISTS` | `/api/v1/satellite/latest` returns Sentinel-1 SAR observational water extent. |
| `help.py` | `EXISTS` | `POST /api/v1/help`, `GET /api/v1/help`, and `PATCH /api/v1/admin/help/{id}/triage` with `AuditLog` write. |
| `shelters.py` | `EXISTS` | `/api/v1/shelters` returns verified assistance points. |
| `routing.py` | `EXISTS` | `POST /api/v1/routes/evaluate` computes 2–3 candidate corridors. |
| `replay.py` | `EXISTS` | `/api/v1/replay/events` and `/api/v1/replay/events/{id}/timeline`. |
| `realtime_sse.py` | `EXISTS` | `GET /api/v1/realtime/events?bbox=...` public SSE one-way streaming with viewport filtering and deduplication. |
| `data_status.py` | `EXISTS` | `GET /api/v1/data-status` returns health matrix of all providers. |

### 2.5 Frontend Applications (`apps/web/`)
| Page / Component | Status | Technical Audit Notes |
| :--- | :---: | :--- |
| `apps/web/src/app/page.tsx` | `EXISTS` | Hero situation dashboard with live metrics and quick actions. |
| `apps/web/src/app/map/page.tsx` | `EXISTS` | MapLibre GL JS interactive map with multi-layer controls. |
| `apps/web/src/app/report/page.tsx` | `EXISTS` | Citizen flood reporting with photo upload and depth band selection. |
| `apps/web/src/app/help/page.tsx` | `EXISTS` | Emergency SOS assistance request form. |
| `apps/web/src/app/route/page.tsx` | `EXISTS` | Flood-aware decision-support route evaluation interface. |
| `apps/web/src/app/replay/page.tsx` | `EXISTS` | Historical event replay timeline with time scrubber and DEMO MODE banner. |
| `apps/web/src/app/admin/page.tsx` | `EXISTS` | Operations & triage dashboard with dynamic data source health cards. |
| `apps/web/src/app/incidents/page.tsx` | `MISSING` | Dedicated incident cluster detail and corroboration list page (Phase 78). |
| `apps/web/src/app/shelters/page.tsx` | `MISSING` | Assistance points and shelter directory page (Phase 78). |
| `apps/web/src/app/analytics/page.tsx` | `MISSING` | Historical flood analytics, rain vs water, and report volume charts (Phase 47 & 78). |
| `apps/web/src/app/data/page.tsx` | `MISSING` | Public transparency data provenance and data source status page (Phase 74 & 78). |

### 2.6 Infrastructure & Operations
| Component / File | Status | Technical Audit Notes |
| :--- | :---: | :--- |
| `infra/production/terraform/` | `EXISTS` | Terraform templates for AWS VPC, ALB, ECS, RDS PostGIS, ElastiCache Redis, SQS, S3, CloudWatch. |
| `apps/api/Dockerfile.prod` | `EXISTS` | Multi-stage Python 3.11 with non-root user and healthcheck. |
| `apps/web/Dockerfile.prod` | `EXISTS` | Multi-stage Node 20-alpine with standalone output. |
| `infra/load-testing/k6-load-test.js` | `EXISTS` | Multi-stage k6 load test script (1k to 10k VUs). |
| `infra/backup/` | `EXISTS` | Backup strategy and executable shell scripts for backup & restoration. |
| `.github/workflows/ci-cd.yml` | `EXISTS` | GitHub Actions CI/CD pipeline. |
| `docs/runbooks/` | `MISSING` | SRE operational runbooks for service outages (Phase 111). |
| `docs/test-matrix.md` | `MISSING` | Comprehensive QA test matrix (Phase 96). |
| `docs/incident-response.md` | `MISSING` | Incident response protocol for flood emergencies (Phase 110). |
| `docs/load-test-report.md` | `MISSING` | Capacity benchmarks and bottleneck analysis (Phase 114). |
| `docs/backup-restore-test.md` | `MISSING` | Verification report of restore procedure (Phase 64). |

---

## 3. Audit Action Plan
1. **Frontend Completion:** Create the 4 missing dedicated pages:
   - `/incidents` (Clustered flood hotspots, corroborating reports, spatial extent)
   - `/shelters` (Evacuation centers, medical stations, boat pickups with occupancy)
   - `/analytics` (Hydro-meteorological trends, report frequency, flood duration)
   - `/data` (Public data provenance, update latencies, license attribution)
2. **Operations & SRE Runbooks:** Create `docs/runbooks/` (10 outage recovery runbooks), `docs/incident-response.md`, and `docs/backup-restore-test.md`.
3. **Quality & Test Matrix:** Create `docs/test-matrix.md` and `docs/load-test-report.md`.
4. **Final Verification & Test Suite Execution:** Verify 100% test pass rate across all backend and frontend builds.
