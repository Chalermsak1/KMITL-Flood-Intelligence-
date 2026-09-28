# Data Source Registry & Verification Catalog
## KMITL FLOOD INTELLIGENCE

เอกสารนี้รวบรวมรายละเอียดและการตรวจสอบทางเทคนิค (Technical Verification) ของแหล่งข้อมูลภายนอก (External Data Sources) ทั้งหมดที่นำมาใช้งานหรือผสานในระบบ **KMITL Flood Intelligence** ตามหลักการ **Separation of Data Truth** (Real-Time vs. Near Real-Time vs. Observational vs. Static).

---

## 1. Summary Status Matrix

| Source Identifier | Source Name | Data Class | Update Frequency | Coverage | Verification Status | Fallback Provider |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `SRC_TMD_WEATHER` | กรมอุตุนิยมวิทยา (TMD) | Real-Time / NRT | 10–15 min | Thailand / Suvarnabhumi | **PENDING_ACCESS** | `TMDMockProvider (mode: DEMO)` |
| `SRC_BMA_DDS` | สำนักการระบายน้ำ กทม. (DDS) | High-Frequency Obs | 10–30 min | Bangkok / Prawet Basin | **PENDING_ACCESS** | `BMAMockProvider (mode: DEMO)` |
| `SRC_TRAFFY_FONDUE` | Traffy Fondue | Crowdsourced | Near Real-Time | Bangkok / Lat Krabang | **MOCK_ONLY** | `TraffyMockProvider (mode: DEMO)` |
| `SRC_COPERNICUS_S1` | Copernicus Sentinel-1 SAR | Observational | 6–12 days | Global (35P Lat Krabang) | **VERIFIED** | `SatelliteMockProvider (mode: DEMO)` |
| `SRC_USER_REPORT` | First-Party Crowdsourced | Real-Time | Real-time (Seconds) | KMITL & Lat Krabang | **VERIFIED** (Internal) | N/A (Native First-Party) |
| `SRC_OSM_ROADS` | OpenStreetMap | Static / Weekly | Static | Lat Krabang Network | **VERIFIED** | Local OSM GeoJSON Cache |

---

## 2. Detailed Technical Verification

### 2.1 Thai Meteorological Department (TMD)
* **Official Portal:** [data.tmd.go.th](https://data.tmd.go.th/)
* **Official Radar Service:** [weather.tmd.go.th](https://weather.tmd.go.th/)
* **Data Class:** Near Real-Time Weather Observations / Rain Intensity
* **Verified REST API Endpoints:**
  * Daily Forecast: `https://data.tmd.go.th/api/WeatherToday/V2/?uid={uid}&ukey={ukey}&format=json`
  * Weather Station: `https://data.tmd.go.th/api/WeatherStation/V2/?uid={uid}&ukey={ukey}&format=json`
* **Authentication Method:** Registration required to obtain user parameters (`uid` and `ukey`).
* **Radar Specifics & Limitations:**
  * TMD **ไม่มี Public Open REST API ให้บริการข้อมูลเรดาร์ดิบในรูปแบบ GeoJSON/Vector หรือ WMS Tiles ฟรีโดยไม่ต้องทำบันทึกข้อตกลง (MOU)**
  * ข้อมูลเรดาร์สาธารณะถูกจัดทำเป็นภาพเรดาร์ PNG/GIF Loop (เช่น สถานีเรดาร์สุวรรณภูมิ และสถานีเรดาร์หนองจอก)
  * **Data Truth Guardrail:** เรดาร์สะท้อนหยดน้ำในบรรยากาศ (dBZ) **ไม่ใช่ระดับน้ำท่วมบนผิวจราจร** ระบบแสดงผลในฐานะ Weather/Rain Layer เท่านั้น
* **Phase 1 Implementation:**
  * กำหนดสถานะเป็น **`PENDING_ACCESS`**
  * สร้าง `TMDAdapter` ที่รองรับโครงสร้าง API จริง และมี `TMDMockProvider` จำลองเรดาร์ฝนตกหนักครอบคลุมเขตลาดกระบัง โดยมี metadata ระบุ `source: TMD_MOCK, mode: DEMO`.

---

### 2.2 Bangkok Metropolitan Administration / Department of Drainage and Sewerage (BMA/DDS)
* **Official Portals:**
  * Open Data BKK: [data.bangkok.go.th](https://data.bangkok.go.th/)
  * สำนักการระบายน้ำ กทม.: [dds.bangkok.go.th](http://dds.bangkok.go.th/)
  * ตรวจวัดน้ำท่วมถนน: [weather.bangkok.go.th/Flood](https://weather.bangkok.go.th/Flood)
  * จุดน้ำท่วมขัง: [now.bangkok.go.th/flood-alert.html](https://now.bangkok.go.th/flood-alert.html)
* **Data Class:** High-Frequency Observations (ระดับน้ำในคลอง, สถานีสูบน้ำ, ประตูระบายน้ำ)
* **Observed Metrics:**
  * ระดับน้ำ (m MSL: เมตรจากระดับน้ำทะเลปานกลาง)
  * อัตราการเปลี่ยนแปลงย้อนหลัง 10 นาที, 30 นาที, 60 นาที (`water_delta`)
  * สถานะความเสี่ยง (ปกติ, เฝ้าระวัง, วิกฤตล้นตลิ่ง)
* **Authentication & Availability:**
  * ระบบเว็บของ DDS มีการอัปเดตข้อมูลแบบกราฟิก แต่ไม่มี Developer REST API ที่มี Service Level Agreement (SLA) และ API Key สำหรับบุคคลภายนอกอย่างเป็นทางการ
* **Data Truth Guardrail:**
  * **ห้ามนำระดับน้ำในคลองไปตีความตรง ๆ ว่าเป็นระดับน้ำท่วมบนถนน**
  * คลองเป็นระบบระบายน้ำหลัก หากระดับน้ำคลองสูงจะส่งผลต่อการระบายน้ำจากถนนลงสู่คลอง
* **Phase 1 Implementation:**
  * กำหนดสถานะเป็น **`PENDING_ACCESS`**
  * สร้าง `BMAAdapter` + `BMAMockProvider` จำลองสถานีวัดระดับน้ำคลองประเวศบุรีรมย์, คลองลำปลาทิว, และคลองหัวตะเข้ พร้อมการคำนวณ `delta_10m`, `delta_30m`, `delta_60m`, และแนวโน้ม `RISING/FALLING/STABLE`.

---

### 2.3 Traffy Fondue
* **Official Portal:** [traffy.in.th](https://www.traffy.in.th/) / [citydata.traffy.in.th](https://citydata.traffy.in.th/)
* **Data Class:** Crowdsourced Citizen Tickets
* **Authentication & Availability:**
  * ไม่มี Public Swagger/OpenAPI ที่เปิดให้เรียกดูข้อมูลสดแบบ Real-time โดยไม่ขอสิทธิ์พิเศษ
  * การเชื่อมต่อ API ต้องติดต่อผ่านทีมงาน หรือดาวน์โหลด Open Data CSV ประจำเดือน
* **Data Truth Guardrail:**
  * ข้อมูลมีความเป็นอัตวิสัย (Subjective) สูง ระดับความเร่งด่วนและคำอธิบายขึ้นกับผู้แจ้ง
  * ต้องผ่านการตรวจสอบพิกัด (Bounding Box) และแปลงเป็น Normalized Schema
* **Phase 1 Implementation:**
  * กำหนดสถานะเป็น **`MOCK_ONLY`** (รอ Official API Key)
  * ออกแบบ `TraffyAdapter` รองรับการ Normalize ฟิลด์: `ticket_id`, `category`, `description`, `lat`, `lng`, `timestamp`, `state`.

---

### 2.4 Copernicus Sentinel-1 SAR & NASA OPERA DSWx-S1
* **Official Documentation:** [documentation.dataspace.copernicus.eu](https://documentation.dataspace.copernicus.eu/)
* **Catalog & Endpoints:**
  * STAC API: `https://catalogue.dataspace.copernicus.eu/stac`
  * OData API: `https://catalogue.dataspace.copernicus.eu/odata/v1/Products`
  * Authentication: OAuth2 Keycloak at `identity.dataspace.copernicus.eu`
* **Data Class:** **Observational Evidence Layer** (ไม่ใช่ Real-time รายนาที)
* **Sensor Type:** C-band Synthetic Aperture Radar (SAR)
  * สามารถทะลุผ่านเมฆ ฝน และความมืดได้ (เหมาะกับฤดูมรสุมในไทย)
* **Revisit Time & Spatial Resolution:**
  * รอบวงโคจรดาวเทียมผ่านเขตลาดกระบัง: 6–12 วัน
  * Spatial Resolution: 10–30 เมตร
  * Latency: ข้อมูลพร้อมประมวลผลประมาณ 6–24 ชั่วโมงหลังดาวเทียมบันทึกภาพ
* **Data Truth Guardrail:**
  * ห้ามแสดงผลภาพดาวเทียมว่าเป็น "Live Water Level"
  * ต้องระบุเวลาบันทึกภาพจริง (`acquisition_at`) และคำเตือนอย่างชัดเจน:
    > *"Observational Evidence Layer (Acquired: YYYY-MM-DD HH:mm) — Revisit interval 6–12 days. Does not represent minute-by-minute surface flooding."*
* **Phase 1 Implementation:**
  * กำหนดสถานะเป็น **`VERIFIED`**
  * สร้าง `SatelliteAdapter` ที่รองรับโครงสร้าง STAC GeoJSON พร้อม fallback สู่ `SatelliteMockProvider` ที่มี GeoJSON ขอบเขตน้ำท่วมจริงในอดีตของเขตลาดกระบัง.

---

## 3. Normalized Common Schema (Data Model)

ข้อมูลจากทุกแหล่งข้อมูลภายนอกจะถูก Normalize เข้าสู่ Schema กลาง ก่อนส่งต่อไปยัง Database, Risk Engine, และ WebSocket:

```json
{
  "source": "SRC_TMD_WEATHER | SRC_BMA_DDS | SRC_TRAFFY_FONDUE | SRC_COPERNICUS_S1 | SRC_USER_REPORT",
  "location": {
    "type": "Point",
    "coordinates": [100.7782, 13.7298]
  },
  "observed_at": "2026-09-28T11:20:00+07:00",
  "ingested_at": "2026-09-28T11:25:12+07:00",
  "data_age_seconds": 312,
  "freshness_status": "FRESH | RECENT | AGING | STALE | EXPIRED",
  "confidence": "LOW | MEDIUM | HIGH",
  "metric_type": "WATER_LEVEL | RAINFALL_RATE | ROAD_FLOOD_REPORT | SAR_WATER_SURFACE",
  "value": {
    "water_level_m_msl": 0.85,
    "delta_30m": 0.12,
    "trend": "RISING"
  },
  "attribution": {
    "provider": "Department of Drainage and Sewerage BMA",
    "license": "Open Government License Thailand",
    "mode": "DEMO"
  }
}
```
