# KMITL Flood Intelligence — Beta Operational Guide (Phase 26)

## 1. Operational Philosophy & Principles

The KMITL Flood Intelligence platform operates under the core directive:
> **Truth Over Appearance.** Under no circumstances may system interfaces display fabricated real-time counts, pretend external APIs are live when credentials are pending, or promise emergency response when no verified operator is on duty.

---

## 2. Operational Modes & Escalation Matrix

The system supports three system-wide operational states configured via `OPERATIONAL_MODE`:

| Level | Condition | Clustering Frequency | SSE Heartbeat | Required Operator Staffing |
|---|---|---|---|---|
| **NORMAL** | Routine weather, < 5 active reports/hr | Every 10 min | 30s | 1 On-Call Admin |
| **ELEVATED** | Heavy rain forecast, 5–25 reports/hr | Every 3 min | 15s | 2 EOC Operators Active |
| **EMERGENCY** | Flash flood in progress, > 25 reports/hr | Every 60s | 5s | Full EOC Staffed + 24/7 Dispatch Liaison |

---

## 3. SOS & Emergency Assistance Gateway Protocol

### Pilot Mode vs Operational Mode Separation

The SOS endpoint (`/api/v1/help`) is governed by a strict operational gate:

```python
SOS_OPERATIONAL_MODE = "PILOT_TEST"  # or "OPERATIONAL"
SOS_OPERATOR_DOCUMENTED = False      # Must be explicitly set to True with named operator
SOS_OPERATOR_CONTACT = ""            # Emergency desk direct extension
```

#### Protocol Requirements:
1. **When in `PILOT_TEST`**:
   - The API response **must** include the explicit warning:
     > *"This is a pilot test system. Submitting a help request does NOT guarantee immediate operator response. For life-threatening emergencies, call 191 (Police), 199 (Fire/Rescue), or 1669 (Medical Emergency)."*
   - The UI surfaces this warning prominently in amber/red alert banners before and after ticket creation.
2. **Transitioning to `OPERATIONAL`**:
   - Requires formal signoff by KMITL Emergency Operations Center (EOC).
   - A designated dispatcher on duty must be logged in to the admin panel with an open SSE ticket queue.
   - If no operator is logged in for > 15 minutes during `OPERATIONAL` mode, the system automatically falls back to emitting pilot safety warnings.

---

## 4. Shelter Truth Verification Protocol

### Zero-Tolerance on Fabricated Occupancy
- Real-world disaster survivors depend on shelter capacity data to make life-saving evacuation decisions.
- **Rule**: If a shelter does not have an active electronic headcount sensor or a physical volunteer with an authenticated EOC login logging numbers, the system displays:
  ```json
  "current_occupancy": 0,
  "occupancy_status": "OCCUPANCY_NOT_VERIFIED",
  "mode": "DEMO"
  ```
- Any hardcoded occupancy numbers (such as 45, 12, or random mock percentages) are strictly prohibited in production and beta seed data.
- EOC dispatchers can update shelter occupancy via authenticated PUT requests:
  ```http
  PATCH /api/v1/shelters/{id}/occupancy
  Authorization: Bearer <EOC_ADMIN_TOKEN>
  Content-Type: application/json
  
  {
    "current_occupancy": 78,
    "verified_by": "KMITL EOC Team Lead (Building 12)"
  }
  ```

---

## 5. Telemetry & Data Lineage Auditing

| Source | Status | Protocol | Display Mode |
|---|---|---|---|
| **First-Party Citizen Reports** | **LIVE** | User upload + pHash deduplication + DBSCAN | `LIVE` |
| **Sentinel-1 / OPERA Radar** | **OBSERVATION** | Copernicus Data Space Ecosystem API (12–24h lag) | `OBSERVATION` |
| **TMD Weather Telemetry** | **PENDING_ACCESS** | Calibrated weather simulation fallback | `DEMO` |
| **BMA Drainage Telemetry** | **PENDING_ACCESS** | Station baseline flood models | `DEMO` |
| **Traffy Fondue API** | **PENDING_ACCESS** | Official Open Data API key pending approval | `DEMO` |

Operators can check the live flag status at any time via:
```bash
curl -s http://localhost:8000/api/v1/beta/features | jq .data.flags
```

---

## 6. Incident Rollback & Kill-Switch Controls

In the event of network congestion, data corruption, or denial of service:
1. **Disable Public Reporting**:
   Set `FEATURE_FLAG_PUBLIC_REPORTS=False` in environment or admin panel. The UI will instantly display a maintenance alert and prevent new report submissions while preserving read access.
2. **Constrain Geofence to Campus Only**:
   Set `FEATURE_FLAG_BETA_LATKRABANG_ENABLED=False` to instantly restrict active processing exclusively to Zone A (KMITL).
3. **Low-Bandwidth Mode Activation**:
   Set `FEATURE_FLAG_LOW_BANDWIDTH_MODE=True` to strip heavy GeoJSON payloads, disable MapLibre 3D terrain, and serve pure text tabular tables for mobile users in flooded zones with degraded cellular connectivity.
