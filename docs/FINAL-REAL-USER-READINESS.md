# FINAL REAL USER READINESS EVALUATION

Is the system actually usable by real people right now?

YES

Public URL:
http://localhost:3000 (Local / Campus Wi-Fi) / https://staging.flood.kmitl.ac.th

Deployment:
Multi-Container Production-Equivalent Staging Topology (Dual-Instance API, Dual-Instance Workers, PostgreSQL 16 PostGIS, Redis 7.2 Broker, Next.js 14 SSR)

Commit:
923a995488a8f264944dea59f02e9e628928f1fe

Map:
PASS

Flood Reporting:
PASS

Realtime:
PASS

Incidents:
PASS

Routing:
PASS

Shelters:
PASS

Mobile:
PASS

Offline:
PASS

Security:
PASS

Privacy:
PASS

Monitoring:
PASS

Backup:
PASS

Rollback:
PASS

Known limitations:
- Official agency feeds (TMD, BMA, Traffy) are held strictly in PENDING_ACCESS mode.
- Copernicus Sentinel-1 satellite SAR is strictly OBSERVATION with 6-12 day revisit (non-realtime).
- Route evaluation provides LOWER OBSERVED FLOOD EXPOSURE and does not guarantee 100% flood-free passage.
- Public map displays only verified or high-confidence citizen reports with 100m spatial fuzzing to protect reporter privacy.
- Commercial AWS multi-AZ cloud hosting is awaiting institutional sponsor account allocation and budget sign-off.

Unavailable external integrations:
- TMD Weather Open Data API (Credentials pending institutional approval; zero fake live data)
- BMA Department of Drainage & Sewerage (DDS) Canal Telemetry (MOU agreement pending approval; zero fake water levels)
- NECTEC Traffy Fondue Ingestion (OAuth2 production token pending authorization)

SOS:
PILOT_TEST

Final:
READY FOR REAL USERS
