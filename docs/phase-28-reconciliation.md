# KMITL Flood Intelligence — Phase 28 Evidence & Architecture Reconciliation

**Date:** 2026-09-28  
**Scope:** Deep reconciliation of reported metrics, architectural claims, and actual running codebase  

---

## 1. Executive Summary

This document performs an exhaustive audit to reconcile all reported numbers, claims, and architectural invariants against the actual codebase. It removes ambiguity, corrects conflicting statements, and grounds every metric in concrete empirical evidence.

---

## 2. Core Reconciliation Matrix

| Item | Reported Result in Docs | Actual Implementation in Codebase | Empirical Evidence | Reconciled Status |
|---|---|---|---|---|
| **HTTP Throughput (DB Offline)** | 95.2 req/s, p95: 2,012ms | `uvicorn` single worker on OS TCP socket; `asyncio.wait_for(timeout=2.0)` | `docs/real-http-load-test-report.md` | **RECONCILED**: Real TCP socket benchmark with DB cold-start timeout before circuit breaker opens. |
| **HTTP Throughput (Warm/Fast-Fail)** | 250 req/s, p50: 12ms, p95: 38ms | `db_circuit_breaker` trips to OPEN; requests fast-fail in < 1ms to UNKNOWN fallback | `tests/test_db_failure_latency.py` | **RECONCILED**: Circuit breaker warm state eliminates asyncpg connection hang. |
| **SSE Realtime Capacity** | 10,000 concurrent streams | In-memory asyncio subscriber queues in `realtime_sse.py` | `docs/sse-scale-test.md` (fanout 11.36ms, 18.5MB RAM) | **RECONCILED**: Synthetic in-process queue benchmark. Real mobile connections subject to carrier NAT timeouts. |
| **Ingestion Queue Durability** | "Durable SQS + Redis queue" | 3-tier hybrid: SQS (Tier 1), Redis (Tier 2), Disk Spool WAL with fsync (Tier 3) | `apps/api/app/core/queue.py`, `tests/test_queue_durability.py` | **RECONCILED**: If SQS is unconfigured, system falls back to Redis + local persistent JSONL WAL. |
| **First-Party Citizen Reports** | LIVE | Multipart form upload, magic bytes, PIL decode, EXIF strip, pHash, PostGIS | `apps/api/app/api/v1/reports.py` | **VERIFIED LIVE** |
| **Satellite SAR Inundation** | OBSERVATION (STALE) | Copernicus STAC / static Lat Krabang retention polygon; ESA attribution; 14h lag | `apps/api/app/adapters/satellite.py` | **VERIFIED OBSERVATION** (Never claimed LIVE) |
| **TMD Weather Telemetry** | PENDING_ACCESS / DEMO | Calibrated scenario model fallback; live flag rejected without credentials | `apps/api/app/adapters/tmd.py`, `apps/api/app/api/v1/beta.py` | **VERIFIED PENDING_ACCESS** |
| **BMA Drainage Telemetry** | PENDING_ACCESS / DEMO | Station baseline model fallback; live flag rejected without credentials | `apps/api/app/adapters/bma.py`, `apps/api/app/api/v1/beta.py` | **VERIFIED PENDING_ACCESS** |
| **Traffy Fondue Tickets** | PENDING_ACCESS / DEMO | Historical ticket sample fallback; live flag rejected without credentials | `apps/api/app/adapters/traffy.py`, `apps/api/app/api/v1/beta.py` | **VERIFIED PENDING_ACCESS** |
| **SOS Emergency Assistance** | PILOT_TEST | Warning disclaimers attached; directs critical life threats to 191/199/1669 | `apps/api/app/api/v1/help.py` | **VERIFIED PILOT_TEST** (Not full operational) |
| **Shelter Occupancy** | OCCUPANCY_NOT_VERIFIED | Default occupancy = 0; authenticated `PATCH /shelters/{id}/occupancy` with AuditLog | `apps/api/app/api/v1/shelters.py` | **VERIFIED NO FAKE COUNTS** |
| **Route Safety Claims** | LOWER OBSERVED FLOOD EXPOSURE | Forbidden words ('100% Safe', 'Flood-Free') banned; audit fields attached | `apps/api/app/services/routing.py` | **VERIFIED HONEST ROUTING** |

---

## 3. Discrepancy Analysis & Explanations

### 3.1 Throughput Difference: 95.2 req/s vs 250 req/s
- **95.2 req/s (Real TCP Network Client)**: Conducted using `httpx.AsyncClient` communicating over real OS loopback TCP sockets (`127.0.0.1:8765`) to a running `uvicorn` process with PostgreSQL **completely offline**. The initial requests incurred the full 2.0-second asyncpg connect timeout before tripping the circuit breaker.
- **250 req/s (Post-Trip Fast-Fail / ASGI Transport)**: Once the circuit breaker tripped to `OPEN`, subsequent requests were immediately routed to the memory fallback in `< 1ms`, achieving over 250 req/s. Both measurements are empirically correct in their respective runtime states.

### 3.2 SSE Stream Capacity: Synthetic vs. Real Mobile Users
- The 10,000 subscriber benchmark in `docs/sse-scale-test.md` proves that the Python asyncio event loop can service 10,000 subscriber queues with minimal memory ($1.9\text{ KB}$ per queue) and rapid fanout ($11.36\text{ ms}$).
- **Production Truth**: In real deployment, 10,000 concurrent mobile browser connections require adequate OS file descriptor limits (`ulimit -n 65535`), Application Load Balancer connection idle timeouts (configured to $\ge 60\text{s}$), and keepalive frames every 15 seconds to prevent mobile carrier NAT disconnections.
