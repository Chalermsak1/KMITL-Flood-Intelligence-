# KMITL FLOOD INTELLIGENCE — INCIDENT RESPONSE PLAN
**Document ID:** `SRE-IRP-2026-V1`  
**Classification:** Operational / Disaster Readiness  
**Target Basin:** KMITL, Lat Krabang, Bangkok Eastern Drain Basin  
**Effective Date:** 2026-09-28  

---

## 1. Purpose & Guiding Philosophy

The KMITL Flood Intelligence platform provides real-time situational awareness, flood routing, and emergency assistance (SOS) during tropical storms and localized inundation events. In the event of system degradation or disaster load, our operational priorities are strictly:

1. **Human Safety & SOS Intake Preservation:** Citizen distress signals must never be dropped.
2. **Data Integrity & Truthfulness:** Stale or failing feeds must be flagged as `UNAVAILABLE` or `STALE`; we never mask missing data with synthetic optimism.
3. **Stateless Graceful Degradation:** Core public map reads and crowdsourced report submissions must function even if AI vision, radar feeds, or satellite ingestion stall.

---

## 2. Severity Classification Matrix

| Severity Level | Response SLA | Paging Escalation | Criteria |
| :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | **< 5 minutes** | Lead SRE + DevOps Lead + Incident Commander | • Public SOS intake (`/api/v1/help`) unavailable.<br>• Core database cluster outage.<br>• Public map total failure during active monsoon flood warning. |
| **SEV-2 (Major)** | **< 15 minutes** | Primary On-Call Backend Engineer | • External queue backlog exceeding 5,000 jobs.<br>• Redis failure causing fallback to cold database reads.<br>• Public read latency p95 > 2,500ms.<br>• Real-time SSE stream disconnection rate > 30%. |
| **SEV-3 (Moderate)** | **< 1 hour** | Data Engineer + Adapter Maintainer | • External upstream outage (TMD, BMA, or Copernicus STAC down).<br>• Asynchronous AI image verification failure (reports persist without AI badge).<br>• Moderate API error rate (1% to 5%). |
| **SEV-4 (Minor)** | **< 4 hours** | SRE Team / Next Business Day | • Isolated cosmetic frontend glitch.<br>• Minor batch ingest latency within non-critical thresholds.<br>• Single non-vital background worker restart. |

---

## 3. Incident Commander & Operational Roles

During active incidents:
- **Incident Commander (IC):** Directs triage, authorizes emergency scaling policies, and signs off on public emergency banners.
- **Operations Lead (Ops):** Executes cloud infrastructure interventions (RDS failover, ECS task count scaling, Redis flush/restart).
- **Communications Lead (Comms):** Updates emergency response officials, KMITL Administration, and district EOCs.

---

## 4. Standard Incident Response Protocols

### Scenario 1: API Outage (FastAPI Fleet Down)
1. **Diagnosis:** ALB returns `502 Bad Gateway` or `503 Service Unavailable`.
2. **Immediate Mitigation:**
   - Check ECS service health: `aws ecs describe-services --cluster kmitl-flood-prod --services kmitl-flood-api-prod`.
   - If tasks exited due to OOM or unhandled exception, inspect CloudWatch logs: `/ecs/kmitl-flood-api-prod`.
   - Scale desired task count by +100%: `aws ecs update-service --cluster kmitl-flood-prod --service kmitl-flood-api-prod --desired-count 8`.
   - Verify container readiness check: `/api/v1/ready`.

### Scenario 2: PostgreSQL / PostGIS Database Outage
1. **Diagnosis:** API logs emit `OperationalError: connection to server lost` or `/api/v1/ready` returns `503`.
2. **Immediate Mitigation:**
   - Check AWS RDS Multi-AZ status: verify if automatic failover is in progress.
   - If RDS connection pool exhausted (CPU 100% or Max Connections reached):
     - Force immediate connection shedding by restarting saturated API worker tasks.
     - Verify PgBouncer connection limits.
   - If unrecoverable corruption occurs, initiate Point-in-Time Recovery (PITR) to a fresh instance and redirect DNS/SSM parameter.

### Scenario 3: External Source Outage (TMD, BMA, Traffy, Copernicus)
1. **Diagnosis:** `DataSourceHealthService` flags provider as `UNAVAILABLE` or data age exceeds freshness threshold.
2. **Immediate Mitigation:**
   - **Do NOT fabricate data.**
   - System automatically sets mode to `UNAVAILABLE` or `STALE`.
   - Ensure the circuit breaker prevents worker threads from blocking downstream queues.
   - Notify operators in EOC dashboard (`/admin`).

### Scenario 4: Security Incident / Denial-of-Service / Abuse Spike
1. **Diagnosis:** WAF triggers rate-limit anomalies; sudden flood of bogus SOS tickets or fake GPS coordinates.
2. **Immediate Mitigation:**
   - Activate Cloudflare "Under Attack" mode or tighten AWS WAF rate limit rules to 60 req/min per IP.
   - Enable IP-level reputation blocklists in WAF.
   - Review `/admin/audit` for compromised administrative credentials.
   - Flag bulk spam submissions as `FALSE_REPORT` in the database.

### Scenario 5: Disaster Flood Event Traffic Spike (10x Traffic)
1. **Diagnosis:** Monsoon cloudburst causes sudden surge from 500 VUs to 10,000+ simultaneous citizens.
2. **Immediate Mitigation:**
   - ECS Auto Scaling automatically triggers at 70% CPU; verify target tracking policy.
   - Increase API task count manually if scale-out lag is detected: `aws ecs update-service --desired-count 16`.
   - Enable Cloudflare edge caching for read-only GeoJSON layers (`Cache-Control: public, max-age=15`).
   - Prioritize worker queues: Throttle `AI_VERIFY` and `SATELLITE_PROCESS` to dedicate worker resources to `REPORT_CLUSTER` and `SOS_DISPATCH`.

---

## 5. Post-Incident Review (PIR)

Within 24 hours of resolving any SEV-1 or SEV-2 incident:
1. Conduct a blameless post-mortem meeting.
2. Document root cause, timeline of events, time to detection (TTD), and time to resolution (TTR).
3. Publish findings to `docs/postmortems/YYYY-MM-DD-incident-name.md`.
4. Create tracked tickets for preventive architectural improvements.
