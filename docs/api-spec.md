# API & WebSocket Specification (v1)
## KMITL FLOOD INTELLIGENCE

All REST endpoints follow a standardized response envelope containing `data` and `meta` (for provenance, timestamps, confidence, and freshness).

---

## 1. Response Envelope

```json
{
  "data": {},
  "meta": {
    "source": "KMITL_CORE_API",
    "observed_at": "2026-09-28T11:30:00+07:00",
    "ingested_at": "2026-09-28T11:30:15+07:00",
    "freshness": "FRESH",
    "confidence": "HIGH",
    "data_age_seconds": 15,
    "attribution": "KMITL Flood Intelligence Platform",
    "mode": "LIVE | DEMO"
  }
}
```

---

## 2. Core REST Endpoints

### 2.1 Health & Liveness
* **`GET /api/v1/health`**
  * Check overall service status.
  * Response: `{"status": "ok", "version": "1.0.0"}`
* **`GET /api/v1/ready`**
  * Verifies database connectivity (PostgreSQL/PostGIS) and Redis cache.
  * Response: `{"status": "ready", "database": "connected", "redis": "connected"}`

### 2.2 Situation Summary
* **`GET /api/v1/situation/summary`**
  * Returns the Hero dashboard status for the KMITL / Lat Krabang area.
  * Response data:
    * `current_status`: `"HIGH" | "MODERATE" | "LOW" | "CRITICAL" | "UNKNOWN"`
    * `rain_trend`: `"HEAVY" | "MODERATE" | "LIGHT" | "NONE"`
    * `water_trend`: `"RISING" | "STABLE" | "FALLING"`
    * `active_incidents`: `8`
    * `active_help_requests`: `3`
    * `data_quality`: `"HIGH" | "MEDIUM" | "LOW"`
    * `last_updated`: `"2026-09-28T11:32:00+07:00"`

### 2.3 User Flood Reports
* **`GET /api/v1/reports`**
  * Query parameters:
    * `bbox` (string, optional): `"minLng,minLat,maxLng,maxLat"`
    * `freshness` (string, optional): `"FRESH,RECENT"`
  * Returns: List of GeoJSON Feature items representing anonymized user reports.
* **`POST /api/v1/reports`**
  * Body (JSON / Multipart):
    * `latitude`: float (e.g. `13.7298`)
    * `longitude`: float (e.g. `100.7782`)
    * `water_depth_band`: `"BELOW_10CM" | "10_TO_20CM" | "20_TO_40CM" | "40_TO_60CM" | "ABOVE_60CM" | "UNKNOWN"`
    * `vehicle_passability`: `"PASSABLE" | "DIFFICULT" | "NOT_PASSABLE" | "UNKNOWN"`
    * `transport_type`: `"WALK" | "MOTORCYCLE" | "CAR" | "TRUCK"`
    * `description`: string (optional)
    * `photo_url`: string (optional)
  * Returns: 201 Created with generated `report_id`.

### 2.4 Clustered Flood Incidents
* **`GET /api/v1/incidents`**
  * Query parameters:
    * `bbox` (string, optional)
    * `status` (string, default: `"ACTIVE"`)
  * Returns: FeatureCollection of aggregated incidents computed via Spatio-Temporal DBSCAN.

### 2.5 Water Stations & Canal Telemetry
* **`GET /api/v1/water-stations`**
  * Returns list of canal gauges with current water level (m MSL), 10m/30m/60m delta, trend, and warning stage.
* **`GET /api/v1/water-stations/{id}/observations`**
  * Returns time series observations for chart rendering.

### 2.6 Rain / Weather Observations
* **`GET /api/v1/rain/current`**
  * Returns current rain intensity cells and last radar update timestamp.

### 2.7 Observational Satellite Inundation
* **`GET /api/v1/satellite/latest`**
  * Returns latest available SAR water classification polygons with acquisition timestamp and disclaimer.

### 2.8 Emergency Assistance (Help Requests / SOS)
* **`POST /api/v1/help`**
  * Request emergency aid.
  * Body:
    * `requester_name`: string
    * `contact_phone`: string
    * `latitude`: float
    * `longitude`: float
    * `help_type`: `"TRAPPED" | "EVACUATION" | "FOOD_WATER" | "MEDICINE" | "VULNERABLE_PERSON" | "OTHER"`
    * `people_count`: int
    * `current_water_level`: string
    * `description`: string
  * Returns: 201 Created with `ticket_number`.
* **`GET /api/v1/help`**
  * For emergency operations / triage dashboard (authenticated / role-protected).

### 2.9 Shelters & Assistance Points
* **`GET /api/v1/shelters`**
  * Returns evacuation shelters, medical posts, and supply stations.

### 2.10 Data Source Status & Observability Registry
* **`GET /api/v1/data-status`**
  * Returns live health, mode (`LIVE`, `OBSERVATION`, `DEMO`, `STALE`, `UNAVAILABLE`), data age, and latency across TMD, BMA, Traffy, and Satellite adapters.

### 2.11 Flood-Aware Routing (Decision Support)
* **`POST /api/v1/routes/evaluate`**
  * Body: `{"origin": {"lat": 13.7298, "lng": 100.7782}, "destination": {"lat": 13.7180, "lng": 100.7850}, "mode": "CAR"}`
  * Returns: 2–3 candidate corridors ranked with label `"LOWER OBSERVED FLOOD EXPOSURE"`, distance, estimated time, and segment risk breakdown.

### 2.12 Historical Event Replay
* **`GET /api/v1/replay/events`**
  * Lists archived flood scenarios with `mode="DEMO"`.
* **`GET /api/v1/replay/events/{id}/timeline`**
  * Returns chronological slices for the interactive timeline slider.

### 2.13 AI Computer Vision & Human Verification
* **`POST /api/v1/reports/verify-image`**
  * Validates magic bytes, tests blur/luminance, computes 64-bit dHash, and returns flood detection & depth band estimate.
* **`POST /api/v1/admin/reports/{id}/override`**
  * Operator override (`AI_CONFIRMED`, `ADMIN_VERIFIED`, `REJECTED`) with immutable audit logging.

### 2.14 Emergency SOS Triage Dispatch
* **`PATCH /api/v1/admin/help/{id}/triage`**
  * Transition emergency ticket status (`OPEN` -> `ACKNOWLEDGED` -> `ASSIGNED` -> `IN_PROGRESS` -> `RESOLVED` -> `CANCELLED`) with audit trail.

### 2.15 Telemetry & Metrics
* **`GET /api/v1/metrics`**
  * Operational Prometheus/CloudWatch telemetry: API latency, active reports, active incidents, queue backlog.
* **`GET /api/v1/ready`**
  * Deep readiness probe verifying live connection to PostgreSQL and Redis.

---

## 3. Real-Time Streaming Channels

### 3.1 Public One-Way Server-Sent Events (SSE)
* **URL:** `GET /api/v1/realtime/events`
* **Query Parameters:**
  * `bbox` (optional): Viewport bounding box (`minLng,minLat,maxLng,maxLat`)
* **Event Format:** Standardized SSE text/event-stream with event deduplication ID.

### 3.2 Operator Bidirectional WebSocket (`/ws/live`)
* **URL:** `ws://<host>/ws/live`
* Dedicated to Admin, EOC operators, and emergency responders for interactive dispatch.
