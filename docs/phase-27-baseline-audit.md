# KMITL Flood Intelligence — Phase 27 Baseline Audit

**Evaluation Date:** 2026-09-28  
**Audit Scope:** Full system review (Backend, Frontend, Adapters, Security, DB, Queue, Telemetry)  
**Baseline Release:** Release 26.0 Limited Beta  

---

## 1. CURRENT STATE

The platform has established a verified software baseline across 15 frontend routes (Next.js 14) and 63 passing automated backend tests (FastAPI, PostGIS, Redis, DBSCAN, SSE). Phase 26 introduced strict geofence boundary checks (Zone A KMITL and Zone B Lat Krabang), eliminated fabricated shelter numbers, and gated SOS behind pilot-test disclaimers.

However, moving from a **Controlled Limited Beta** to a **Public Production Beta** requires resolving critical operational, architectural, and data truth boundaries.

---

## 2. DATA SOURCE STATUS MATRIX

| Data Source | Current Codebase Status | Protocol / Mechanism | Verification Evidence | Production Classification |
|---|---|---|---|---|
| **First-Party Citizen Reports** | **LIVE** | User upload $\to$ EXIF strip $\to$ pHash check $\to$ PostGIS | Real HTTP multipart POST & WebSockets | **LIVE** |
| **Sentinel-1 SAR / OPERA DSWx** | **OBSERVATION** | Copernicus STAC API / Static Retention Footprint | 14h lag SAR footprint, ESA attribution | **OBSERVATION** (Never LIVE) |
| **TMD Weather Telemetry** | **PENDING_ACCESS** | Station model / calibrated simulation fallback | API keys not authenticated in prod | **PENDING_ACCESS / DEMO** |
| **BMA / DDS Canal Telemetry** | **PENDING_ACCESS** | Station model / calibrated simulation fallback | BMA Open Data API key pending approval | **PENDING_ACCESS / DEMO** |
| **Traffy Fondue API** | **PENDING_ACCESS** | Static sample fallback / mock provider | NECTEC OAuth2 live token pending | **PENDING_ACCESS / DEMO** |

---

## 3. KNOWN BLOCKERS FOR PUBLIC BETA

1. **Feature Flag Public Mutation Vulnerability (Resolved in Phase 27)**:
   - Feature flags in `/api/v1/beta/features` were previously exposed as GET-only but lacked explicit RBAC write-protection for operational overrides. An unauthenticated public user must never be able to toggle emergency mode, disable reporting, or claim live telemetry.
2. **Missing Granular Adapter Health Contract**:
   - Upstream adapters must adhere to the strict 6-method contract (`fetch`, `validate`, `normalize`, `store`, `publish`, `health_check`) and expose latency, error count, and last success/failure timestamps.
3. **Route Safety Language Non-Compliance**:
   - While routing avoided "100% Safe", candidate route labels lacked explicit metadata: `generated_at`, `data_cutoff`, `sources_used`, and `unknown_segments`.
4. **Shelter Verification Operator Workflow**:
   - Shelter occupancy was successfully zeroed out in Phase 26 (`current_occupancy=0`), but authenticated EOC operators lacked a verified `PATCH /shelters/{id}/occupancy` endpoint with immutable audit trail.
5. **Conflict Explainability in Data Fusion**:
   - DBSCAN clustered conflicting citizen reports (e.g., 10cm vs 60cm) into a single incident without exposing the divergence to end-users.

---

## 4. AUDIT BREAKDOWN BY PILLAR

### 4.1 Demo Data vs. Real Data
* **Real Data**: Direct crowd flood reports with photos, GPS coordinates, DBSCAN incident centroids, and real-time SSE event bus.
* **Demonstration / Calibrated Simulation Data**: TMD rain forecast stations, BMA canal water level sensors, and historical Traffy Fondue municipal tickets.
* **Truth Policy Enforced**: The UI banner unambiguously displays: *"DEMO MODE ACTIVE: Sensor & radar inputs use validated scenario models. User reports are LIVE."*

### 4.2 Security Gaps
* **Audit**: No hardcoded API keys or secrets detected in code or git history (confirmed via multi-pattern regex scan). `.env*` files are strictly gitignored except `.example` templates.
* **Identified Gap**: Production runtime must enforce that `SECRET_KEY` cannot use the development default string (`kmitl_super_secret_key...`) when `ENVIRONMENT == "production"`.

### 4.3 Operational Gaps
* **SOS Dispatch**: No 24/7 dedicated dispatch operator is currently assigned to the KMITL Flood Intelligence desk. Therefore, `SOS_OPERATIONAL_MODE` must remain strictly **`PILOT_TEST`**, with permanent disclaimers routing life-threatening emergencies to 191, 199, and 1669.

### 4.4 Performance Gaps
* In-memory DBSCAN clustering performs well under 100 concurrent reports (< 25ms), but requires rate limiting (max 10 submissions/min/IP) to prevent spatial indexing denial-of-service.
