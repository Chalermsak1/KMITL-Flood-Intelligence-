import math
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from shapely.geometry import LineString, Point

# Configurable Routing Penalties (Avoid magic numbers)
PENALTY_CRITICAL_FLOOD = 50.0  # Multiplier for impassable/critical water segments
PENALTY_HIGH_FLOOD = 15.0      # Multiplier for 20-40cm+ water
PENALTY_MEDIUM_FLOOD = 4.0     # Multiplier for 10-20cm water
PENALTY_LOW_FLOOD = 1.2        # Multiplier for low water
PENALTY_UNKNOWN_FLOOD = 2.0    # Uncertainty penalty (not low by default!)

# Core Lat Krabang & KMITL OSM Road Network Corridors
OSM_LAT_KRABANG_SEGMENTS = [
    {
        "id": "SEG_CHALONG_KRUNG_N",
        "name": "Thanon Chalong Krung (North - Industrial Estate)",
        "road_type": "PRIMARY",
        "coordinates": [
            [100.7780, 13.7380],
            [100.7810, 13.7480],
            [100.7830, 13.7550]
        ],
        "length_km": 2.1,
        "base_minutes": 4.5
    },
    {
        "id": "SEG_CHALONG_KRUNG_CAMPUS",
        "name": "Thanon Chalong Krung (KMITL Main Frontage)",
        "road_type": "PRIMARY",
        "coordinates": [
            [100.7750, 13.7270],
            [100.7780, 13.7300],
            [100.7780, 13.7380]
        ],
        "length_km": 1.4,
        "base_minutes": 3.0
    },
    {
        "id": "SEG_LAT_KRABANG_W",
        "name": "Thanon Lat Krabang (West toward Rom Klao)",
        "road_type": "PRIMARY",
        "coordinates": [
            [100.7500, 13.7210],
            [100.7650, 13.7230],
            [100.7750, 13.7270]
        ],
        "length_km": 2.8,
        "base_minutes": 5.5
    },
    {
        "id": "SEG_LAT_KRABANG_E",
        "name": "Thanon Luang Phaeng / Hua Takhe",
        "road_type": "SECONDARY",
        "coordinates": [
            [100.7750, 13.7270],
            [100.7890, 13.7220],
            [100.8020, 13.7180]
        ],
        "length_km": 3.1,
        "base_minutes": 6.0
    },
    {
        "id": "SEG_KMITL_ENGINEERING_LOOP",
        "name": "KMITL Inner Campus Rd (Engineering & Library)",
        "road_type": "TERTIARY",
        "coordinates": [
            [100.7750, 13.7270],
            [100.7740, 13.7300],
            [100.7710, 13.7320],
            [100.7740, 13.7350],
            [100.7780, 13.7380]
        ],
        "length_km": 1.8,
        "base_minutes": 4.0
    },
    {
        "id": "SEG_MOTORWAY_FRONTAGE",
        "name": "Highway 7 Motorway Parallel Frontage Rd",
        "road_type": "SECONDARY",
        "coordinates": [
            [100.7550, 13.7150],
            [100.7700, 13.7160],
            [100.7850, 13.7170]
        ],
        "length_km": 3.4,
        "base_minutes": 6.5
    }
]


class RoutingService:
    """
    Flood-Aware Routing Decision Support Service.
    Evaluates candidate paths based on observed flood exposure, report recency, and uncertainty.
    RULE: Never claims '100% Safe Route' — returns 'LOWER OBSERVED FLOOD EXPOSURE'.
    """

    @classmethod
    def evaluate_segment_risk(
        cls,
        segment: Dict[str, Any],
        active_reports: List[Dict[str, Any]],
        active_incidents: List[Dict[str, Any]]
    ) -> Tuple[str, int, Optional[int]]:
        """
        Evaluate flood exposure of a road segment.
        Returns: (risk_level, corroborating_reports_count, latest_report_age_min)
        """
        line = LineString(segment["coordinates"])
        nearby_reports = 0
        max_depth = "NONE"
        latest_report_min = None

        # Check proximity to user reports (<150m buffer)
        buffer_geom = line.buffer(0.0015) # approx 150m in degrees

        for rep in active_reports:
            p = Point(rep.get("longitude", 0), rep.get("latitude", 0))
            if buffer_geom.contains(p):
                nearby_reports += 1
                age = rep.get("data_age_min", 5)
                if latest_report_min is None or age < latest_report_min:
                    latest_report_min = age
                depth = rep.get("water_depth_band", "")
                if "ABOVE_60CM" in depth or "40_TO_60CM" in depth:
                    max_depth = "CRITICAL"
                elif "20_TO_40CM" in depth and max_depth != "CRITICAL":
                    max_depth = "HIGH"
                elif "10_TO_20CM" in depth and max_depth not in ["CRITICAL", "HIGH"]:
                    max_depth = "MEDIUM"
                elif max_depth == "NONE":
                    max_depth = "LOW"

        # Check proximity to clustered incidents
        for inc in active_incidents:
            ip = Point(inc.get("centroid_longitude", 0), inc.get("centroid_latitude", 0))
            if buffer_geom.contains(ip):
                nearby_reports += inc.get("report_count", 2)
                if max_depth not in ["CRITICAL", "HIGH"]:
                    max_depth = "HIGH"

        if nearby_reports == 0:
            return "UNKNOWN", 0, None  # Rule: No data = UNKNOWN, not LOW!

        if max_depth in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
            return max_depth, nearby_reports, latest_report_min or 5

        return "UNKNOWN", nearby_reports, latest_report_min

    @classmethod
    def find_routes(
        cls,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        mode: str = "CAR",
        active_reports: Optional[List[Dict[str, Any]]] = None,
        active_incidents: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Compute 2–3 candidate routes and assess flood risk per segment.
        """
        reports = active_reports or []
        incidents = active_incidents or []

        # Evaluate all network segments
        evaluated_segments = []
        for seg in OSM_LAT_KRABANG_SEGMENTS:
            risk, count, age = cls.evaluate_segment_risk(seg, reports, incidents)
            evaluated_segments.append({
                **seg,
                "flood_exposure": risk,
                "evidence_count": count,
                "latest_report_age_min": age
            })

        # Build Candidate Route A: Direct Arterial Corridor
        route_a_segs = [evaluated_segments[2], evaluated_segments[1]] # Lat Krabang W -> Chalong Krung Campus
        # Candidate Route B: Inner Campus Ring (Detour with lower water exposure)
        route_b_segs = [evaluated_segments[2], evaluated_segments[4]] # Lat Krabang W -> Engineering loop
        # Candidate Route C: Motorway Frontage bypass
        route_c_segs = [evaluated_segments[5], evaluated_segments[3]]

        routes_data = []
        candidates = [
            ("Route A — Chalong Krung Direct Corridor", route_a_segs),
            ("Route B — Lower Observed Flood Exposure (Campus Ring)", route_b_segs),
            ("Route C — Motorway Frontage Alternate", route_c_segs)
        ]

        for title, segs in candidates:
            total_dist = sum(s["length_km"] for s in segs)
            base_time = sum(s["base_minutes"] for s in segs)
            
            # Combine segment exposure
            exposures = [s["flood_exposure"] for s in segs]
            overall_exposure = "LOW"
            if "CRITICAL" in exposures:
                overall_exposure = "CRITICAL"
            elif "HIGH" in exposures:
                overall_exposure = "HIGH"
            elif "MEDIUM" in exposures:
                overall_exposure = "MEDIUM"
            elif "UNKNOWN" in exposures:
                overall_exposure = "UNKNOWN"

            # Compute route penalty multiplier
            penalty = 1.0
            if overall_exposure == "CRITICAL":
                penalty = PENALTY_CRITICAL_FLOOD
            elif overall_exposure == "HIGH":
                penalty = PENALTY_HIGH_FLOOD
            elif overall_exposure == "MEDIUM":
                penalty = PENALTY_MEDIUM_FLOOD
            elif overall_exposure == "UNKNOWN":
                penalty = PENALTY_UNKNOWN_FLOOD

            est_time = round(base_time * min(penalty, 3.5), 1) # Time slowed by flood
            evidence_count = sum(s["evidence_count"] for s in segs)
            min_ages = [s["latest_report_age_min"] for s in segs if s["latest_report_age_min"] is not None]
            latest_age = min(min_ages) if min_ages else None

            # Merge coordinates into single LineString geometry
            merged_coords = []
            for s in segs:
                for coord in s["coordinates"]:
                    if not merged_coords or merged_coords[-1] != coord:
                        merged_coords.append(coord)

            routes_data.append({
                "route_id": str(uuid.uuid4()),
                "name": title,
                "recommendation_label": "LOWER OBSERVED FLOOD EXPOSURE" if overall_exposure in ["LOW", "MEDIUM"] else "HIGH FLOOD EXPOSURE OBSERVED",
                "distance_km": round(total_dist, 1),
                "estimated_travel_minutes": est_time,
                "flood_exposure": overall_exposure,
                "evidence_count": evidence_count,
                "latest_observation_age_min": latest_age,
                "disclaimer": "Conditions can change rapidly during monsoon downpours. Drive with caution.",
                "geometry": {
                    "type": "LineString",
                    "coordinates": merged_coords
                },
                "segments": [
                    {
                        "id": s["id"],
                        "name": s["name"],
                        "length_km": s["length_km"],
                        "flood_exposure": s["flood_exposure"]
                    }
                    for s in segs
                ]
            })

        # Sort candidate routes: lowest flood exposure first, then fastest time
        exposure_rank = {"LOW": 1, "MEDIUM": 2, "UNKNOWN": 3, "HIGH": 4, "CRITICAL": 5}
        routes_data.sort(key=lambda r: (exposure_rank.get(r["flood_exposure"], 3), r["estimated_travel_minutes"]))

        return {
            "origin": {"lat": origin_lat, "lng": origin_lng},
            "destination": {"lat": dest_lat, "lng": dest_lng},
            "mode": mode,
            "routes": routes_data,
            "evaluated_at": datetime.now(timezone.utc).isoformat()
        }
