# KMITL Flood Intelligence — Production Incident Response Plan (Phase 27)

## 1. Severity Classifications & SLAs

| Severity | Definition | Target Triage | Target Containment | Incident Commander |
|---|---|---|---|---|
| **SEV-1** (Critical) | Core platform down, database outage, data corruption, privacy leak, or false safety routing in flood. | < 5 min | < 15 min | Engineering Lead + Lead Architect |
| **SEV-2** (Major) | External adapter failure, Redis degradation, real-time SSE disconnected, single zone degraded. | < 15 min | < 45 min | Senior Backend / SRE On-Call |
| **SEV-3** (Minor) | Cosmetic UI issue, non-critical telemetry delay, single report photo failure. | < 2 hours | Next release | On-Duty Developer |

---

## 2. Incident Playbooks by Category

### Playbook A: PostgreSQL Database Outage (SEV-1)
1. **Detection**:
   `/api/v1/health` reports `"database": "DEGRADED"` or 503 HTTP status.
2. **Owner**: SRE On-Call.
3. **Containment**:
   Application automatically activates **Bounded Failure Graceful Fallback**:
   - `/reports` switches to read-only memory cache.
   - Public reporting emits `"Service temporarily unavailable. Please call KMITL Emergency: 02-329-8000."`
4. **Recovery**:
   - Inspect PostgreSQL container / RDS metrics (connection pool exhaustion, disk IOPS).
   - If unrecoverable corruption detected, execute automated snapshot restore:
     ```bash
     bash infra/backup/restore-db.sh /backups/kmitl_flood_latest.dump
     ```
5. **Postmortem**: Root-cause analysis documented within 24 hours.

---

### Playbook B: Redis & Realtime SSE Failure (SEV-2)
1. **Detection**:
   `/api/v1/realtime/sse` returns connection errors; workers unable to publish to Redis.
2. **Owner**: Backend Engineer.
3. **Containment**:
   Next.js frontend auto-detects SSE disconnect after 3 failed reconnects ($2^n$ exponential backoff) and seamlessly switches to HTTP short-polling every 15 seconds.
4. **Recovery**:
   - Restart Redis process or fail over to Redis replica.
   - Flush corrupted queues if unparseable payloads encountered.

---

### Playbook C: External Telemetry Source Outage or Desync (SEV-2)
1. **Detection**:
   Source telemetry reports `status == "UNAVAILABLE"` or data age exceeds freshness threshold.
2. **Owner**: Data Engineer.
3. **Containment**:
   The platform marks the source as `UNAVAILABLE` or `STALE` in `MetaEnvelope.freshness`.
   The UI automatically updates status badges to warn users.
4. **Rollback**:
   Disable failing provider via authenticated feature flag:
   ```bash
   curl -X POST http://localhost:8000/api/v1/beta/features \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"flag_name": "FEATURE_FLAG_TMD", "value": false, "reason": "TMD upstream API 500 error"}'
   ```

---

### Playbook D: User Privacy Incident (SEV-1)
1. **Detection**:
   Unmasked phone number, full name, or raw EXIF GPS detected in public response.
2. **Owner**: Security Lead.
3. **Containment**:
   - Immediately invoke the emergency kill-switch for public endpoints:
     ```bash
     curl -X POST http://localhost:8000/api/v1/beta/features \
       -H "Authorization: Bearer $ADMIN_TOKEN" \
       -d '{"flag_name": "FEATURE_FLAG_PUBLIC_REPORTS", "value": false, "reason": "Privacy containment"}'
     ```
   - Flush Redis cache and purge affected CDN/proxy caches.
4. **Remediation**:
   - Validate `PrivacyGuard.strip_exif()` and `PrivacyGuard.mask_sos_for_public()`.
   - Deploy patched Docker image.
   - Notify affected users in compliance with Thailand PDPA regulations.

---

### Playbook E: SOS Operational Failure (SEV-1)
1. **Detection**:
   SOS ticket created but no dispatcher is acknowledged, or operator desk goes offline for > 15 minutes.
2. **Owner**: EOC Operations Manager.
3. **Containment**:
   The system automatically downgrades `/help/status` mode from `OPERATIONAL` to `PILOT_TEST`, displaying prominent amber/red notices:
   *"No dispatcher actively monitored. Dial 191, 199, or 1669 immediately."*

---

## 3. Communication Escalation Hierarchy

1. **Incident Commander (IC)** opens incident Slack/LINE war room `#kmitl-flood-ops`.
2. **Public Communications Lead** posts official updates to KMITL official channels.
3. **Post-Mortem**: Required for all SEV-1 and SEV-2 within 48 hours, covering timeline, root cause, 5 whys, action items, and prevention measures.
