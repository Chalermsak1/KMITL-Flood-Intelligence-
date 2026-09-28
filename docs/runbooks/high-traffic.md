# Runbook: Flash Flood Traffic Surge (10,000+ Concurrent Users)
**Runbook ID:** `RB-SRE-SCALE-008`  
**Service:** Cloudflare CDN, AWS ALB, ECS Fargate Fleet, PostgreSQL, Redis  
**Alert:** `AlertTrafficSpike5X` / `AlertALBHighLatency`  

---

### 1. Symptoms & Trigger
- Sudden tropical storm inundation causes a 10x to 20x spike in concurrent users (e.g. 500 VUs → 10,000 VUs).
- ALB request rate exceeds 2,500 requests per second.
- API CPU utilization exceeds 75%.

### 2. Operational Impact
- Potential slow map loading or dropped SSE connections if autoscaling lag occurs.
- Emergency SOS triage must remain responsive under all circumstances.

### 3. Diagnostic Steps
1. Review CloudWatch ALB metrics:
   - `RequestCountPerTarget`
   - `TargetResponseTime`
   - `HTTPCode_Target_5XX_Count`
2. Check ECS autoscaling triggers:
   ```bash
   aws application-autoscaling describe-scaling-activities --service-namespace ecs
   ```
3. Check PostgreSQL connection count and active transactions.

### 4. Remediation Procedure
1. **Immediate Manual Overprovisioning:**
   - Pre-scale API fleet to maximum capacity ahead of automated stepping:
     ```bash
     aws ecs update-service --cluster kmitl-flood-prod --service kmitl-flood-api-prod --desired-count 16
     ```
   - Pre-scale Web fleet:
     ```bash
     aws ecs update-service --cluster kmitl-flood-prod --service kmitl-flood-web-prod --desired-count 8
     ```
2. **Edge Cache Invalidation & TTL Tuning:**
   - In Cloudflare dashboard, ensure edge caching is active for all static bundles (`_next/static/*`, images, map style assets).
   - Enable Cloudflare "Tiered Cache" and "Argo Smart Routing".
3. **Shed Non-Critical Workloads:**
   - Throttle analytical background queries and historical replay workers.
   - Dedicate DB capacity exclusively to `/api/v1/help`, `/api/v1/reports`, and cached `/api/v1/incidents`.

### 5. Verification
- Validate latency in `/api/v1/metrics`: API p95 < 500ms, error rate < 0.5%.
- Confirm k6 load tests pass up to 10k VUs.
