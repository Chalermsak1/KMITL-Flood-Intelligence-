# Privacy, Data Governance & User Safety Policy
## KMITL FLOOD INTELLIGENCE

---

## 1. Core Safety Principles

During floods and disasters, system users are often in vulnerable states. The platform is designed with **Privacy by Default**:
1. **Public Reports Never Expose Citizen Identity**:
   - Phone numbers, email addresses, IP addresses, and session tokens are strictly excluded from public responses.
   - Public maps visualize **incident cluster centroids** or fuzzed coordinates (~500m) rather than pinpointing an individual student or resident's exact doorstep.
2. **Emergency SOS Coordinate Restrictions**:
   - Exact latitude and longitude coordinates for SOS tickets are accessible **only to authorized emergency responders and EOC operators** with authenticated roles (`ADMIN` or `RESPONDER`).
   - Every lookup or access to an emergency ticket's private coordinates is recorded in `audit_logs` with the actor's ID and timestamp.
3. **EXIF Metadata Stripping**:
   - Photos uploaded by citizens are immediately sanitized via `PrivacyGuard.strip_exif(...)` before persistence, preventing inadvertent disclosure of device serial numbers or home geolocation tags.

---

## 2. Data Retention Schedule

| Data Category | Active Retention | Historical / Analytical | Expired / Deleted Policy |
| :--- | :--- | :--- | :--- |
| **Citizen Flood Reports** | 4 hours (Fresh window) | 30 days in database | Automatically marked `EXPIRED`; permanently archived or purged after 1 year. |
| **Emergency SOS Tickets** | Until `RESOLVED` / `CANCELLED` | 90 days for post-incident review | Stripped of PII after 90 days; retained only as anonymous summary statistics. |
| **Telemetry Observations (TMD/BMA)** | 7 days in active tables | Materialized hourly aggregates | Raw high-frequency records partitioned and archived to cold storage. |
| **Satellite SAR Polygons** | 30 days (Recent baseline) | Indefinite (Hydrological archive) | Stored as historical observational evidence for replay and machine learning. |
| **Audit Logs** | Indefinite (Minimum 2 years) | WORM storage (Write Once Read Many) | Cannot be deleted by standard application users or automated scripts. |

---

## 3. Role-Based Access Control (RBAC)

- **`PUBLIC` / `CITIZEN`**:
  - View situation summary, live map (incident centroids), candidate flood exposure routes, and submit new reports or SOS requests.
  - Zero access to other users' contact info or exact SOS coordinates.
- **`RESPONDER` (Field Volunteers / Campus Security)**:
  - View assigned SOS tickets with exact coordinates, contact numbers, and vulnerability notes.
  - Update ticket status (`IN_PROGRESS`, `RESOLVED`).
- **`ADMIN` (EOC Operator / University Administrator)**:
  - Triage and dispatch SOS requests, override AI image classifications, monitor data source health, trigger manual ingestion sync, and audit platform activities.
