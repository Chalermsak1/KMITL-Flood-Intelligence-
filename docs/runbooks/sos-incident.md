# Runbook: High-Priority Emergency SOS Surge & Dispatch Protocol
**Runbook ID:** `RB-OPS-SOS-010`  
**Service:** Help & SOS Dispatch Module (`app/api/v1/help.py`), EOC Admin Portal  
**Alert:** `AlertCriticalSOSReceived` / `AlertUnassignedSOSTimeout` (> 10 minutes)  

---

### 1. Symptoms & Trigger
- Multiple `CRITICAL` priority SOS requests received within a 15-minute window (trapped vulnerable persons, rapidly rising water).
- CloudWatch Alarm: SOS requests in `OPEN` status with zero responder acknowledgment exceeding 10 minutes.

### 2. Operational Impact
- **Immediate Human Safety Risk:** Stranded residents require emergency evacuation or medical evacuation from submerged dwellings in Lat Krabang.

### 3. Diagnostic Steps
1. Open Admin EOC Emergency Triage Portal: `https://flood.kmitl.ac.th/admin`
2. Filter requests by `priority = "CRITICAL"` and `status = "OPEN"`.
3. Check responder duty rosters: verify how many mobile responders or civil defense boats are active in the field.

### 4. Operational Dispatch Procedure
1. **Triage & Classification:**
   - Verify phone contact and assess vulnerable persons count (elderly, infants, patients on oxygen/dialysis).
   - Update status from `OPEN` to `ACKNOWLEDGED`.
2. **Responder Assignment:**
   - Assign to nearest mobile unit (e.g. KMITL Civil Defense Boat Team #2 or Lat Krabang Foundation Rescue Unit).
   - Set status to `ASSIGNED` with operator notes.
   - **Privacy Rule:** Exact home coordinates and phone numbers are transmitted ONLY to authorized responder clients over TLS. Public event payloads broadcast only generalized district-level counts.
3. **Status Progression & Audit:**
   - When rescue unit arrives on site: update status to `IN_PROGRESS`.
   - Upon safe transfer to designated evacuation shelter (e.g. KMITL Auditorium): update status to `RESOLVED`.
   - All state transitions automatically record actor ID, previous status, new status, and timestamp in `audit_logs`.

### 5. Verification
- Verify zero unacknowledged `CRITICAL` SOS tickets remain older than 10 minutes.
- Check shelter capacity in `/shelters` to ensure receiving evacuation point has available beds.
