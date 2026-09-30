export interface MetaEnvelope {
  source: string;
  observed_at: string;
  ingested_at: string;
  data_age_seconds: number;
  freshness: "FRESH" | "RECENT" | "AGING" | "STALE" | "EXPIRED";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  attribution: string;
  mode: "LIVE" | "DEMO";
}

export interface StandardResponse<T> {
  data: T;
  meta: MetaEnvelope;
}

export interface SituationSummary {
  area_name: string;
  current_status: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "UNKNOWN";
  overall_risk_score: number;
  rain_trend: "NONE" | "LIGHT" | "MODERATE" | "HEAVY" | "VERY_HEAVY";
  water_trend: "RISING" | "STABLE" | "FALLING";
  active_incidents: number;
  active_help_requests: number;
  data_quality: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
  explanation: string[];
  last_updated: string;
  data_sources_available: number;
  data_sources_total: number;
}

export interface FloodReport {
  id: string;
  latitude: number;
  longitude: number;
  water_depth_band: "BELOW_10CM" | "10_TO_20CM" | "20_TO_40CM" | "40_TO_60CM" | "ABOVE_60CM" | "UNKNOWN";
  vehicle_passability: "PASSABLE" | "DIFFICULT" | "NOT_PASSABLE" | "UNKNOWN";
  transport_type: "WALK" | "MOTORCYCLE" | "CAR" | "TRUCK";
  description?: string;
  photo_url?: string;
  verification_status: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  freshness: "FRESH" | "RECENT" | "AGING" | "STALE" | "EXPIRED";
  observed_at: string;
  data_age_min: number;
  incident_id?: string;
}

export interface Incident {
  id: string;
  incident_number: number;
  title: string;
  latitude: number;
  longitude: number;
  report_count: number;
  consensus_depth_band: "BELOW_10CM" | "10_TO_20CM" | "20_TO_40CM" | "40_TO_60CM" | "ABOVE_60CM" | "UNKNOWN";
  consensus_passability: "PASSABLE" | "DIFFICULT" | "NOT_PASSABLE" | "UNKNOWN";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  status: "ACTIVE" | "RESOLVED" | "FALSE_REPORT" | "MERGED";
  first_reported_at: string;
  last_reported_at: string;
  last_report_age_min: number;
  admin_notes?: string;
}

export interface WaterStation {
  id: string;
  name: string;
  station_type: string;
  latitude: number;
  longitude: number;
  warning_threshold_meters?: number;
  critical_threshold_meters?: number;
  current_level_m_msl?: number;
  trend?: string;
  last_observed_at?: string;
  data_age_min?: number;
}

export interface RainObservation {
  id: number;
  source_id: string;
  rain_rate_mm_hr: number;
  rain_intensity_band: string;
  reflectivity_dbz?: number;
  observed_at: string;
  data_age_min: number;
  coverage_area: string;
}

export interface SatelliteObservation {
  id: string;
  source_id: string;
  satellite_name: string;
  spatial_resolution_meters: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  acquisition_at: string;
  processed_at: string;
  data_age_hours: number;
  water_polygons_geojson: any;
  disclaimer: string;
}

export interface AssistancePoint {
  id: string;
  name: string;
  point_type: "SHELTER" | "MEDICAL" | "FOOD_WATER" | "BOAT_PICKUP" | string;
  latitude: number;
  longitude: number;
  capacity?: number;
  current_occupancy: number;
  is_verified: boolean;
  contact_number?: string;
  operating_hours?: string;
  last_verified_at?: string;
}

export interface HelpRequest {
  id: string;
  ticket_number: number;
  requester_name?: string;
  contact_phone?: string;
  latitude: number;
  longitude: number;
  help_type: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  people_count: number;
  vulnerable_details?: string;
  current_water_level?: string;
  description?: string;
  status: "OPEN" | "ACKNOWLEDGED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED";
  assigned_to?: string;
  created_at: string;
}

export interface WebSocketEvent {
  event: "REPORT_CREATED" | "INCIDENT_UPDATED" | "WATER_UPDATED" | "RAIN_UPDATED" | "RISK_CHANGED" | "HELP_REQUEST_CREATED";
  timestamp: string;
  payload: any;
}

export interface DataSourceStatus {
  source_id: string;
  name: string;
  full_name?: string;
  status: string;
  mode: "LIVE" | "OBSERVATION" | "DEMO" | "STALE" | "UNAVAILABLE";
  last_updated: string | null;
  data_age_seconds: number | null;
  latency_ms: number;
  error_rate: number;
  notes?: string;
  is_satellite_observational?: boolean;
}

export interface SubsystemStatus {
  subsystem: string;
  status: "LIVE" | "OBSERVATION" | "PENDING_ACCESS" | "UNAVAILABLE" | "DEGRADED";
  category: string;
  notes: string;
}

export interface RouteSegment {
  id: string;
  name: string;
  length_km: number;
  flood_exposure: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
}

export interface RouteCandidate {
  route_id: string;
  name: string;
  recommendation_label: string;
  distance_km: number;
  estimated_travel_minutes: number;
  flood_exposure: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
  evidence_count: number;
  latest_observation_age_min: number | null;
  disclaimer: string;
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
  segments: RouteSegment[];
}

export interface RouteEvaluationData {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode: string;
  routes: RouteCandidate[];
  evaluated_at: string;
}

export interface ReplaySnapshot {
  snapshot_timestamp: string;
  time_label: string;
  rain_intensity: string;
  rainfall_rate_mm: number;
  canal_water_level_m: number;
  canal_status: string;
  active_reports_count: number;
  active_incidents_count: number;
  risk_level: string;
  risk_score: number;
  satellite_available: boolean;
  satellite_note?: string;
  summary: string;
}

export interface ReplayTimelineData {
  event: {
    id: string;
    name: string;
    area: string;
    start_at: string;
    end_at: string;
    peak_risk: string;
    peak_reports: number;
    description: string;
    source: string;
    mode: string;
  };
  timeline: ReplaySnapshot[];
  playback_speeds: string[];
  mode: string;
}

export interface RoadProperties {
  road_segment_id: string;
  road_name: string;
  road_type: string;
  status: "NO_EVIDENCE" | "WATER_PRESENT" | "FLOODED" | "SEVERELY_FLOODED" | "BLOCKED" | "UNKNOWN";
  water_depth_cm?: number | null;
  water_depth_display?: string | null;
  measurement_status: "OBSERVED" | "REPORTED" | "ESTIMATED" | "UNKNOWN";
  trend: "INCREASING" | "DECREASING" | "STABLE" | "UNKNOWN";
  change_1h_cm?: number | null;
  change_3h_cm?: number | null;
  change_24h_cm?: number | null;
  flow_direction?: string | null;
  flow_status: "OBSERVED" | "ESTIMATED" | "UNKNOWN";
  flow_confidence: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  flow_intensity?: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  flow_story?: string | null;
  flow_origin?: string | null;
  flow_path_steps?: Array<{
    type: "FLOW_ORIGIN" | "ROAD_SEGMENT" | "LOW_POINT" | "DRAINAGE_INFRA" | "CANAL_DESTINATION" | string;
    id?: string;
    name: string;
    elevation_m?: number | null;
    status?: string;
    coordinates?: [number, number];
  }>;
  flow_path_coordinates?: [number, number][];
  flow_explanation?: {
    evidence_based_on: string[];
    missing_evidence: string[];
    confidence: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  } | null;
  drainage_destination?: string | null;
  drainage_status: "ESTIMATED" | "UNKNOWN";
  drainage_confidence: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  source: string;
  observed_at?: string | null;
  updated_at: string;
  freshness: string;
  confidence: string;
  elevation_m: number;
  length_km: number;
  corroborating_reports: number;
  source_inputs: string[];
}

export interface RoadFeature {
  type: "Feature";
  id: string;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties: RoadProperties;
}

export interface RoadCollectionResponse {
  type: "FeatureCollection";
  features: RoadFeature[];
  time_offset: string;
}

export interface RoadHistoryPoint {
  timestamp: string;
  water_depth_cm?: number | null;
  water_depth_display?: string | null;
  measurement_status: string;
  status: string;
  source: string;
  confidence: string;
}

export interface DrainageFeature {
  type: "Feature";
  id: string;
  geometry: {
    type: "LineString" | "Point";
    coordinates: any;
  };
  properties: {
    drainage_id: string;
    name: string;
    drainage_type: string;
    capacity_note?: string;
    current_status: string;
    monitored_by: string;
  };
}

export interface DrainageCollectionResponse {
  type: "FeatureCollection";
  features: DrainageFeature[];
}

export interface SelectedFeature {
  type: "INCIDENT" | "CITIZEN_REPORT" | "WATER_STATION" | "SHELTER" | "SATELLITE" | "ROAD_SEGMENT" | "DRAINAGE";
  title: string;
  source: string;
  timestamp: string;
  status: string;
  confidence: "LOW" | "MEDIUM" | "HIGH" | string;
  measurements: Record<string, string | number | undefined>;
  provenance: {
    mode: "LIVE" | "OBSERVATION" | "DEMO" | "PENDING_ACCESS" | "UNVERIFIED" | "REPORTED" | "ESTIMATED";
    attribution: string;
    notes?: string;
  };
  raw?: any;
}

export type LocationContextType =
  | "CURRENT_LOCATION"
  | "HOME_LOCATION"
  | "WATCH_LOCATION"
  | "DESTINATION"
  | "REPORT_LOCATION";

export interface LocationTarget {
  id: string;
  name: string;
  type: LocationContextType;
  lat: number;
  lng: number;
  zoom?: number;
  description?: string;
  isHome?: boolean;
  accuracy?: number;
  timestamp?: number;
}

export interface UserLocationState {
  current_location: LocationTarget | null;
  selected_monitoring_location: LocationTarget;
  home_location: LocationTarget | null;
  saved_locations: LocationTarget[];
  route_origin: LocationTarget | null;
  route_destination: LocationTarget | null;
}
