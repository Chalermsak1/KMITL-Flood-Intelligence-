"""
Beta Geofence Service — Phase 26
=================================
Classifies every user-submitted coordinate against the defined beta zones.

Zone A: KMITL campus + immediately surrounding roads (tightest coverage)
Zone B: Selected Lat Krabang corridors connected to KMITL

Outside either zone: service coverage is explicitly limited.

Coverage classification vocabulary:
  IN_ZONE_A       — inside KMITL campus perimeter
  IN_ZONE_B       — inside Lat Krabang beta corridors
  OUTSIDE_BETA    — outside both zones; limited or no coverage guarantee
  UNKNOWN_LOCATION — coordinates missing, invalid, or null
"""
from typing import Tuple, Literal
from app.core.config import settings

CoverageZone = Literal["IN_ZONE_A", "IN_ZONE_B", "OUTSIDE_BETA", "UNKNOWN_LOCATION"]


def classify_coverage(
    latitude: float | None,
    longitude: float | None
) -> CoverageZone:
    """
    Classify a coordinate against beta zone boundaries.

    Returns one of:
      IN_ZONE_A       — full KMITL campus coverage
      IN_ZONE_B       — Lat Krabang corridor coverage (beta)
      OUTSIDE_BETA    — outside both zones; explicitly limited coverage
      UNKNOWN_LOCATION — null or invalid coordinates
    """
    if latitude is None or longitude is None:
        return "UNKNOWN_LOCATION"
    try:
        lat, lng = float(latitude), float(longitude)
    except (TypeError, ValueError):
        return "UNKNOWN_LOCATION"

    # Sanity check: must be plausible Thailand coordinates
    if not (12.0 <= lat <= 21.0 and 97.0 <= lng <= 106.0):
        return "UNKNOWN_LOCATION"

    # Zone A check (most specific — KMITL campus)
    if (settings.ZONE_A_MIN_LAT <= lat <= settings.ZONE_A_MAX_LAT and
            settings.ZONE_A_MIN_LNG <= lng <= settings.ZONE_A_MAX_LNG):
        return "IN_ZONE_A"

    # Zone B check (Lat Krabang corridors)
    if (settings.FEATURE_FLAG_BETA_LATKRABANG_ENABLED and
            settings.ZONE_B_MIN_LAT <= lat <= settings.ZONE_B_MAX_LAT and
            settings.ZONE_B_MIN_LNG <= lng <= settings.ZONE_B_MAX_LNG):
        return "IN_ZONE_B"

    return "OUTSIDE_BETA"


def coverage_warning_message(zone: CoverageZone) -> str | None:
    """Return a user-facing warning when coverage is limited. None = no warning needed."""
    if zone == "OUTSIDE_BETA":
        return (
            "Coverage is limited in this beta area. "
            "Data quality and incident clustering may be reduced outside the KMITL / Lat Krabang beta zone."
        )
    if zone == "UNKNOWN_LOCATION":
        return "Location could not be determined. Coverage classification unavailable."
    return None  # IN_ZONE_A or IN_ZONE_B — no warning needed


def is_within_beta(latitude: float | None, longitude: float | None) -> bool:
    """Convenience function: True if coordinate is within any beta zone."""
    zone = classify_coverage(latitude, longitude)
    return zone in ("IN_ZONE_A", "IN_ZONE_B")


def get_zone_metadata() -> dict:
    """Return beta zone boundary metadata for API/frontend consumption."""
    return {
        "beta_version": "26.0",
        "zones": {
            "ZONE_A": {
                "name": "KMITL Campus & Immediate Roads",
                "status": "ACTIVE",
                "bounds": {
                    "min_lat": settings.ZONE_A_MIN_LAT,
                    "min_lng": settings.ZONE_A_MIN_LNG,
                    "max_lat": settings.ZONE_A_MAX_LAT,
                    "max_lng": settings.ZONE_A_MAX_LNG,
                },
                "coverage_guarantee": "FULL_BETA",
            },
            "ZONE_B": {
                "name": "Lat Krabang Beta Corridors",
                "status": "ACTIVE" if settings.FEATURE_FLAG_BETA_LATKRABANG_ENABLED else "DISABLED",
                "bounds": {
                    "min_lat": settings.ZONE_B_MIN_LAT,
                    "min_lng": settings.ZONE_B_MIN_LNG,
                    "max_lat": settings.ZONE_B_MAX_LAT,
                    "max_lng": settings.ZONE_B_MAX_LNG,
                },
                "coverage_guarantee": "LIMITED_BETA",
            }
        },
        "outside_beta_policy": "COVERAGE_LIMITED — data quality not guaranteed outside defined zones.",
    }
