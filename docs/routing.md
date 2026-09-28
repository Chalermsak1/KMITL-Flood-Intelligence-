# Flood-Aware Routing Engine & Decision Support Specification
## KMITL FLOOD INTELLIGENCE

---

## 1. Design Purpose & Non-Goals

### 1.1 Purpose
The KMITL Flood-Aware Routing Engine is a **decision-support utility** designed to help students, university personnel, and local residents evaluate road transit exposure during tropical convective storms and severe inundation in Lat Krabang.

### 1.2 Explicit Non-Goals
- **NOT a commercial turn-by-turn navigation app** (such as Google Maps or Waze).
- **NEVER promises a "100% Safe Route" or "Guaranteed Safe Passage"**:
  In a tropical monsoon environment, sudden canal overflow, localized culvert blockage, or stalled vehicles can alter surface conditions in minutes.
- **Mandatory User-Facing Terminology**:
  - The system labels routes as **`LOWER OBSERVED FLOOD EXPOSURE`** or **`HIGH FLOOD EXPOSURE OBSERVED`**.
  - Always includes the disclaimer: *"Conditions can change rapidly during monsoon downpours. Drive with caution."*

---

## 2. Road Network Topography (KMITL & Lat Krabang)

The routing engine operates over a curated OpenStreetMap (OSM) topological graph covering primary and secondary arterial corridors around KMITL:

```
[Lat Krabang Rd (West)] <---> [KMITL Campus Frontage (Chalong Krung)] <---> [Chalong Krung North]
         |                                     |                                    |
         +------------------------ [Motorway Frontage Rd] -------------------------+
                                               |
                                    [Hua Takhe / Luang Phaeng]
```

### Key Segments:
1. **`SEG_CHALONG_KRUNG_CAMPUS`**: Primary frontage road in front of KMITL main gates, railway crossing, and canal bridge.
2. **`SEG_CHALONG_KRUNG_N`**: Arterial connecting KMITL to Lat Krabang Industrial Estate.
3. **`SEG_LAT_KRABANG_W`**: Western corridor toward Rom Klao and King Kaeo.
4. **`SEG_LAT_KRABANG_E`**: Eastern corridor toward Hua Takhe old market and Chachoengsao.
5. **`SEG_KMITL_ENGINEERING_LOOP`**: Inner campus ring bypassing main gate traffic.
6. **`SEG_MOTORWAY_FRONTAGE`**: Southern bypass parallel to Motorway Highway 7.

---

## 3. Dynamic Exposure & Cost Calculation

Each candidate route cost is formulated as:

$$C_{\text{route}} = T_{\text{base}} \times M_{\text{exposure}} + P_{\text{uncertainty}}$$

Where:
- $T_{\text{base}}$: Baseline travel time under clear conditions.
- $M_{\text{exposure}}$: Flood exposure multiplier:
  - `CRITICAL` ($>40\text{ cm}$ or impassable): $\times 50.0$
  - `HIGH` ($20\text{--}40\text{ cm}$): $\times 15.0$
  - `MEDIUM` ($10\text{--}20\text{ cm}$): $\times 4.0$
  - `LOW` ($<10\text{ cm}$): $\times 1.2$
  - `UNKNOWN` (No corroborating data): $\times 2.0$ (Uncertainty penalty; never defaults to LOW!)

---

## 4. Multi-Route Candidate Generation

Every evaluation outputs **2–3 candidate corridors**:
1. **Candidate A (Direct Corridor)**: Fastest baseline path; may traverse high-water bottlenecks.
2. **Candidate B (Lower Observed Exposure)**: Detour corridor prioritizing inner campus roads or higher elevation segments.
3. **Candidate C (Arterial Bypass)**: Frontage / highway alternative.

Each route card details:
- Distance in kilometers
- Estimated travel time under current water exposure
- Observed exposure level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, `UNKNOWN`)
- Count of active corroborating citizen reports
- Age of latest observation (e.g. "4 min ago")
- Per-segment breakdown
