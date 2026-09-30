# 🌊 KMITL Flood Intelligence Platform
### ระบบติดตามและบริหารจัดการสถานการณ์น้ำท่วมอัจฉริยะ ลาดกระบัง–สจล. (Real-Time Geospatial Disaster Intelligence)

[![Version](https://img.shields.io/badge/version-1.0.0--beta-blue.svg)](https://github.com/Chalermsak1/KMITL-Flood-Intelligence-)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black.svg?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016%20%2B%20PostGIS%203.4-336791.svg?logo=postgresql)](https://postgis.net/)
[![Redis](https://img.shields.io/badge/Broker-Redis%207.2%20Pub%2FSub-DC382D.svg?logo=redis)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Deployment-Docker%20Compose-2496ED.svg?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> **KMITL Flood Intelligence** คือแพลตฟอร์มศูนย์กลางข้อมูลน้ำท่วมเชิงพื้นที่อัจฉริยะ (Software-Only 100%) พัฒนาขึ้นเพื่อติดตาม ประเมิน และแจ้งเตือนสถานการณ์น้ำท่วมบริเวณสถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง (สจล.) และเขตลาดกระบังแบบ Real-Time ด้วยการประมวลผลข้อมูลร่วมหลายมิติ (Multi-Source Data Fusion) ผสานข้อมูลจากสถานีตรวจวัดทางอุทกวิทยา เรดาร์ตรวจอากาศ ดาวเทียมสำรวจระยะไกล ข้อมูลโครงข่ายถนน และรายงานจากประชาชนในพื้นที่ เพื่อสนับสนุนการตัดสินใจและการให้ความช่วยเหลือในภาวะวิกฤตได้อย่างแม่นยำและทันท่วงที

---

## 📸 ภาพรวมระบบและส่วนติดต่อผู้ใช้งาน (Visual Showcase)

### 1. แผนที่สถานการณ์สดแบบเวกเตอร์ความเร็วสูง (Live Geospatial Operations Map)
แสดงสภาพน้ำท่วมรายเส้นทาง ระดับน้ำในคลองหลัก จุดรายงานน้ำท่วม และศูนย์พักพิง พร้อมแถบเลื่อนจำลองวิวัฒนาการน้ำท่วมล่วงหน้า/ย้อนหลัง 24 ชั่วโมง

![KMITL Flood Intelligence Live Map Dashboard](docs/images/flood_map_dashboard.jpg)

---

### 2. สถาปัตยกรรมระบบแบบสมบูรณ์ (End-to-End System Architecture)
การไหลของข้อมูลตั้งแต่ Ingestion Sources, Spatial Engine, Durable Queue, Event Fanout จนถึง UI แสดงผลแบบ Real-Time Latency <150ms

![KMITL Flood Intelligence System Architecture](docs/images/system_architecture.jpg)

---

### 3. ระบบแจ้งเหตุน้ำท่วมและขอความช่วยเหลือฉุกเฉินบนสมาร์ตโฟน (Mobile Citizen Reporting & SOS Dispatch)
ออกแบบให้ใช้งานง่ายบนมือถือ พร้อมระบบ Geolocation ระบุพิกัดอัตโนมัติ, ถ่ายภาพแนบหลักฐาน, ตัวเลือกวัดระดับน้ำตามสรีระ และระบบนำทางสู่ศูนย์พักพิงที่ปลอดภัย

![KMITL Flood Mobile Crowdsourcing & SOS](docs/images/mobile_reporting_interface.jpg)

---

## 🌟 จุดเด่นและฟีเจอร์หลัก (Core Features)

### 1. 🗺️ แผนที่เวกเตอร์ความเร็วสูงและแถบเวลา 24 ชม. (High-Performance Vector Map)
- **WebGL GPU Rendering:** พัฒนาด้วย **MapLibre GL JS** เรนเดอร์แผนที่ถนนและชั้นข้อมูลกราฟิกลื่นไหล 60 FPS รองรับ Dark / Light Mode
- **OSM Road Corridor Exposure:** วิเคราะห์ความเสี่ยงบนโครงข่ายถนนจริงของเขตลาดกระบัง (OpenStreetMap Real Network) พร้อมแสดงแถบสีระดับความปลอดภัย:
  - 🟢 **ปลอดภัย (Dry / Safe):** ผิวถนนแห้ง สัญจรได้ตามปกติ
  - 🟡 **น้ำท่วมขังเล็กน้อย (Ponding 10–20 cm):** รถเล็กควรระมัดระวัง
  - 🔴 **วิกฤต/ห้ามผ่าน (Impassable >30 cm):** ถนนตัดขาด รถเล็กห้ามผ่าน
- **24-Hour Time Evolution Control:** แถบเวลา Time Slider ให้ผู้ใช้งานสามารถเลื่อนดูสถานการณ์น้ำท่วมย้อนหลังและแนวโน้มการเปลี่ยนแปลง

### 2. ⚡ การประมวลผลข้อมูลร่วมหลายมิติ (Multi-Source Data Fusion)
แยกความจริงของข้อมูลตามความถี่ในการอัปเดต (Temporal Truth Separation) เพื่อความถูกต้องสูงสุด:
- **Real-Time (วินาที - นาที):** รายงานความลึกและภาพถ่ายสภาพน้ำจากประชาชน (Citizen Crowdsourced Reports)
- **High-Frequency (10–30 นาที):** ระดับน้ำในคลองสายหลัก กทม. (BMA DDS Telemetry) และปริมาณฝนสะสม/เรดาร์ตรวจสภาพอากาศ (TMD Radar)
- **Observational Evidence (6–12 วัน):** ภาพถ่ายดาวเทียมเรดาร์ SAR (Copernicus Sentinel-1) สำหรับประเมินขอบเขตผืนน้ำท่วมวงกว้าง
- **Static Baseline:** ข้อมูลแบบจำลองความสูงเชิงเลข (Digital Elevation Model - DEM) และโครงข่ายคมนาคม

### 3. ⏱️ ระบบส่งข้อมูล Real-Time 3 ระดับ (3-Tier Hybrid Transport)
- **Tier 1 (WebSocket):** ช่องทางหลักแบบ Full-Duplex (`/ws/live`) อัปเดตเหตุการณ์และระดับน้ำแบบทันที Latency <150ms
- **Tier 2 (Server-Sent Events - SSE):** ช่องทางสำรองอัตโนมัติ (`/api/v1/realtime/events`) มี Keep-alive ส่งทุก 15 วินาที พร้อม Viewport Bounding Box Filter
- **Tier 3 (HTTP Polling):** กลไกสำรองระดับสุดท้าย ดึงข้อมูลทุก 20 วินาที เมื่อทำงานในเครือข่ายที่มีไฟร์วอลล์จำกัดสิทธิ์

### 4. 🛡️ คิวงานทนทาน 3 ชั้น ป้องกันข้อมูลสูญหาย (Multi-Tier Resilient Queue)
- **Tier 1:** AWS SQS (Production Mode)
- **Tier 2:** Redis Durable List (`kmitl:durable:jobs`)
- **Tier 3:** Disk Write-Ahead-Log (`queue_spool.jsonl` พร้อม `os.fsync`) รองรับการทำงานต่อเนื่องแม้ยามฐานข้อมูลหรือ Redis ขัดข้องชั่วคราว พร้อมกลไก Dead Letter Queue (DLQ) หลังลองซ้ำครบ 3 ครั้ง

### 5. 🧠 อัลกอริทึมจับกลุ่มเหตุการณ์และการประเมินความเสี่ยง (Spatio-Temporal DBSCAN & Risk Engine)
- ประมวลผลรายงานเหตุการณ์น้ำท่วมด้วย **DBSCAN (scikit-learn)** รัศมี 250 เมตร ภายในกรอบเวลา 2 ชั่วโมง เพื่อรวมรายงานที่ซ้ำซ้อนให้เป็นกลุ่มอุบัติการณ์เดียว (Incident Cluster)
- วิเคราะห์ความเสี่ยงเส้นทางด้วยปัจจัยหลายมิติ (ฝน + ระดับน้ำคลอง + ความสูงของดิน + รายงานภาคสนาม) เพื่อคำนวณเส้นทางเลี่ยงน้ำท่วมที่ปลอดภัยที่สุดไปยังศูนย์พักพิง

### 6. 📱 ระบบรายงานเหตุและขอความช่วยเหลือฉุกเฉิน (Citizen SOS & Reports)
- บันทึกพิกัดผ่าน Browser GPS ความแม่นยำสูง
- ระบุระดับน้ำได้ง่ายผ่านหมวดหมู่ระดับสรีระ (ข้อเท้า 10cm, หัวเข่า 30cm, เอว 60cm, ท่วมมิดคัน)
- ระบบตรวจสอบภาพถ่าย ป้องกันภาพสแปมและตรวจจับภาพซ้ำด้วย Perceptual Hashing (pHash)
- **ระบบ Safe Haven & Shelter:** ชี้พิกัดศูนย์พักพิงใกล้เคียง (เช่น หอประชุมเจ้าพระยาสุรวงษ์ไวยวัฒน์ สจล.) พร้อมระบบนำทางเลี่ยงจุดน้ำลึก

---

## 🏗️ สถาปัตยกรรมเทคโนโลยี (Technology Stack)

| ส่วนของระบบ | เทคโนโลยีที่เลือกใช้ | รายละเอียดและเวอร์ชัน |
|---|---|---|
| **Frontend Framework** | **Next.js 14** (App Router) | React 18, TypeScript, Server & Client Components |
| **Interactive Map Engine** | **MapLibre GL JS 4.1.1** | WebGL GPU-accelerated vector tile rendering |
| **Styling & Icons** | **Tailwind CSS 3.4 + Lucide React** | Responsive design รองรับทั้ง Mobile, Tablet และ Desktop |
| **Backend API** | **FastAPI 0.110+** | Python 3.11, Pydantic v2, Asynchronous I/O |
| **Database & Spatial** | **PostgreSQL 16 + PostGIS 3.4** | GeoAlchemy2, SQLAlchemy 2.0 (asyncpg), GIST Spatial Indexing |
| **Real-Time & Caching** | **Redis 7.2** | Pub/Sub Event Bus, Fast In-Memory Cache |
| **Queue & Worker** | **Python AsyncIO Worker** | SQS / Redis List / Disk WAL Spooler |
| **Data Processing & ML** | **Shapely, scikit-learn, PIL** | DBSCAN Clustering, Spatial Overlays, pHash deduplication |
| **Infrastructure** | **Docker & Docker Compose** | Containerized microservices พร้อม Healthcheck อัตโนมัติ |

---

## 📁 โครงสร้างโปรเจกต์ (Project Directory Structure)

```text
KMITL-Flood-Intelligence/
├── apps/
│   ├── api/                              # Backend Service (FastAPI)
│   │   ├── app/
│   │   │   ├── adapters/                 # ตัวเชื่อมต่อ API ภายนอก (TMD, BMA, OpenMeteo, ThaiWater)
│   │   │   ├── api/v1/                   # REST API Endpoints (Incidents, Roads, Water, Rain, SOS)
│   │   │   ├── core/                     # การตั้งค่า Config, Database, Redis Engine
│   │   │   ├── data/                     # โครงข่ายถนน OSM เขตลาดกระบัง (real_osm_network.json)
│   │   │   ├── models/                   # SQLAlchemy ORM Data Models
│   │   │   ├── schemas/                  # Pydantic v2 Request/Response Schemas
│   │   │   ├── services/                 # Business Logic (DBSCAN Clustering, Routing, Risk Engine)
│   │   │   ├── websocket/                # WebSocket Real-Time Event Hub
│   │   │   └── workers/                  # Background Asynchronous Queue Workers
│   │   ├── tests/                        # ชุดทดสอบ Pytest (Unit & Integration Tests)
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   │
│   └── web/                              # Frontend Service (Next.js 14)
│       ├── public/                       # Static Assets & Icons
│       ├── src/
│       │   ├── app/                      # Next.js App Router Pages
│       │   │   ├── page.tsx              # หน้าแรก (Live Situational Dashboard)
│       │   │   ├── map/                  # หน้าแผนที่สดเต็มจอ (Interactive Vector Map)
│       │   │   ├── report/               # หน้ารายงานเหตุน้ำท่วม (Citizen Crowdsource)
│       │   │   ├── help/                 # หน้าขอความช่วยเหลือฉุกเฉิน (SOS Emergency)
│       │   │   ├── shelters/             # หน้าข้อมูลศูนย์พักพิงและจุดอพยพ
│       │   │   ├── route/                # หน้าระบบนำทางเลี่ยงน้ำท่วม (Safe Route Evaluator)
│       │   │   └── admin/                # ศูนย์บัญชาการเหตุการณ์ (Operations Center EOC)
│       │   ├── components/               # UI Components (Map, Panels, Badges, Nav)
│       │   ├── hooks/                    # Custom Hooks (useWebSocket, useLocation)
│       │   └── lib/                      # API Client & Data Types
│       ├── Dockerfile
│       └── package.json
│
├── docs/                                 # เอกสารเชิงสถาปัตยกรรมและรายงานผลการทดสอบ
│   ├── images/                           # ภาพประกอบระบบ แผนภาพสถาปัตยกรรม และ UI Showcase
│   ├── FINAL-ACTUAL-ARCHITECTURE.md      # เอกสารสถาปัตยกรรมระบบฉบับสมบูรณ์
│   └── data-sources.md                   # รายละเอียดการเชื่อมต่อแหล่งข้อมูลภายนอก
├── infra/                                # ไฟล์ตั้งค่า Infrastructure & DB Migrations
│   └── migrations/                       # Alembic Database Migrations
├── scripts/                              # สคริปต์ทดสอบและเปิด Public Tunnel
├── docker-compose.yml                    # Docker Compose Orchestration (4 Services)
├── Makefile                              # คำสั่งลัดสำหรับการติดตั้งและรันระบบ
└── README.md
```

---

## 🚀 เริ่มต้นใช้งานด่วน (Quick Start with Docker)

### ความต้องการของระบบ (Prerequisites)
- [Docker](https://www.docker.com/) (>= 24.0) และ Docker Compose (>= 2.20)
- Git

### 1. โคลนคลังโค้ด (Clone Repository)
```bash
git clone https://github.com/Chalermsak1/KMITL-Flood-Intelligence-.git
cd KMITL-Flood-Intelligence-
```

### 2. ตั้งค่าไฟล์สภาพแวดล้อม (Environment Configuration)
```bash
cp .env.example .env
```
*(ค่าพื้นฐานใน `.env.example` ถูกตั้งค่าพร้อมรันในเครื่อง Local Development ได้ทันทีโดยไม่ต้องแก้ไขเพิ่มเติม)*

### 3. สั่งรันระบบผ่าน Docker Compose
```bash
docker compose up -d --build
```
คำสั่งนี้จะเริ่มต้นคอนเทนเนอร์ 4 ตัว:
1. `kmitl_flood_db` (PostgreSQL 16 + PostGIS 3.4 บนพอร์ต 5432)
2. `kmitl_flood_redis` (Redis 7.2 บนพอร์ต 6379)
3. `kmitl_flood_api` (FastAPI REST & WebSocket บนพอร์ต 8000)
4. `kmitl_flood_web` (Next.js Application บนพอร์ต 3000)

### 4. เรียกใช้การรัน Migration และเติมข้อมูลตั้งต้น (Database Seed)
```bash
# อัปเดตโครงสร้างฐานข้อมูล PostGIS
docker compose exec api alembic upgrade head

# นำเข้าโครงข่ายถนนจริงของลาดกระบัง (OSM Road Network)
docker compose exec api python -m app.scripts.load_osm_to_postgis
```
*(หรือใช้งานคำสั่งลัด `make migrate` และ `make seed`)*

### 5. เปิดเข้าใช้งานผ่านเว็บเบราว์เซอร์ (Access Applications)
- 🌐 **หน้าแดชบอร์ดหลัก (Main Dashboard):** [http://localhost:3000](http://localhost:3000)
- 🗺️ **แผนที่น้ำท่วมสดแบบเต็มจอ (Live Map):** [http://localhost:3000/map](http://localhost:3000/map)
- 📢 **แจ้งเหตุน้ำท่วม (Citizen Report):** [http://localhost:3000/report](http://localhost:3000/report)
- 🚨 **ศูนย์ขอความช่วยเหลือฉุกเฉิน (SOS Emergency):** [http://localhost:3000/help](http://localhost:3000/help)
- 🧭 **ระบบประเมินเส้นทางปลอดภัย (Safe Route):** [http://localhost:3000/route](http://localhost:3000/route)
- 🏢 **ศูนย์สั่งการสถานการณ์ (Operations Center EOC):** [http://localhost:3000/admin](http://localhost:3000/admin)
- 📖 **เอกสารคู่มือ API (FastAPI Interactive Docs):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🧪 การทดสอบระบบ (Automated Testing)

ระบบมาพร้อมชุดทดสอบอัตโนมัติครบถ้วน ทั้ง Unit Tests, Spatial Geometry Tests, และ Integration Endpoints:

```bash
# รันชุดทดสอบความถูกต้องของ API และโมเดลทั้งหมด
docker compose exec api pytest -v

# หรือรันผ่าน Makefile
make test
```

### การทดสอบโหลดและความเสถียร (Load & Reliability Verification)
- ผ่านการทดสอบ **Real HTTP Load Test** ระดับ 500+ Concurrent Virtual Users
- รองรับการสตรีม **Server-Sent Events (SSE)** มากกว่า 5,000 การเชื่อมต่อพร้อมกัน
- กลไก **Queue Durability** ผ่านการทดสอบ Failover ปลอดภัย ไม่สูญเสียข้อมูลรายงานของประชาชน

---

## 🔒 นโยบายความปลอดภัยและความเป็นส่วนตัว (Privacy & Security)

- **EXIF GPS Sanitization:** ลบข้อมูล Metadata และตำแหน่ง GPS ดั้งเดิมออกจากไฟล์ภาพทันทีในชั้น Ingestion ก่อนบันทึก เพื่อปกป้องความเป็นส่วนตัวของประชาชน
- **Geofence Boundary Classification:** ระบบมีระบบตรวจสอบพิกัดรายงานให้อยู่ในขอบเขตเขตลาดกระบังและพื้นที่ สจล. เท่านั้น รายงานนอกพื้นที่จะถูกติดแท็กคัดกรองอย่างเหมาะสม
- **Spam & Tamper Protection:** ตรวจสอบขนาดไฟล์ ชนิดข้อมูลไบนารี (Magic Bytes) และใช้ Perceptual Hashing (pHash) ป้องกันการส่งภาพซ้ำเพื่อสร้างกระแสข่าวลวง

---

## ⚠️ ข้อสงวนสิทธิ์การใช้งาน (Disclaimer)

> แพลตฟอร์มนี้พัฒนาขึ้นเพื่อเป็นเครื่องมือสนับสนุนการตัดสินใจและให้ข้อมูลสถานการณ์น้ำท่วมเชิงพื้นที่เท่านั้น ข้อมูลการประเมินความเสี่ยงเส้นทางและความลึกของน้ำเกิดจากการประมวลผลข้อมูลร่วมแบบอัตโนมัติ **ในกรณีที่เกิดสถานการณ์ฉุกเฉินระดับรุนแรงหรือมีภัยต่อชีวิต โปรดปฏิบัติตามคำแนะนำของศูนย์รักษาความปลอดภัย สจล. (KMITL Safety Center) สายด่วน 191 หรือ 1669 และหน่วยงานป้องกันและบรรเทาสาธารณภัยเป็นหลัก**

---

## 👥 ผู้พัฒนาและติดต่อ (Contributors & Support)

- **ผู้พัฒนาโครงการ:** ทีมพัฒนา KMITL Flood Intelligence Platform
- **สถาบัน:** สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง (KMITL)
- **GitHub Repository:** [https://github.com/Chalermsak1/KMITL-Flood-Intelligence-](https://github.com/Chalermsak1/KMITL-Flood-Intelligence-)
- **แจ้งปัญหาหรือข้อเสนอแนะ:** สร้าง [GitHub Issues](https://github.com/Chalermsak1/KMITL-Flood-Intelligence-/issues) ในโครงการได้ทันที
