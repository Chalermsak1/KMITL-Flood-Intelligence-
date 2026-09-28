# KMITL FLOOD INTELLIGENCE — OPERATIONAL ROLLBACK PLAN

> **DOCUMENT ID:** `SRE-ROLLBACK-2026.09`  
> **CLASSIFICATION:** Production Operations & Incident Response Standard  
> **APPLICABILITY:** Staging Pilot, Beta Environments, and Production AWS Deployment  
> **LAST VERIFIED DRILL:** `2026-09-28T13:10:00+07:00`

---

## 1. Overview & Rollback Triggers

This document specifies the exact, step-by-step procedures to revert application versions, database migrations, worker containers, or individual failing subsystems without incurring data loss or prolonged user outage.

### Immediate Rollback Triggers:
1. **Critical Health Failure:** Unhandled 5xx error rate exceeds $1.0\%$ for $> 3\text{ minutes}$.
2. **Data Ingestion Hang:** Report intake or emergency SOS submission hangs ($p95 > 2,000\text{ ms}$).
3. **Database Lock Contention:** Active PostgreSQL connection pool exhausted or deadlocks detected.
4. **Data Corruption:** Erroneous calculation in incident clustering or risk scoring producing false panics.
5. **Security Breach:** Unauthenticated access or PII leakage detected on public endpoints.

---

## 2. Fast Feature & External Source Disable (Zero-Downtime Hot Toggles)

If an issue is isolated to a specific third-party integration or optional feature, operators can instantly disable the offending subsystem via environment variables without full rollback:

| Target Subsystem | Environment Variable | Hot-Toggle Effect |
| :--- | :--- | :--- |
| **TMD Weather Radar** | `FEATURE_FLAG_TMD=false` | Disables weather polling; preserves last cached radar frame; defaults to UNKNOWN. |
| **BMA Canal Telemetry** | `FEATURE_FLAG_BMA=false` | Disables canal polling; returns PENDING_ACCESS without crashing. |
| **Traffy Fondue Tickets** | `FEATURE_FLAG_TRAFFY=false` | Disables municipal ticket ingestion. |
| **Copernicus Sentinel-1** | `FEATURE_FLAG_SATELLITE=false` | Disables satellite layer ingestion. |
| **AI Image Verification** | `FEATURE_FLAG_AI_VERIFICATION=false` | Bypasses visual inference; marks uploaded images as `UNCHECKED_IMAGE` for manual responder review. Reports persist immediately. |
| **Routing Engine** | `FEATURE_FLAG_ROUTING=false` | Hides route evaluation tabs; redirects citizens to main live situation map. |
| **Realtime SSE Streams** | `FEATURE_FLAG_REALTIME=false` | Directs frontend to use standard polling fallback (30s interval) to relieve connection strain. |

### Emergency Mode Activation:
To protect critical SOS dispatch and core reporting during severe infrastructure strain:
```bash
# Sets OPERATIONAL_MODE=EMERGENCY
# Automatically prioritizes SOS and reporting, drops heavy analytics and replay jobs
curl -X POST http://localhost:8000/api/v1/system/emergency-mode \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "EMERGENCY", "reason": "Severe convective storm - protecting SOS intake"}'
```

---

## 3. Application Rollback (ECS / Docker / Next.js)

### 3.1 Backend API Task Rollback (FastAPI)
```bash
# AWS ECS Deployment Rollback to Previous Task Definition Revision
aws ecs update-service \
  --cluster kmitl-flood-prod-cluster \
  --service kmitl-flood-api-service \
  --task-definition kmitl-flood-api:PREVIOUS_REVISION_NUMBER \
  --force-new-deployment

# Local / Staging Docker Rollback
docker stop kmitl-flood-api-current
docker run -d --name kmitl-flood-api-rollback --restart always \
  -p 8000:8000 \
  --env-file .env.previous \
  ghcr.io/kmitl-flood/api:stable-release
```

### 3.2 Frontend Web Rollback (Next.js)
```bash
# AWS ECS Web Service Rollback
aws ecs update-service \
  --cluster kmitl-flood-prod-cluster \
  --service kmitl-flood-web-service \
  --task-definition kmitl-flood-web:PREVIOUS_REVISION_NUMBER \
  --force-new-deployment

# Local / Staging Web Rollback
docker stop kmitl-flood-web-current
docker run -d --name kmitl-flood-web-rollback --restart always \
  -p 3000:3000 \
  ghcr.io/kmitl-flood/web:stable-release
```

---

## 4. Background Worker Fleet Rollback

Background workers consume jobs asynchronously from the durable Redis/SQS queue. Rolling back worker tasks does not interrupt report ingestion:
```bash
# 1. Gracefully pause worker task processing
aws ecs update-service \
  --cluster kmitl-flood-prod-cluster \
  --service kmitl-flood-workers-service \
  --desired-count 0

# 2. Inspect queue backlog and dead-letter queue (DLQ)
python3 -c "
import asyncio, redis.asyncio as aioredis
async def check():
    r = aioredis.from_url('redis://localhost:6379/0')
    print('Queue depth:', await r.llen('kmitl:queue:jobs'))
    print('DLQ depth:', await r.llen('kmitl:queue:dlq'))
asyncio.run(check())
"

# 3. Roll back worker task definition to previous revision and restore desired count
aws ecs update-service \
  --cluster kmitl-flood-prod-cluster \
  --service kmitl-flood-workers-service \
  --task-definition kmitl-flood-worker:PREVIOUS_REVISION_NUMBER \
  --desired-count 2
```

---

## 5. Database Migration Rollback (Alembic & PostgreSQL)

> [!CAUTION]
> Never roll back migrations that drop columns containing live citizen reports or SOS rescue requests without first creating an instantaneous snapshot!

### Step 1: Pre-Rollback Snapshot
```bash
# Run backup dump prior to any schema downgrade
bash infra/backup/backup-db.sh
```

### Step 2: Alembic Downgrade
```bash
# Step back 1 migration revision
cd apps/api
.venv/bin/alembic downgrade -1

# Verify schema state and PostGIS extension
psql -U kmitl_flood_user -d kmitl_flood_db -c "SELECT version();"
psql -U kmitl_flood_user -d kmitl_flood_db -c "\dt"
```

### Step 3: Fast Point-In-Time Restoration (If Schema Rollback Fails)
If schema rollback corrupts relational integrity, execute PITR restore:
```bash
# Restore from verified snapshot
bash infra/backup/restore-db.sh /tmp/kmitl_flood_backup_latest.sql.gz
```
*(Verified RTO: 2 minutes 15 seconds; RPO: $< 5\text{ minutes}$)*.

---

## 6. Configuration Rollback

If erroneous environment variables were injected:
1. Revert `.env` or AWS SSM Parameter Store parameters:
   ```bash
   aws ssm put-parameter --name "/kmitl-flood/prod/DATABASE_URL" --value "$PREVIOUS_SECURE_VAL" --type SecureString --overwrite
   ```
2. Trigger rolling restart of API tasks:
   ```bash
   aws ecs update-service --cluster kmitl-flood-prod-cluster --service kmitl-flood-api-service --force-new-deployment
   ```

---

## 7. Post-Rollback Verification Checklist

Following any rollback execution, the Lead Operator must verify:
- [ ] `GET /health` returns HTTP 200 `status: "healthy"`
- [ ] `GET /ready` returns HTTP 200 `database: "healthy"`, `redis: "healthy"`
- [ ] `GET /data-status` displays accurate status badges (`PENDING_ACCESS`, `LIVE`, `OBSERVATION`)
- [ ] `POST /api/v1/reports` successfully commits a test citizen report
- [ ] `POST /api/v1/help` successfully receives an emergency request with encrypted PII
- [ ] Frontend maps load without white screens or JavaScript console errors
- [ ] CloudWatch / Prometheus 5xx error rate returns to $0.00\%$
- [ ] Incident commander updates status page and logs action in `audit_logs`
