# KMITL Flood Intelligence — Beta Geofence Specification (Phase 26)

## 1. Overview & Operational Intent

The **Phase 26 Beta Geofence** establishes strict geographic boundaries for the expanded KMITL Flood Intelligence system. Its primary purpose is to **prevent false sense of security**: the platform only guarantees active clustering, prioritized incident verification, and calibrated routing inside verified zones. Outside these zones, data freshness and coverage are explicitly marked as limited.

---

## 2. Zone Definitions & Spatial Boundaries (WGS84 EPSG:4326)

| Zone | Identifier | Min Longitude | Min Latitude | Max Longitude | Max Latitude | Coverage Guarantee | Operational Status |
|---|---|---|---|---|---|---|---|
| **Zone A** | `ZONE_A_KMITL` | `100.7600` | `13.7150` | `100.7960` | `13.7450` | **FULL_BETA** (High confidence, active clustering) | **ACTIVE** |
| **Zone B** | `ZONE_B_LATKRABANG` | `100.7200` | `13.6900` | `100.8500` | `13.7700` | **LIMITED_BETA** (Corridor-based crowd density) | **ACTIVE** (Flag-gated) |
| **Outside** | `OUTSIDE_BETA` | `< 100.6500` or `> 100.9000` | `< 13.6500` or `> 13.8200` | — | — | **COVERAGE_LIMITED** | Warnings attached |

### Zone A: KMITL Campus & Perimeter
* **Scope**: Main KMITL campus (Faculty of Engineering, Science, IT, Architecture, Agro-Industry, Administration, Central Library), student dormitory clusters, Chalong Krung Road, and Luang Phaeng Road intersection.
* **Clustering Criteria**: $\varepsilon = 150\text{ m}$, $t = 45\text{ min}$, $\text{MinPts} = 2$.
* **Routing**: Full turn-by-turn routing with avoid-flooded-nodes graph search.

### Zone B: Lat Krabang Key Transport Corridors
* **Scope**: Lat Krabang Road connecting to Airport Rail Link Lat Krabang station, Romklao Road intersection, and King Kaew link.
* **Clustering Criteria**: $\varepsilon = 250\text{ m}$, $t = 60\text{ min}$, $\text{MinPts} = 3$.
* **Routing**: Advisory passability based on crowd reports.

---

## 3. Classification Algorithm & Deterministic Rules

The geofence classification runs synchronously in memory (< 0.1ms latency) via `classify_coverage(lat, lng)` in [`apps/api/app/services/geofence.py`](file:///Users/chalermsak/Desktop/KMITL%20Flood%20Intelligence/apps/api/app/services/geofence.py):

1. **Sanity Check**: Coordinates must be valid non-null floats within Thailand bounding box ($12.0 \le \text{lat} \le 21.0$, $97.0 \le \text{lng} \le 106.0$). If invalid $\to$ `UNKNOWN_LOCATION`.
2. **Zone A Priority Check**: If coordinates fall inside Zone A bounds $\to$ `IN_ZONE_A`. No warnings attached.
3. **Zone B Expansion Check**: If `FEATURE_FLAG_BETA_LATKRABANG_ENABLED=True` and coordinates fall inside Zone B bounds $\to$ `IN_ZONE_B`. No warnings attached.
4. **Fallback Default**: If outside both $\to$ `OUTSIDE_BETA`. A non-fatal warning is attached to `StandardResponse.warnings`.

---

## 4. API Endpoints

### Classification Query
```http
GET /api/v1/beta/coverage?latitude=13.7298&longitude=100.7782
```
Response:
```json
{
  "data": {
    "zone": "IN_ZONE_A",
    "is_within_beta": true,
    "warning": null,
    "zone_metadata": { ... }
  },
  "meta": {
    "source": "SRC_GEOFENCE_SERVICE",
    "mode": "LIVE"
  },
  "warnings": null
}
```

When querying an out-of-boundary coordinate (e.g., Siam, 13.7460, 100.5340):
```json
{
  "data": {
    "zone": "OUTSIDE_BETA",
    "is_within_beta": false,
    "warning": "Coverage is limited in this beta area. Data quality and incident clustering may be reduced outside the KMITL / Lat Krabang beta zone."
  },
  "warnings": [
    "Coverage is limited in this beta area. Data quality and incident clustering may be reduced outside the KMITL / Lat Krabang beta zone."
  ]
}
```

---

## 5. Security & Anti-Poisoning Enforcement

* Reports submitted outside beta zones are accepted into the database with `coverage_zone="OUTSIDE_BETA"` to avoid losing valuable citizen signals, but are **excluded** from high-priority incident generation unless confirmed by 5+ independent distinct reports.
* Geofence limits cannot be bypassed by client-side spoofing because bounds checks run server-side in Python before entering the spatial index.
