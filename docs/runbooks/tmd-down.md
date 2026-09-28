# Runbook: TMD (Thai Meteorological Department) Feed Down
**Runbook ID:** `RB-EXT-TMD-001`  
**Service:** `app/adapters/tmd.py`, `app/workers/tmd_worker.py`  
**Alert:** `AlertExternalSourceUnavailable: TMD`  

---

### 1. Symptoms & Trigger
- CloudWatch Alert: `TMDAdapter` consecutive HTTP timeouts or non-200 responses (> 3 attempts).
- Ingestion telemetry flags `SRC_TMD_WEATHER` status as `UNAVAILABLE`.
- Data age for rainfall exceeds 60 minutes.

### 2. Operational Impact
- Real-time radar reflectivity and automated rain intensity data become stale.
- **Critical Policy:** The platform does NOT invent or interpolate fake live rainfall. The frontend rain banner will display `STALE` with elapsed observation time.
- Crowd reports, canal water levels, and routing remain 100% operational.

### 3. Diagnostic Steps
1. Test upstream connectivity from production worker container:
   ```bash
   curl -I https://data.tmd.go.th/api/WeatherToday/V2/?uid=api&ukey=...
   ```
2. Inspect worker logs:
   ```bash
   aws logs filter-log-events --log-group-name /ecs/kmitl-flood-workers-prod --filter-pattern "TMDAdapter"
   ```
3. Check TMD official developer status page or national news for planned maintenance.

### 4. Remediation Procedure
1. If TMD API key expired:
   - Obtain renewed credential from TMD Open Data portal.
   - Update AWS SSM Parameter Store:
     ```bash
     aws ssm put-parameter --name "/kmitl-flood/prod/tmd_api_key" --value "NEW_KEY" --type SecureString --overwrite
     ```
   - Restart worker service to pick up new parameter.
2. If TMD endpoint is suffering an upstream blackout:
   - The circuit breaker automatically switches to cached persistence observation.
   - In EOC dashboard, ensure data provenance shows `UNAVAILABLE`. Do not manually override with unverified external weather sites without architectural approval.

### 5. Verification
- Verify `/api/v1/data-status` shows `status: "LIVE"` once upstream recovers.
- Check that new rain observations appear in `/api/v1/rain/current`.
