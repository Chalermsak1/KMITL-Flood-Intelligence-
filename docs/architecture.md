# System Architecture & Technical Design
## KMITL FLOOD INTELLIGENCE

เอกสารนี้อธิบายสถาปัตยกรรมระบบโดยละเอียดของ **KMITL Flood Intelligence Platform** ตามหลักการ C4 Model และ Event-Driven Geospatial Architecture.

---

## 1. System Context Diagram (C4 Level 1)

```mermaid
graph TD
    User["Citizen / Student / Staff<br/>(Mobile & Web Browser)"]
    Admin["EOC Operator / Volunteer<br/>(Admin Dashboard)"]
    
    System["<b>KMITL Flood Intelligence Platform</b><br/>(Real-Time Flood Situational Awareness & Assistance)"]
    
    TMD["TMD Weather & Radar Services<br/>(Open Data / Public Stations)"]
    BMA["BMA Drainage Dept (DDS)<br/>(Canal Water Level Telemetry)"]
    Traffy["Traffy Fondue Platform<br/>(Crowdsourced Citizen Reports)"]
    Copernicus["Copernicus Data Space Ecosystem<br/>(Sentinel-1 SAR Satellite)"]
    OSM["OpenStreetMap Services<br/>(Road Topology & Overpass)"]

    User -->|Views situation, reports flood, requests SOS| System
    Admin -->|Triages incidents, manages help requests| System
    
    System -->|Ingests rain & weather observations| TMD
    System -->|Ingests canal water gauge telemetry| BMA
    System -->|Ingests citizen flood tickets| Traffy
    System -->|Queries SAR surface water observations| Copernicus
    System -->|Fetches road network data| OSM
```

---

## 2. Container Diagram (C4 Level 2)

```mermaid
graph TB
    subgraph Client_Side["Client Layer"]
        Web["Next.js Web Application<br/>(TypeScript, TailwindCSS, MapLibre GL JS)"]
    end

    subgraph Server_Side["Server & Processing Layer"]
        API["FastAPI Core Service & REST Gateway<br/>(Python 3.11, Pydantic v2, asyncpg)"]
        WSHub["WebSocket Live Hub<br/>(Python asyncio, Event Broadcaster)"]
        IngestWorker["Data Ingestion Scheduler<br/>(APScheduler, Resilient Adapters)"]
        ClusterEngine["Spatio-Temporal DBSCAN Engine<br/>(PostGIS & Python scikit-learn)"]
        RiskEngine["Multi-Factor Explainable Risk Engine<br/>(Rain + Water + Crowd + Sat + DEM)"]
    end

    subgraph Data_Layer["Storage & Event Broker"]
        Postgres[("PostgreSQL 16 + PostGIS 3.4<br/>(Spatial Indices, Time-Series Tables)")]
        RedisDB[("Redis 7.2 Cache & Pub/Sub<br/>(Channel: flood:events, Rate Limits)")]
    end

    Web -->|HTTPS REST Queries & Report Submissions| API
    Web <-->|WSS Live GeoJSON Delta Updates| WSHub
    
    API -->|Read / Write Geospatial Entities| Postgres
    API -->|Check Rate Limits & Session State| RedisDB
    
    IngestWorker -->|Fetch external feeds & persist observations| Postgres
    IngestWorker -->|Trigger re-clustering & re-evaluation| ClusterEngine
    
    ClusterEngine -->|Cluster points via ST_ClusterDBSCAN| Postgres
    ClusterEngine -->|Publish INCIDENT_UPDATED| RedisDB
    
    RiskEngine -->|Compute zone risk scores| Postgres
    RiskEngine -->|Publish RISK_CHANGED| RedisDB
    
    RedisDB -->|Pub/Sub Message Stream| WSHub
```

---

## 3. End-to-End Event Flow (Crowd Report to Live Map)

```mermaid
sequenceDiagram
    autonumber
    actor Citizen as Student / Citizen
    participant Browser as Web Browser (MapLibre UI)
    participant API as FastAPI /api/v1/reports
    participant DB as PostgreSQL 16 (PostGIS)
    participant Cluster as DBSCAN Incident Service
    participant Redis as Redis Pub/Sub (flood:events)
    participant WS as WebSocket Hub (/ws/live)
    actor OtherUsers as Other Connected Users

    Citizen->>Browser: Selects Water Depth & Submits Report (GPS)
    Browser->>API: POST /api/v1/reports (lat, lng, depth, photo)
    Note over API: Validates BBOX, MIME type, Rate Limit
    API->>DB: INSERT INTO flood_reports
    API-->>Browser: 201 Created (report_id, freshness: FRESH)
    
    API->>Cluster: Trigger Spatio-Temporal DBSCAN
    Note over Cluster: Groups reports within 150m & 45 mins
    Cluster->>DB: UPDATE / INSERT incidents
    Cluster->>Redis: PUBLISH flood:events (INCIDENT_UPDATED)
    
    Redis->>WS: Delivers event to WebSocket Hub
    WS->>OtherUsers: Pushes WS message (GeoJSON Incident Feature)
    Note over OtherUsers: Map updates marker & polygon smoothly without reload
```

---

## 4. Emergency Assistance (SOS) Workflow

```mermaid
stateDiagram-v2
    [*] --> OPEN: Citizen Submits SOS (Location, Type, Vulnerable count)
    OPEN --> ACKNOWLEDGED: EOC Operator Reviews Request
    ACKNOWLEDGED --> ASSIGNED: Volunteer / Rescue Team Dispatched
    ASSIGNED --> IN_PROGRESS: Responders Arrive on Scene
    IN_PROGRESS --> RESOLVED: Citizen Evacuated / Safe
    OPEN --> CANCELLED: Requester Cancels or False Alarm
    ACKNOWLEDGED --> CANCELLED: Requester Cancels
```
