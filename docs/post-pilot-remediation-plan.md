# POST-PILOT REMEDIATION PLAN
**KMITL FLOOD INTELLIGENCE — PHASE 25 ISSUE TRACKER**

- **Source:** `docs/kmitl-pilot-report.md` §7, `docs/post-pilot-audit.md` §7
- **Date:** 2026-09-28
- **Freeze Policy:** No new features. Only pilot-evidenced issues, reliability, performance, accessibility, data correctness.

---

## REMEDIATION ISSUE MATRIX

| # | Issue | Severity | Root Cause | Fix | Test | Status |
| :-: | :--- | :---: | :--- | :--- | :--- | :---: |
| **P1-01** | Satellite tile layer loads in 3.8s on <1Mbps 3G/Edge connections | **P1** | No lazy loading or low-bandwidth detection for raster satellite overlay. Full tile set requested regardless of connection quality. | Add low-bandwidth mode toggle. Defer satellite layer load behind manual "Load Satellite" button or bandwidth detection API. Add `IntersectionObserver`-triggered lazy load. | Manual 3G throttle in Chrome DevTools (Slow 3G profile). Verify tile requests deferred. | **IN PROGRESS** |
| **P1-02** | GPS jitter displaced 2 student markers 30–50m across road near ECC Building | **P1** | Report page shows `pos.coords.accuracy` value in `gpsStatus` text but does NOT display it as a visual accuracy badge. No warning when accuracy > 50m threshold. | Show GPS accuracy radius in meters as colored badge (Green < 20m, Yellow 20–50m, Red > 50m). Warn user when accuracy > 50m: *"GPS location uncertain — verify on map before submitting."* | GPS denied / granted / low-accuracy test in browser DevTools geolocation override. | **IN PROGRESS** |
| **P2-01** | Light-gray flood markers hard to see on outdoor sunlit phone screens | **P2** | Map flood polygon fill color is `rgba(255, 165, 0, 0.25)` — too transparent for direct sunlight. No high-contrast variant. | Add CSS high-contrast media query class. Add UI toggle "HIGH CONTRAST MODE" that increases map polygon opacity to 0.75 and uses bold borders (2px solid yellow / red). Emergency controls maintain 4.5:1 WCAG AA contrast at all times. | Chrome DevTools `prefers-contrast: more` emulation. Visual inspection at high brightness. | **IN PROGRESS** |
| **P2-02** | 2 users confused by "DEMO" tag on TMD data without understanding implications | **P2** | Data badge shows `DEMO` without tooltip or explanation. Users uncertain whether DEMO = no data or = low quality live data. | Add tooltip/popover on every data badge: `DEMO` → "Source not yet connected (registration pending). Historical reference data only." `OBSERVATION` → "Satellite image acquired X hours ago. Not real-time road water level." `LIVE` → "Data from citizen reports in real time." | Manual UI review on mobile. User can tap badge and read explanation. | **IN PROGRESS** |
| **P3-01** | SSE scale and load test claims were in-process simulations, not real TCP | **P3** | `run_sse_scale_test.py` and `run_load_test.py` use asyncio queues / ASGI transport. Not real OS sockets or TLS. | Clarify all documents: add `(In-process simulation, not real TCP)` disclaimer. Re-run load test against real `uvicorn` process on localhost. | Run `uvicorn` server + `httpx` against `http://localhost:8000`. Capture real p50/p95/p99. | **IN PROGRESS** |
| **P3-02** | Stale satellite data label does not display acquisition time in human-readable format | **P3** | API returns `acquisition_time` ISO string but frontend `/map` does not display "Acquired X hours ago" next to satellite badge. | Add `SatelliteAgeLabel` component to map overlay that shows: `OBSERVATION — Acquired 14h ago` | Verify in UI after build. Check for various age values (0h, 6h, 14h, 72h). | **IN PROGRESS** |
| **P3-03** | Route data freshness not displayed — no "ROUTE CONDITIONS CHANGED" warning | **P3** | Route evaluation returns at a point in time. If new flood reports arrive, user's route may be stale but no indication shown. | Add `routeAge` timestamp to route result. Display `ROUTE CONDITIONS MAY HAVE CHANGED` warning if route is > 10 minutes old and new incidents were reported in the route corridor. | Simulate new report after route generation. Verify warning appears. | **PLANNED** |
| **P3-04** | No pip audit / dependency vulnerability scan run | **P3** | `pip audit` was not executed in any prior phase. | Run `pip audit` against `.venv`. Document all findings. Upgrade vulnerable packages where fix available. | `pip audit` exit code 0 with no unresolved CVEs. | **IN PROGRESS** |

---

## IMPLEMENTATION PLAN (PRIORITY ORDER)

### Immediate (P1)
1. [P1-01] Low-Bandwidth Mode — satellite tile lazy loading
2. [P1-02] GPS accuracy badge and 50m threshold warning

### Short-term (P2)
3. [P2-01] High-contrast outdoor mode — CSS + map polygon opacity boost
4. [P2-02] Data badge tooltips explaining LIVE / DEMO / OBSERVATION / STALE

### Follow-up (P3)
5. [P3-01] Document simulation boundaries; re-run load test against real uvicorn process
6. [P3-02] Satellite acquisition age label on map overlay
7. [P3-03] Route staleness warning (> 10min + new incidents)
8. [P3-04] pip audit and dependency upgrade

---

## FREEZE BOUNDARY

The following are explicitly **NOT** being implemented in Phase 25:
- New data source integrations (pending credential access: TMD, BMA, Traffy)
- New AI/ML model training
- New UI pages or routes
- AWS infrastructure provisioning
- New SOS workflow changes beyond existing tested behavior
- New DBSCAN parameter tuning

Any request for items in the freeze list requires explicit Phase 26 authorization.
