# Runbook: Traffy Fondue Integration Down
**Runbook ID:** `RB-EXT-TRAFFY-003`  
**Service:** `app/adapters/traffy.py`, `app/workers/traffy_worker.py`  
**Alert:** `AlertExternalSourceUnavailable: Traffy Fondue`  

---

### 1. Symptoms & Trigger
- CloudWatch Alert: `TraffyAdapter` API rate limit exceeded (HTTP 429) or token expiration (HTTP 401).
- External municipal flood complaint synchronization halts.

### 2. Operational Impact
- Third-party municipal tickets from Traffy Fondue are not ingested into the auxiliary corroboration stream.
- **First-party citizen reports (`/api/v1/reports`) are completely decoupled and unaffected.**

### 3. Diagnostic Steps
1. Verify Traffy Fondue open data API endpoint:
   ```bash
   curl -I "https://publicapi.traffy.in.th/share/teamchadchart/search?state_type=start&limit=10"
   ```
2. Review adapter logs for token validation or rate limit backoff timers.

### 4. Remediation Procedure
1. If rate-limited:
   - Adjust worker polling interval in `app/workers/traffy_worker.py` from 60s to 300s.
2. If OAuth2 access pending:
   - System remains in `PENDING_ACCESS` mode. Historical static sample remains active for baseline spatial testing.

### 5. Verification
- Verify `/api/v1/data-status` reflects correct status and latency.
