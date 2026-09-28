# KMITL CONTROLLED PILOT (STAGE 2) — SUCCESS CRITERIA & ACCEPTANCE GATES
**Document ID:** `docs/pilot-success-criteria.md`  
**Target Group:** 50–200 KMITL Students, Faculty, Campus Security & Facility Operators  
**Evaluation Model:** Staged Controlled Real-World Field Pilot  
**Date Established:** 2026-09-28 (Pre-Pilot Baseline)  

---

## 1. PURPOSE & GROUND RULES

Before launching the Stage 2 KMITL Controlled Pilot or evaluating any pilot results, numerical acceptance thresholds must be pre-defined and locked. 

- **No Post-Hoc Goalpost Moving:** Results must be measured against these strict thresholds.
- **Safety First:** The pilot exercises software functionality only. No user is permitted to enter flood water or hazardous zones.
- **Unknown First:** System correctness is judged by its ability to admit uncertainty (`UNKNOWN` / `INSUFFICIENT_TELEMETRY`), never by guessing "Safe" or "Dry" without corroborating telemetry.

---

## 2. NUMERIC ACCEPTANCE THRESHOLDS

| Metric | Target / Threshold | Evaluation Method | Failure Impact (No-Go Trigger) |
| :--- | :--- | :--- | :--- |
| **First-Party Report Success Rate** | $\ge 98.0\%$ | Total successfully stored citizen reports / Total submission attempts | Submission dropping $> 2\%$ blocks operational rollout |
| **Report Submission Latency ($p95$)** | $< 250\text{ ms}$ (Local/Staging API)<br>$< 800\text{ ms}$ (End-to-End on 4G/5G) | Timestamps $(T_1 - T_0)$ recorded in pilot telemetry | Mobile timeout causes user frustration or duplicated submissions |
| **Realtime SSE Event Fanout Latency ($p95$)** | $< 500\text{ ms}$ (Broadcast queue to socket)<br>$< 2,000\text{ ms}$ (End-to-End $T_5 - T_0$) | Broadcast push from citizen submit to observer device | Delayed hazard notification degrades evacuation effectiveness |
| **Map & Dashboard Availability** | $\ge 99.9\%$ during pilot window | HTTP synthetic health checks and client uptime monitoring | Map failure blinds field operators |
| **Public HTTP 5xx Error Rate** | $< 0.5\%$ | Total 5xx responses / Total public endpoint requests | Unhandled crashes undermine platform trust |
| **Public HTTP 429 Rate (Rate Limit)** | $< 1.0\%$ | Legitimate human user traffic throttled | Rate limits must protect against scrapers without punishing genuine pilot reporters |
| **SSE Reconnect & Stream Stability** | $\ge 99.0\%$ clean auto-reconnects | Client reconnect event metrics after intentional cell tower handoff / backgrounding | Silent stream death leaves user with stale map |
| **Offline Resilience (Local Queue)** | $100\%$ pending report retention | Offline submission test: queue preserved in browser `localStorage`, marked `PENDING`, submitted on reconnection | Data loss during subway or underground passage |
| **Zero Critical Security / Privacy Bugs** | **0 Allowed** | Automated SAST + DAST + EXIF audit + PII leak audit | GPS EXIF leak or PII leak on public map triggers **IMMEDIATE SHUTDOWN** |
| **Routing Truthfulness (No "SAFE" Claim)** | $100\%$ adherence | Review of all generated navigation routes | Route showing "SAFE" instead of "LOWER OBSERVED FLOOD EXPOSURE" fails audit |

---

## 3. USER TASK COMPLETION TARGETS (50–200 PARTICIPANTS)

Every participant executes the 10-step protocol:
1. Open website (`/`) and inspect Situational Banner.
2. Check Current Situation Summary (`/data` or `/map`).
3. Open Interactive Flood Map (`/map`) and locate user position via GPS.
4. Inspect data freshness badges (identify Live Citizen vs Observation vs Demo).
5. Submit a controlled observation report from a safe campus vantage point.
6. Verify report status changes from `SUBMITTED` $\to$ `CONFIRMED / CLUSTERED`.
7. Observe realtime update appearing on a peer participant's screen without page refresh.
8. Evaluate candidate walking route (`/route`) and inspect exposure warnings.
9. Review designated evacuation shelters (`/shelters`) and verify "Operator Log" disclaimer.
10. Test SOS assistance workflow strictly under **PILOT TEST MODE** (`/help`).

### Minimum Completion Threshold:
- At least **85%** of active participants complete all 10 tasks without fatal operator intervention.

---

## 4. GO / NO-GO CRITERIA AT PILOT EXIT

At the conclusion of the Stage 2 Pilot, a formal evaluation is held using the binary criteria below:

- [ ] **GO Criterion 1:** Zero P0/Critical security or privacy vulnerabilities found during live use.
- [ ] **GO Criterion 2:** First-party report submission success rate $\ge 98\%$.
- [ ] **GO Criterion 3:** Realtime notification delivery verified across iOS (Safari) and Android (Chrome).
- [ ] **GO Criterion 4:** Zero uncontrolled data loss across queue and database.
- [ ] **GO Criterion 5:** User feedback confirms situational status and data freshness badges are understood by $\ge 80\%$ of participants.
- [ ] **GO Criterion 6:** Emergency operations workflow tested successfully with authorized campus responders.
- [ ] **GO Criterion 7:** Cost of staging and infrastructure remained strictly bounded within allocated university budget.

If **ANY** critical criterion fails, the gate is marked **`NO-GO`** and the system enters **Phase 25 Post-Pilot Hardening**.
