# Phase 29 Production Deployment & Environment Separation

**Date**: September 28, 2026  
**Commit**: `923a995488a8f264944dea59f02e9e628928f1fe`  
**Deployment State**: `PRODUCTION NOT DEPLOYED (STAGING & LOCAL MULTI-CONTAINER VERIFIED)`  

---

## 1. Production Deployment Topology Audit

| Component | Architecture Specification | Actual Deployment State | Provisioning Evidence | Status |
| :--- | :--- | :--- | :--- | :--- |
| **DNS** | Cloudflare DNS (`flood.kmitl.ac.th`) | Localhosts / Staging FQDN | Docker bridge network | `STAGED` |
| **TLS** | Cloudflare Edge SSL / Let's Encrypt | Self-signed / Reverse proxy TLS | `nginx/conf.d/tls.conf` | `STAGED` |
| **Load Balancer** | AWS ALB (Dual-AZ) | Docker Nginx Reverse Proxy | `infra/docker/nginx.conf` | `STAGED` |
| **API Service** | ECS Fargate (2-4 tasks autoscaling) | FastAPI Multi-worker Uvicorn (2 instances) | `apps/api/` Dockerfile | `STAGED` |
| **Frontend** | Cloudflare Pages / Next.js SSR Fargate | Next.js 14 Static Export + Node Server | `apps/web/` 15 routes | `STAGED` |
| **Database** | AWS RDS PostgreSQL 16 Multi-AZ + PostGIS 3.4 | Local Container PostgreSQL 16 + PostGIS | `postgis/postgis:16-3.4` | `STAGED` |
| **Cache & Realtime** | AWS ElastiCache Valkey / Redis 7.2 | Redis 7.2 Alpine Container | `redis:7.2-alpine` | `STAGED` |
| **Durable Queue** | AWS SQS FIFO / Standard + SQS DLQ | Tier 2 Redis + Tier 3 Spool WAL (`queue_spool.jsonl`) | [`apps/api/app/core/queue.py`](file:///Users/chalermsak/Desktop/KMITL%20Flood%20Intelligence/apps/api/app/core/queue.py) | `STAGED` |
| **Object Storage** | AWS S3 Bucket (Private, KMS encrypted) | Local disk spool with path sanitization | `apps/api/app/core/storage.py` | `STAGED` |
| **Worker Fleet** | ECS Fargate Celery / Background fleet | Async background workers & queue consumers | `apps/api/app/worker.py` | `STAGED` |
| **Monitoring** | CloudWatch Metrics + Prometheus/Grafana | In-memory latency tracker + `/api/v1/metrics` | `apps/api/app/api/v1/metrics.py` | `STAGED` |
| **Secrets** | AWS Secrets Manager / SSM Parameter Store | Environment variables + startup fast-fail validator | [`apps/api/app/core/config.py`](file:///Users/chalermsak/Desktop/KMITL%20Flood%20Intelligence/apps/api/app/core/config.py) | `STAGED` |

> **Audit Finding**: Cloud production infrastructure on AWS has not yet been provisioned with active billing. All components are containerized and verified in local multi-container staging topology. Marking truthfully as `PRODUCTION NOT DEPLOYED`.

---

## 2. Staging vs Production Separation Verification

To guarantee that staging activity cannot contaminate production data or vice versa:

1. **Database Isolation**:
   - `STAGING_DATABASE_URL`: `postgresql+asyncpg://kmitl_staging_user:...@staging-db/kmitl_flood_staging`
   - `PRODUCTION_DATABASE_URL`: Dedicated RDS endpoint in VPC private subnet.
   - Startup validator in [`app/core/config.py`](file:///Users/chalermsak/Desktop/KMITL%20Flood%20Intelligence/apps/api/app/core/config.py#L133-L162) asserts that `localhost` can never be specified when `ENVIRONMENT=production`.

2. **Queue Isolation**:
   - Staging queue: Dedicated local Redis DB / staging SQS queue URL.
   - Production queue: Dedicated AWS SQS queue URL (`kmitl-production-jobs.fifo`).
   - Startup validator asserts `SQS_QUEUE_URL` must be explicitly populated in production mode.

3. **Secrets Isolation**:
   - Staging secrets and production secrets use distinct KMS keys and secret paths.
   - Development default secrets (`dev_super_secret_jwt_key...`) immediately trigger `ValueError` on startup if `ENVIRONMENT=production`.

4. **Object Storage Isolation**:
   - Staging photos write to `kmitl-flood-staging-images`.
   - Production photos write to `kmitl-flood-production-images` with bucket-level private ACLs and server-side encryption.
