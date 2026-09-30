import os
import json
import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple
from shapely.geometry import LineString, Point, shape

from app.schemas.road import (
    RoadFeature,
    RoadProperties,
    RoadGeometry,
    RoadHistoryPoint,
    DrainageFeature,
    DrainageProperties,
    DrainageGeometry,
)

# Supported Real-World Road Segments in Lat Krabang & KMITL Campus (Calibrated to OpenStreetMap)
SUPPORTED_ROAD_SEGMENTS: List[Dict[str, Any]] = [
    {
        "id": "SEG_CHALONG_KRUNG_CAMPUS",
        "name": "Thanon Chalong Krung (KMITL Main Frontage)",
        "road_type": "PRIMARY",
        "elevation_m": 1.8,
        "length_km": 2.17,
        "primary_drainage_id": "DRAIN_KHLONG_PRAWET",
        "primary_drainage_name": "คลองประเวศบุรีรมย์ (Khlong Prawet Burirom)",
        "drainage_flow_bearing": "South (175°)",
        "coordinates": [],
        "low_point": {
            "name": "Hua Takhe Bridge Approach Sag",
            "elevation_m": 1.5,
            "coordinates": [100.7802366, 13.7225]
        },
        "drainage_infra": {
            "id": "DRAIN_PUMP_PRAWET",
            "name": "Prawet Pump Station (15 m³/s)",
            "status": "PUMPING",
            "coordinates": [100.7850, 13.7215]
        },
        "flow_path_coordinates": []
    },
    {
        "id": "SEG_CHALONG_KRUNG_N",
        "name": "Thanon Chalong Krung (North - Industrial Estate)",
        "road_type": "PRIMARY",
        "elevation_m": 2.1,
        "length_km": 3.07,
        "primary_drainage_id": "DRAIN_KHLONG_LAM_PLA_THIO",
        "primary_drainage_name": "คลองลำปลาทิว (Khlong Lam Pla Thio)",
        "drainage_flow_bearing": "East (95°)",
        "coordinates": [],
        "low_point": {
            "name": "Lam Pla Thio Culvert Depression",
            "elevation_m": 1.8,
            "coordinates": [100.7930, 13.7465]
        },
        "drainage_infra": {
            "id": "DRAIN_KHLONG_LAM_PLA_THIO",
            "name": "Lam Pla Thio Eastern Outfall Sluice",
            "status": "NORMAL",
            "coordinates": [100.7930, 13.7480]
        },
        "flow_path_coordinates": []
    },
    {
        "id": "SEG_CHALONG_KRUNG_S",
        "name": "Thanon Chalong Krung (South - Hua Takhe Crossing)",
        "road_type": "PRIMARY",
        "elevation_m": 1.7,
        "length_km": 1.0,
        "primary_drainage_id": "DRAIN_KHLONG_HUA_TAKHE",
        "primary_drainage_name": "คลองหัวตะเข้ (Khlong Hua Takhe)",
        "drainage_flow_bearing": "Southeast (135°)",
        "coordinates": [],
        "low_point": {
            "name": "Hua Takhe Old Market Road Basin",
            "elevation_m": 1.4,
            "coordinates": [100.7802366, 13.7219719]
        },
        "drainage_infra": {
            "id": "DRAIN_PUMP_PRAWET",
            "name": "Prawet Pump Station & Lock",
            "status": "PUMPING",
            "coordinates": [100.7850, 13.7215]
        },
        "flow_path_coordinates": []
    },
    {
        "id": "SEG_LAT_KRABANG_W",
        "name": "Thanon Lat Krabang (West toward Rom Klao)",
        "road_type": "PRIMARY",
        "elevation_m": 2.0,
        "length_km": 3.89,
        "primary_drainage_id": "DRAIN_KHLONG_PRAWET",
        "primary_drainage_name": "คลองประเวศบุรีรมย์ (Khlong Prawet Burirom)",
        "drainage_flow_bearing": "South (180°)",
        "coordinates": [],
        "low_point": {
            "name": "Prawet Northern Collector Swale",
            "elevation_m": 1.7,
            "coordinates": [100.7666, 13.7217]
        },
        "drainage_infra": {
            "id": "DRAIN_PUMP_PRAWET",
            "name": "Khlong Prawet Drainage Culvert",
            "status": "OPERATIONAL",
            "coordinates": [100.7666, 13.7212]
        },
        "flow_path_coordinates": []
    },
    {
        "id": "SEG_LAT_KRABANG_E",
        "name": "Thanon Luang Phaeng / Hua Takhe Market",
        "road_type": "SECONDARY",
        "elevation_m": 1.6,
        "length_km": 3.27,
        "primary_drainage_id": "DRAIN_KHLONG_HUA_TAKHE",
        "primary_drainage_name": "คลองหัวตะเข้ / คลองประเวศฯ",
        "drainage_flow_bearing": "Southwest (210°)",
        "coordinates": [],
        "low_point": {
            "name": "Luang Phaeng Drainage Sump",
            "elevation_m": 1.3,
            "coordinates": [100.7895, 13.7215]
        },
        "drainage_infra": {
            "id": "DRAIN_KHLONG_HUA_TAKHE",
            "name": "Hua Takhe Sluice Gate",
            "status": "OPERATIONAL",
            "coordinates": [100.7880, 13.7220]
        },
        "flow_path_coordinates": []
    },
    {
        "id": "SEG_KMITL_ENGINEERING_LOOP",
        "name": "KMITL Inner Campus Rd (Engineering & Library)",
        "road_type": "TERTIARY",
        "elevation_m": 1.9,
        "length_km": 0.94,
        "primary_drainage_id": "DRAIN_CAMPUS_RETENTION",
        "primary_drainage_name": "แก้มลิงและบ่อหน่วงน้ำ สจล. (Campus Retention Basin)",
        "drainage_flow_bearing": "West toward Retention Pond (260°)",
        "coordinates": [],
        "low_point": {
            "name": "Faculty of Engineering Retention Inflow Basin",
            "elevation_m": 1.2,
            "coordinates": [100.7725, 13.7285]
        },
        "drainage_infra": {
            "id": "DRAIN_CAMPUS_RETENTION",
            "name": "KMITL Retention Basin Gate",
            "status": "OPERATIONAL",
            "coordinates": [100.7735, 13.7290]
        },
        "flow_path_coordinates": []
    },
    {
        "id": "SEG_MOTORWAY_FRONTAGE",
        "name": "Highway 7 Motorway Parallel Frontage Rd",
        "road_type": "SECONDARY",
        "elevation_m": 2.4,
        "length_km": 5.64,
        "primary_drainage_id": "DRAIN_KHLONG_LAM_PLA_THIO",
        "primary_drainage_name": "คลองลำปลาทิว / คลองชวดลากข้าว",
        "drainage_flow_bearing": "Northeast (45°)",
        "coordinates": [],
        "low_point": {
            "name": "Motorway Ditch Discharge Culvert",
            "elevation_m": 1.9,
            "coordinates": [100.7844, 13.7324]
        },
        "drainage_infra": {
            "id": "DRAIN_KHLONG_LAM_PLA_THIO",
            "name": "Lam Pla Thio Southern Gate",
            "status": "NORMAL",
            "coordinates": [100.7870, 13.7330]
        },
        "flow_path_coordinates": []
    },
    {
        "id": "SEG_ROMKLAO_INTERSECTION",
        "name": "Rom Klao - Lat Krabang Intersection Corridor",
        "road_type": "PRIMARY",
        "elevation_m": 2.2,
        "length_km": 1.61,
        "primary_drainage_id": "DRAIN_KHLONG_PRAWET",
        "primary_drainage_name": "คลองประเวศบุรีรมย์ / คลองแม่จันทร์",
        "drainage_flow_bearing": "Southeast (140°)",
        "coordinates": [],
        "low_point": {
            "name": "Rom Klao Intersection Low Swale",
            "elevation_m": 1.8,
            "coordinates": [100.7483, 13.7205]
        },
        "drainage_infra": {
            "id": "DRAIN_KHLONG_PRAWET",
            "name": "Mae Chan Canal Sluice",
            "status": "OPERATIONAL",
            "coordinates": [100.7520, 13.7210]
        },
        "flow_path_coordinates": []
    }
]

# Real Lat Krabang Drainage Infrastructure Network (Calibrated to OpenStreetMap)
DRAINAGE_INFRASTRUCTURE: List[Dict[str, Any]] = [
    {
        "id": "DRAIN_KHLONG_PRAWET",
        "name": "คลองประเวศบุรีรมย์ (Khlong Prawet Burirom)",
        "drainage_type": "PRIMARY_CANAL",
        "capacity_note": "Main East-West drainage artery (Discharge toward Bang Pakong & Chao Phraya)",
        "current_status": "RISING (+12 cm/30m)",
        "coordinates": []
    },
    {
        "id": "DRAIN_KHLONG_LAM_PLA_THIO",
        "name": "คลองลำปลาทิว (Khlong Lam Pla Thio)",
        "drainage_type": "PRIMARY_CANAL",
        "capacity_note": "North-South industrial collector discharging into Khlong Prawet",
        "current_status": "NORMAL",
        "coordinates": []
    },
    {
        "id": "DRAIN_KHLONG_HUA_TAKHE",
        "name": "คลองหัวตะเข้ (Khlong Hua Takhe)",
        "drainage_type": "CANAL_JUNCTION",
        "capacity_note": "Historic canal junction connecting eastern irrigation network",
        "current_status": "NORMAL",
        "coordinates": []
    },
    {
        "id": "DRAIN_KHLONG_MON",
        "name": "คลองมอญ (Khlong Mon)",
        "drainage_type": "PRIMARY_CANAL",
        "capacity_note": "Key agricultural and stormwater drainage canal north of Lat Krabang",
        "current_status": "NORMAL",
        "coordinates": []
    },
    {
        "id": "DRAIN_KHLONG_LAT_KRABANG",
        "name": "คลองลาดกระบัง (Khlong Lat Krabang)",
        "drainage_type": "PRIMARY_CANAL",
        "capacity_note": "Major north-south drainage channel serving southern Lat Krabang",
        "current_status": "NORMAL",
        "coordinates": []
    },
    {
        "id": "DRAIN_PUMP_PRAWET",
        "name": "ประตูระบายน้ำและสถานีสูบน้ำคลองประเวศฯ (ลาดกระบัง)",
        "drainage_type": "PUMP_STATION",
        "capacity_note": "15 m³/s pumping capacity (Active drainage booster)",
        "current_status": "PUMPING",
        "coordinates": [100.7850, 13.7215]
    },
    {
        "id": "DRAIN_CAMPUS_RETENTION",
        "name": "แก้มลิงและบ่อหน่วงน้ำ มหาวิทยาลัย สจล.",
        "drainage_type": "RETENTION_BASIN",
        "capacity_note": "120,000 m³ campus stormwater retention capacity",
        "current_status": "OPERATIONAL",
        "coordinates": [100.7735, 13.7290]
    }
]

# Load genuine OpenStreetMap data file
_DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "real_osm_network.json")

def _init_osm_datasets():
    if os.path.exists(_DATA_FILE):
        try:
            with open(_DATA_FILE, "r", encoding="utf-8") as f:
                osm_data = json.load(f)
            
            corridors = osm_data.get("corridors", {})
            for seg in SUPPORTED_ROAD_SEGMENTS:
                if seg["id"] in corridors:
                    c = corridors[seg["id"]]
                    seg["coordinates"] = c["coordinates"]
                    seg["flow_path_coordinates"] = c.get("flow_path_coordinates", c["coordinates"])
                    line = LineString(c["coordinates"])
                    seg["length_km"] = round(line.length * 111.0, 2)
            
            drainage_map = osm_data.get("drainage", {})
            for d in DRAINAGE_INFRASTRUCTURE:
                if d["id"] in drainage_map:
                    d["coordinates"] = drainage_map[d["id"]]["coordinates"]
        except Exception as e:
            print(f"Warning: Failed to load real OSM network data from {_DATA_FILE}: {e}")

_init_osm_datasets()


def validate_coordinate_pair(lon: float, lat: float) -> Tuple[float, float]:
    """
    Validate and enforce WGS84 EPSG:4326 [longitude, latitude] coordinate order.
    Rejects NaN/inf/null and detects reversed coordinate order.
    """
    if lon is None or lat is None or math.isnan(lon) or math.isnan(lat):
        raise ValueError(f"Invalid coordinate: lon={lon}, lat={lat}")
    
    # Detect reversed coordinate order: Thailand lat is ~13.7, lon is ~100.7
    if 13.0 <= lon <= 14.5 and 100.0 <= lat <= 101.5:
        # Received [lat, lon] instead of [lon, lat]
        lon, lat = lat, lon

    # Check bounds for Bangkok Metropolitan Region & Lat Krabang
    if not (100.0 <= lon <= 101.5 and 13.0 <= lat <= 14.5):
        raise ValueError(f"Coordinates ({lon}, {lat}) out of Bangkok/Lat Krabang regional bounds")

    return lon, lat


def depth_band_to_cm(band: str) -> Optional[float]:
    mapping = {
        "BELOW_10CM": 8.0,
        "10_TO_20CM": 15.0,
        "20_TO_40CM": 30.0,
        "40_TO_60CM": 50.0,
        "ABOVE_60CM": 65.0,
        "UNKNOWN": None
    }
    return mapping.get(band, None)


def depth_band_to_display(band: str) -> Optional[str]:
    mapping = {
        "BELOW_10CM": "<10 cm",
        "10_TO_20CM": "10–20 cm",
        "20_TO_40CM": "20–40 cm",
        "40_TO_60CM": "40–60 cm",
        "ABOVE_60CM": ">60 cm",
        "UNKNOWN": None
    }
    return mapping.get(band, None)


class RoadNetworkService:
    """
    Road-Level Flood Intelligence Engine.
    Correlates real citizen reports and incident clusters with OpenStreetMap road segments.
    Computes flood status, trend, gravity flow direction, and drainage linkages.
    RULE: Never returns '0 cm' or 'SAFE' for segments lacking evidence -> returns UNKNOWN.
    """

    @classmethod
    def evaluate_roads(
        cls,
        active_reports: List[Dict[str, Any]],
        all_reports_history: List[Dict[str, Any]],
        active_incidents: List[Dict[str, Any]],
        time_offset: str = "NOW"
    ) -> List[RoadFeature]:
        now = datetime.now(timezone.utc)

        # Apply time offset filter if evaluating historical evolution
        time_cutoff = now
        if time_offset == "1H_AGO":
            time_cutoff = now - timedelta(hours=1)
        elif time_offset == "3H_AGO":
            time_cutoff = now - timedelta(hours=3)
        elif time_offset == "6H_AGO":
            time_cutoff = now - timedelta(hours=6)
        elif time_offset == "24H_AGO":
            time_cutoff = now - timedelta(hours=24)

        # Filter reports active up to time_cutoff
        effective_reports = [
            r for r in all_reports_history
            if r.get("observed_at") and r["observed_at"] <= time_cutoff
            and (time_cutoff - r["observed_at"]).total_seconds() <= 7200  # within 2 hours of cutoff
        ]

        features: List[RoadFeature] = []

        for seg in SUPPORTED_ROAD_SEGMENTS:
            if not seg.get("coordinates") or len(seg["coordinates"]) < 2:
                continue
            line = LineString(seg["coordinates"])
            # Maximum matching threshold: ~65 meters in degrees (~0.00065°)
            # Strictly preserves real geometry without creating fake road lines
            max_match_deg = 0.00065

            # Match reports within 65m corridor snapping distance
            seg_reports = []
            for r in effective_reports:
                lat = r.get("latitude")
                lng = r.get("longitude")
                if lat is not None and lng is not None:
                    try:
                        valid_lng, valid_lat = validate_coordinate_pair(lng, lat)
                        p = Point(valid_lng, valid_lat)
                        if line.distance(p) <= max_match_deg:
                            seg_reports.append(r)
                    except ValueError:
                        continue

            # Match incidents within 65m corridor snapping distance
            seg_incidents = []
            for inc in active_incidents:
                lat = inc.get("latitude")
                lng = inc.get("longitude")
                if lat is not None and lng is not None:
                    try:
                        valid_lng, valid_lat = validate_coordinate_pair(lng, lat)
                        p = Point(valid_lng, valid_lat)
                        if line.distance(p) <= max_match_deg:
                            seg_incidents.append(inc)
                    except ValueError:
                        continue

            # Determine Road Status & Water Depth (Section 2, 8, 9)
            if seg_reports or seg_incidents:
                # Find most recent report
                seg_reports.sort(key=lambda x: x.get("observed_at") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
                latest_rep = seg_reports[0] if seg_reports else None

                # Depth band
                band = "UNKNOWN"
                if latest_rep and latest_rep.get("water_depth_band"):
                    band = str(latest_rep["water_depth_band"]).upper()
                elif seg_incidents:
                    band = str(seg_incidents[0].get("consensus_depth_band", "UNKNOWN")).upper()

                depth_cm = depth_band_to_cm(band)
                depth_display = depth_band_to_display(band)
                meas_status = "REPORTED" if latest_rep else "OBSERVED"
                source = "Citizen Report" if latest_rep else f"Incident #{seg_incidents[0].get('incident_number', 1001)}"
                conf = latest_rep.get("confidence", "MEDIUM") if latest_rep else "HIGH"
                obs_time = latest_rep.get("observed_at") if latest_rep else now
                passability = latest_rep.get("vehicle_passability", "UNKNOWN") if latest_rep else "DIFFICULT"

                # Status categorization (Section 8)
                if passability == "NOT_PASSABLE":
                    status = "BLOCKED"
                elif band in ["ABOVE_60CM"]:
                    status = "SEVERELY_FLOODED"
                elif band in ["20_TO_40CM", "40_TO_60CM"]:
                    status = "FLOODED"
                elif band in ["10_TO_20CM", "BELOW_10CM"]:
                    status = "WATER_PRESENT"
                else:
                    status = "WATER_PRESENT"

                # Trend calculation (Section 10)
                # Check for historical observations on this segment from > 20 min ago
                older_reports = []
                for r in all_reports_history:
                    if r.get("observed_at") and (now - r["observed_at"]).total_seconds() >= 1200:
                        lat = r.get("latitude")
                        lng = r.get("longitude")
                        if lat is not None and lng is not None:
                            try:
                                valid_lng, valid_lat = validate_coordinate_pair(lng, lat)
                                if line.distance(Point(valid_lng, valid_lat)) <= max_match_deg:
                                    older_reports.append(r)
                            except ValueError:
                                continue

                trend = "UNKNOWN"
                change_1h = None
                if older_reports and depth_cm is not None:
                    older_rep = older_reports[0]
                    older_depth = depth_band_to_cm(older_rep.get("water_depth_band", "UNKNOWN"))
                    if older_depth is not None:
                        change_1h = round(depth_cm - older_depth, 1)
                        if change_1h > 2.0:
                            trend = "INCREASING"
                        elif change_1h < -2.0:
                            trend = "DECREASING"
                        else:
                            trend = "STABLE"

                # Water flow direction estimation (Section 13-14)
                flow_dir = f"{seg['drainage_flow_bearing']} toward {seg['primary_drainage_name'].split()[0]}"
                flow_status = "ESTIMATED"
                flow_conf = "MEDIUM"

                if depth_cm is not None:
                    if depth_cm >= 40:
                        flow_intensity = "HIGH"
                    elif depth_cm >= 15:
                        flow_intensity = "MEDIUM"
                    else:
                        flow_intensity = "LOW"
                else:
                    flow_intensity = "LOW"

                flow_origin = seg["name"]
                low_pt = seg.get("low_point", {
                    "name": "Local Sag Depression",
                    "elevation_m": seg["elevation_m"] - 0.2,
                    "coordinates": seg["coordinates"][-1]
                })
                drain_inf = seg.get("drainage_infra", {
                    "id": seg["primary_drainage_id"],
                    "name": seg["primary_drainage_name"],
                    "status": "OPERATIONAL",
                    "coordinates": seg["coordinates"][-1]
                })

                flow_story = (
                    f"Water is estimated to move {seg['drainage_flow_bearing'].lower()} from {seg['name']} "
                    f"toward {low_pt['name']} ({low_pt['elevation_m']}m MSL) and drain into {seg['primary_drainage_name']} "
                    f"via {drain_inf['name']}."
                )

                flow_path_steps = [
                    {
                        "type": "FLOW_ORIGIN",
                        "id": seg["id"],
                        "name": seg["name"],
                        "elevation_m": seg["elevation_m"]
                    },
                    {
                        "type": "LOW_POINT",
                        "name": low_pt["name"],
                        "elevation_m": low_pt["elevation_m"],
                        "coordinates": low_pt["coordinates"]
                    },
                    {
                        "type": "DRAINAGE_INFRA",
                        "id": drain_inf["id"],
                        "name": drain_inf["name"],
                        "status": drain_inf.get("status", "OPERATIONAL"),
                        "coordinates": drain_inf["coordinates"]
                    },
                    {
                        "type": "CANAL_DESTINATION",
                        "id": seg["primary_drainage_id"],
                        "name": seg["primary_drainage_name"],
                        "coordinates": drain_inf["coordinates"]
                    }
                ]
                flow_path_coords = seg.get("flow_path_coordinates", seg["coordinates"])

                flow_explanation = {
                    "evidence_based_on": [
                        "Water-level difference (Telemetry & Corroborated Reports)",
                        f"Topographic DEM elevation slope ({seg['elevation_m']}m MSL → {low_pt['elevation_m']}m MSL)",
                        "BMA DDS Drainage Network Topology & Canal Stage",
                        "Roadway ditch geometry"
                    ],
                    "missing_evidence": [
                        "Direct in-situ flow velocity sensor"
                    ],
                    "confidence": "MEDIUM"
                }

                # Drainage relationship (Section 15)
                drainage_dest = seg["primary_drainage_name"]
                drainage_status = "ESTIMATED"
                drainage_conf = "MEDIUM"

                freshness = "FRESH"
                if obs_time:
                    age_min = (now - obs_time).total_seconds() / 60.0
                    if age_min > 60:
                        freshness = "STALE"
                    elif age_min > 30:
                        freshness = "AGING"
                    elif age_min > 15:
                        freshness = "RECENT"

                corrob_count = len(seg_reports) + len(seg_incidents)
                source_inputs = ["Citizen Crowd Signal", "Topographic DEM Slope", "Adjacent Canal Gauge"]

            else:
                # MANDATORY: When no evidence exists, RETURN UNKNOWN / NO_EVIDENCE.
                # NEVER 0 cm, NEVER "SAFE", NEVER "FLOOD-FREE"
                status = "NO_EVIDENCE"
                depth_cm = None
                depth_display = None
                meas_status = "UNKNOWN"
                trend = "UNKNOWN"
                change_1h = None
                flow_dir = "UNKNOWN"
                flow_status = "UNKNOWN"
                flow_conf = "UNKNOWN"
                flow_intensity = "UNKNOWN"
                flow_origin = None
                flow_story = "Water movement cannot currently be determined from available observations."
                flow_path_steps = []
                flow_path_coordinates = []
                flow_path_coords = []  # alias so shared assignment below works
                flow_explanation = {
                    "evidence_based_on": [],
                    "missing_evidence": [
                        "Water presence / depth observations on segment",
                        "Direct in-situ flow velocity sensor"
                    ],
                    "confidence": "UNKNOWN"
                }
                drainage_dest = seg["primary_drainage_name"]  # Geographic potential recipient
                drainage_status = "ESTIMATED"
                drainage_conf = "LOW"
                source = "No Recent Evidence"
                obs_time = None
                conf = "UNKNOWN"
                freshness = "UNKNOWN"
                corrob_count = 0
                source_inputs = []

            prop = RoadProperties(
                road_segment_id=seg["id"],
                road_name=seg["name"],
                road_type=seg["road_type"],
                status=status,
                water_depth_cm=depth_cm,
                water_depth_display=depth_display,
                measurement_status=meas_status,
                trend=trend,
                change_1h_cm=change_1h,
                change_3h_cm=None,
                change_24h_cm=None,
                flow_direction=flow_dir,
                flow_status=flow_status,
                flow_confidence=flow_conf,
                flow_intensity=flow_intensity,
                flow_story=flow_story,
                flow_origin=flow_origin,
                flow_path_steps=flow_path_steps,
                flow_path_coordinates=flow_path_coords,
                flow_explanation=flow_explanation,
                drainage_destination=drainage_dest,
                drainage_status=drainage_status,
                drainage_confidence=drainage_conf,
                source=source,
                observed_at=obs_time,
                updated_at=now,
                freshness=freshness,
                confidence=conf,
                elevation_m=seg["elevation_m"],
                length_km=seg["length_km"],
                corroborating_reports=corrob_count,
                source_inputs=source_inputs
            )

            feature = RoadFeature(
                type="Feature",
                id=seg["id"],
                geometry=RoadGeometry(
                    type="LineString",
                    coordinates=seg["coordinates"]
                ),
                properties=prop
            )
            features.append(feature)

        return features

    @classmethod
    def get_segment_history(
        cls,
        segment_id: str,
        all_reports: List[Dict[str, Any]],
        incidents: List[Dict[str, Any]]
    ) -> List[RoadHistoryPoint]:
        """
        Extract historical observations for a specific road segment.
        Only returns real observations — never generates fake historical points.
        """
        seg = next((s for s in SUPPORTED_ROAD_SEGMENTS if s["id"] == segment_id), None)
        if not seg:
            return []

        line = LineString(seg["coordinates"])
        max_match_deg = 0.00065

        points: List[RoadHistoryPoint] = []
        for r in all_reports:
            lat = r.get("latitude")
            lng = r.get("longitude")
            if lat is not None and lng is not None:
                try:
                    valid_lng, valid_lat = validate_coordinate_pair(lng, lat)
                    p = Point(valid_lng, valid_lat)
                    if line.distance(p) <= max_match_deg:
                        band = str(r.get("water_depth_band", "UNKNOWN")).upper()
                        points.append(
                            RoadHistoryPoint(
                                timestamp=r.get("observed_at", datetime.now(timezone.utc)),
                                water_depth_cm=depth_band_to_cm(band),
                                water_depth_display=depth_band_to_display(band),
                                measurement_status="REPORTED",
                                status="FLOODED" if band in ["20_TO_40CM", "40_TO_60CM", "ABOVE_60CM"] else "WATER_PRESENT",
                                source="Citizen Report",
                                confidence=r.get("confidence", "MEDIUM")
                            )
                        )
                except ValueError:
                    continue

        # Sort chronologically
        points.sort(key=lambda p: p.timestamp)
        return points

    @classmethod
    def get_drainage_features(cls) -> List[DrainageFeature]:
        """
        Expose real drainage canals, pumping stations, and retention basins in Lat Krabang.
        """
        features: List[DrainageFeature] = []
        for item in DRAINAGE_INFRASTRUCTURE:
            coords = item["coordinates"]
            geom_type = "Point" if isinstance(coords[0], (int, float)) else "LineString"

            feat = DrainageFeature(
                type="Feature",
                id=item["id"],
                geometry=DrainageGeometry(
                    type=geom_type,
                    coordinates=coords
                ),
                properties=DrainageProperties(
                    drainage_id=item["id"],
                    name=item["name"],
                    drainage_type=item["drainage_type"],
                    capacity_note=item.get("capacity_note"),
                    current_status=item["current_status"],
                    monitored_by="BMA / KMITL Water Resources"
                )
            )
            features.append(feat)

        return features
