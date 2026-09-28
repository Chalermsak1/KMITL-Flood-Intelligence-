# KMITL FLOOD INTELLIGENCE
### Real-Time Flood Situational Awareness & Assistance Platform (Software-Only 100%)

> *"KMITL Flood Intelligence is a software-only geospatial disaster intelligence platform designed to combine public environmental data, satellite observations, crowdsourced reports, geospatial analysis, and real-time event processing to support flood situational awareness and emergency assistance around KMITL and Lat Krabang."*

> ⚠️ **IMPORTANT NOTICE & DISCLAIMER:**  
> This is an informational and decision-support prototype. It does **not** guarantee road safety, exact flood depth accuracy, emergency response time, or meteorological prediction accuracy. In case of life-threatening emergencies, always follow instructions from the KMITL Safety Center and local civil defense authorities.

---

## 1. System Concept & Core Differentiator

**KMITL Flood Intelligence** is not just another flood map. It is an end-to-end Geospatial Disaster Intelligence Platform that executes **Multi-Source Data Fusion**:

$$\text{Flood Intelligence} = \text{Data Fusion} + \text{Real-Time Signals} + \text{Geospatial Context} + \text{Human Reports} + \text{AI Assistance}$$

### Separation of Data Truth
The platform strictly distinguishes between different temporal data classes:
* **REAL-TIME (Seconds - Minutes):** Native First-Party Crowdsourced User Reports, WebSocket delta updates.
* **HIGH-FREQUENCY OBSERVATIONS (10–30 Minutes):** BMA DDS Canal Water Level Telemetry, TMD Weather Station & Radar Intensity.
* **OBSERVATIONAL EVIDENCE LAYER (6–12 Days Revisit):** Copernicus Sentinel-1 SAR & NASA OPERA DSWx-S1 Satellite Inundation polygons.
* **STATIC BASELINE:** OpenStreetMap road topology, Digital Elevation Models (DEM).

---

## 2. Platform Architecture

```
[ External APIs / Open Data ]       [ Crowdsourced Signal ]
 (TMD, BMA, Traffy, Copernicus)      (User Reports via Browser GPS)
              │                                      │
              ▼                                      ▼
       Ingestion Worker                  Validation & Quality Filter
     (BaseAdapter Interface)              (Magic Bytes, pHash, Blur)
              │                                      │
              └───────────────┬──────────────────────┘
                              ▼
               Spatial & Temporal Alignment
             (PostGIS EPSG:4326 / EPSG:3857)
                              ▼
            Incident Aggregation & Clustering
             (Spatio-Temporal DBSCAN Engine)
                              ▼
                 Explainable Risk Engine
     (Multi-factor: Rain + Water + Crowd + Sat + DEM)
                              ▼
               Event Bus (Redis Pub/Sub)
                              ▼
          Real-Time Delivery (WebSocket / SSE)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Responsive UI                    │
│  - GPU-accelerated Vector Map (MapLibre GL JS)              │
│  - Live Situation Hero Banner (Freshness & Confidence)       │
│  - Fast Crowdsourced Report & SOS Dispatch                  │
│  - Flood-Exposure-Aware Route Evaluation                     │
│  - Historical Timeline Event Replay (Demo / Audit)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

* **Frontend:** Next.js 14+ (App Router, TypeScript), MapLibre GL JS (WebGL GPU-accelerated vector map), Tailwind CSS, Lucide Icons.
* **Backend:** Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (asyncpg), GeoAlchemy2, Shapely, scikit-learn (DBSCAN).
* **Spatial Database:** PostgreSQL 16 + PostGIS 3.4.
* **Cache & Real-Time Broker:** Redis 7.2 (Pub/Sub on `flood:events`).
* **Containerization:** Docker & Docker Compose.

---

## 4. Current Integration & Verification Status

Detailed technical verification of each external source is documented in [`docs/data-sources.md`](docs/data-sources.md):

| Source Identifier | Source Name | Data Class | Status | Implementation Mode |
| :--- | :--- | :--- | :--- | :--- |
| `SRC_TMD_WEATHER` | Thai Meteorological Department | High-Frequency Weather | **PENDING_ACCESS** | `TMDAdapter` + `TMDMockProvider (mode: DEMO)` |
| `SRC_BMA_DDS` | BMA Dept of Drainage & Sewerage | Canal Gauge Telemetry | **PENDING_ACCESS** | `BMAAdapter` + `BMAMockProvider (mode: DEMO)` |
| `SRC_TRAFFY_FONDUE` | Traffy Fondue Platform | Crowdsourced Tickets | **MOCK_ONLY** | `TraffyAdapter` + `TraffyMockProvider (mode: DEMO)` |
| `SRC_COPERNICUS_S1` | Copernicus Sentinel-1 SAR | Observational Evidence | **VERIFIED** | STAC API + `SatelliteMockProvider (mode: DEMO)` |
| `SRC_USER_REPORT` | KMITL Community Reports | Real-Time | **VERIFIED** | First-Party Native Ingestion |

---

## 5. Quick Start (Running Locally with Docker)

### Prerequisites
* Docker Engine (>= 24.0) & Docker Compose (>= 2.20)
* Git

### Step 1: Clone and Configure Environment
```bash
git clone https://github.com/your-org/kmitl-flood-intelligence.git
cd kmitl-flood-intelligence
cp .env.example .env
```

### Step 2: Start Services via Docker Compose
```bash
docker compose up -d
```
This boots up 4 containers:
1. `kmitl_flood_db` (PostgreSQL 16 + PostGIS on port 5432)
2. `kmitl_flood_redis` (Redis 7.2 on port 6379)
3. `kmitl_flood_api` (FastAPI REST & WebSocket on port 8000)
4. `kmitl_flood_web` (Next.js Application on port 3000)

### Step 3: Run Database Migrations & Seed Baseline Data
```bash
make migrate
make seed
```

### Step 4: Open Application in Browser
* **Web Application:** [http://localhost:3000](http://localhost:3000)
* **Interactive Live Map:** [http://localhost:3000/map](http://localhost:3000/map)
* **Report Flood Incident:** [http://localhost:3000/report](http://localhost:3000/report)
* **Emergency SOS Dispatch:** [http://localhost:3000/help](http://localhost:3000/help)
* **Operations Dashboard (EOC):** [http://localhost:3000/admin](http://localhost:3000/admin)
* **Interactive OpenAPI Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 6. Running Tests

```bash
# Run backend pytest suite (unit + integration tests)
make test
```

---

## 7. Known Limitations & Phase 2 Roadmap

* **Satellite Revisit Lag:** Sentinel-1 satellite passes over Lat Krabang every 6–12 days. It serves as observational evidence, not minute-by-minute real-time data.
* **Canal Stage vs. Street Water:** High water in canals diminishes drainage capacity, but does not directly equate to immediate road ponding depth.
* **Phase 2 Implementation:**
  * Computer Vision Quality & Depth Filter on user photos.
  * Historical Flood Event Replay timeline scrubber.
  * Flood-exposure-aware routing calculating lowest risk paths.
