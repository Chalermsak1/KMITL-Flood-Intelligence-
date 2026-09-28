import enum


class WaterDepthBand(str, enum.Enum):
    BELOW_10CM = "BELOW_10CM"
    DEPTH_10_TO_20CM = "10_TO_20CM"
    DEPTH_20_TO_40CM = "20_TO_40CM"
    DEPTH_40_TO_60CM = "40_TO_60CM"
    ABOVE_60CM = "ABOVE_60CM"
    UNKNOWN = "UNKNOWN"


class VehiclePassability(str, enum.Enum):
    PASSABLE = "PASSABLE"
    DIFFICULT = "DIFFICULT"
    NOT_PASSABLE = "NOT_PASSABLE"
    UNKNOWN = "UNKNOWN"


class TransportType(str, enum.Enum):
    WALK = "WALK"
    MOTORCYCLE = "MOTORCYCLE"
    CAR = "CAR"
    TRUCK = "TRUCK"


class ReportFreshness(str, enum.Enum):
    FRESH = "FRESH"       # 0 - 15 min
    RECENT = "RECENT"     # 15 - 30 min
    AGING = "AGING"       # 30 - 60 min
    STALE = "STALE"       # 60 - 120 min
    EXPIRED = "EXPIRED"   # > 120 min


class ConfidenceLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class IncidentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"
    FALSE_REPORT = "FALSE_REPORT"
    MERGED = "MERGED"


class HelpPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class HelpStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"


class HelpType(str, enum.Enum):
    TRAPPED = "TRAPPED"
    EVACUATION = "EVACUATION"
    FOOD_WATER = "FOOD_WATER"
    MEDICINE = "MEDICINE"
    VULNERABLE_PERSON = "VULNERABLE_PERSON"
    VEHICLE_ASSISTANCE = "VEHICLE_ASSISTANCE"
    OTHER = "OTHER"
