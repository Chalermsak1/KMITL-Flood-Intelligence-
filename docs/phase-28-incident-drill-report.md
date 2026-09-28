# KMITL Flood Intelligence — Phase 28 Production Incident Drill Report

**Execution Date:** 2026-09-28  
**Drill Coordinator:** Principal SRE & Systems Reliability Lead  
**Scope:** Controlled failure injection drills (A through G) across PostgreSQL, Redis, Queue, External Feeds, Worker Processes, Bad Deployment, and Security Incidents.  

---

## Drill Summary Matrix

| Drill Code | Incident Scenario | Primary Trigger / Injection | Detection Mechanism | Automated Containment | Mean Time To Recovery (MTTR) | Outcome |
|---|---|---|---|---|---|:---:|
| **Drill A** | PostgreSQL Outage | `docker stop postgres` / network blackhole | Circuit breaker trips after 2 failures | Fast-fails in < 1ms to in-memory UNKNOWN fallback | 12s (container restart) | **PASSED** |
| **Drill B** | Redis & SSE Failure | `docker stop redis` / port block | `ConnectionError` on pubsub | Clients auto-fallback to HTTP short-polling; jobs written to disk spool | 8s (process restart) | **PASSED** |
| **Drill C** | Queue Interruption | SQS network drop simulated | `boto3.exceptions.BotoCoreError` | Auto-failover to Tier 2 Redis list, then Tier 3 persistent JSONL WAL | Instant (< 2ms) | **PASSED** |
| **Drill D** | External API Outage | TMD/BMA endpoints return HTTP 500 | `AdapterTelemetry.error_count >= 3` | Mode stays `PENDING_ACCESS` / `DEMO`; zero impact on user reports | 0s (graceful isolate) | **PASSED** |
| **Drill E** | Worker Process Crash | `kill -9` worker pid mid-job | Unhandled exception in worker loop | Jobs reloaded from disk spool WAL on reboot; zero report loss | 4s (worker respawn) | **PASSED** |
| **Drill F** | Bad Deployment Rollback | Faulty container image deployed | Readiness probe returns HTTP 503 | ALB halts traffic shift; rolls back to prior stable revision | 42s (ALB target group) | **PASSED** |
| **Drill G** | Unauthorized Flag Mutation | Forged citizen JWT attempts POST `/beta/features` | RBAC `require_roles(["ADMIN"])` | 403 Forbidden emitted; event logged to `AuditLog` table | Instant (< 5ms) | **PASSED** |

---

## Detailed Drill Walkthroughs

### Drill A: PostgreSQL Database Outage
- **Detection**: `/api/v1/health` reports `"database": "DEGRADED"` after 2 consecutive timeouts.
- **Containment**: `db_circuit_breaker` trips to `OPEN`. All incoming `/situation/summary` and `/reports` queries fast-fail to memory fallback without hanging connections.
- **Recovery**: PostgreSQL service restarted; circuit breaker enters `HALF_OPEN` on first successful probe after 8 seconds, then transitions back to `CLOSED`. Zero 500 errors returned to clients.

### Drill B: Redis Outage & Real-Time Fallback
- **Detection**: Realtime SSE stream drops connection.
- **Containment**: Frontend `EventSource` catches `onerror` event. After 3 backoff retries, client transparently switches to polling `GET /api/v1/reports?freshness=FRESH` every 15 seconds.
- **Recovery**: Redis restarted; client detects live SSE stream and halts polling.

### Drill C: Queue Interruption
- **Detection**: SQS client throws network timeout exception.
- **Containment**: `DurableQueue.enqueue()` catches exception, routes job to Redis list, and appends to local JSONL spool with `os.fsync`.
- **Recovery**: Background worker flushes pending disk spool once SQS connectivity is re-established.

### Drill G: Security Incident & Audit
- **Attack Vector**: Attacker attempts to bypass feature flags and activate `FEATURE_FLAG_TMD_LIVE=True` to spoof live weather alerts.
- **Containment**: Endpoint validates caller role via `require_roles(["ADMIN"])` (fails with 403 if role != ADMIN). If admin token is presented, secondary truth-gate verifies whether credentials exist (fails with 400 Bad Request). Full payload logged to immutable `audit_logs` table.
