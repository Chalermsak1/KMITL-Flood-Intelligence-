# Runbook: BMA / DDS Canal Telemetry Feed Down
**Runbook ID:** `RB-EXT-BMA-002`  
**Service:** `app/adapters/bma.py`, `app/workers/bma_worker.py`  
**Alert:** `AlertExternalSourceUnavailable: BMA`  

---

### 1. Symptoms & Trigger
- CloudWatch Alert: `BMAAdapter` connection timeout or HTTP 5xx error.
- Canal telemetry stations in Lat Krabang (Prawet Burirom canal basin) exceed 45 minutes data age.

### 2. Operational Impact
- Prawet Burirom and Lam Pla Thio canal gauge levels become stale.
- **Critical Policy:** Canal water levels must never be extrapolated as road flood depths directly. The water level status shifts to `STALE` or `DEMO`.
- Emergency SOS, citizen reporting, and spatial clustering remain active.

### 3. Diagnostic Steps
1. Verify BMA DDS portal accessibility:
   ```bash
   curl -I https://dds.bangkok.go.th/
   ```
2. Check `app/workers/bma_worker.py` logs for parsing errors or schema shifts in upstream JSON payload.

### 4. Remediation Procedure
1. If token authentication failure:
   - Check if BMA developer token requires renewal.
   - If token is revoked or pending official municipal renewal, ensure the system stays in `PENDING_ACCESS` / `DEMO` fallback with explicit UI disclaimer.
2. If network partition:
   - Verify ECS egress NAT Gateway routing table.

### 5. Verification
- Call `/api/v1/water-stations` and confirm telemetry timestamps are within normal cadence.
