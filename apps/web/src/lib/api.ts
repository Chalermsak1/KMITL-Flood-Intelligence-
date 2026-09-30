import {
  StandardResponse,
  SituationSummary,
  Incident,
  FloodReport,
  WaterStation,
  RainObservation,
  SatelliteObservation,
  AssistancePoint,
  HelpRequest,
  DataSourceStatus,
  SubsystemStatus,
  RouteEvaluationData,
  ReplayTimelineData,
  RoadCollectionResponse,
  RoadHistoryPoint,
  DrainageCollectionResponse
} from "./types";

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    // If the browser is accessing via a public domain, tunnel, or IP (NOT local host/127.0.0.1):
    // ALWAYS use same-origin relative URLs ("") so requests go through the HTTPS reverse proxy,
    // completely eliminating Mixed Content blocks and unreachable client-side 127.0.0.1 errors!
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return "";
    }
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return "http://localhost:8000";
}


async function fetchJSON<T>(path: string): Promise<StandardResponse<T>> {
  const base = getApiBase();
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { next: { revalidate: 15 } });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`Fetch failed for ${url}:`, err);
    throw err;
  }
}

export const api = {
  getSituationSummary: () => fetchJSON<SituationSummary>("/api/v1/situation/summary"),
  getIncidents: (bbox?: string) => fetchJSON<Incident[]>(bbox ? `/api/v1/incidents?bbox=${bbox}` : "/api/v1/incidents"),
  getReports: (bbox?: string) => fetchJSON<FloodReport[]>(bbox ? `/api/v1/reports?bbox=${bbox}` : "/api/v1/reports"),
  getWaterStations: () => fetchJSON<WaterStation[]>("/api/v1/water-stations"),
  getRain: () => fetchJSON<RainObservation>("/api/v1/rain/current"),
  getSatellite: () => fetchJSON<SatelliteObservation>("/api/v1/satellite/latest"),
  getShelters: () => fetchJSON<AssistancePoint[]>("/api/v1/shelters"),
  getHelpRequests: () => fetchJSON<HelpRequest[]>("/api/v1/help"),
  getDataStatus: () => fetchJSON<{ sources: DataSourceStatus[]; subsystems?: SubsystemStatus[]; governance?: any }>("/api/v1/data-status"),
  getMetrics: () => fetchJSON<any>("/api/v1/metrics"),
  getRoadsStatus: async (timeOffset: string = "NOW"): Promise<RoadCollectionResponse> => {
    const base = getApiBase();
    const res = await fetch(`${base}/api/v1/roads/status?time_offset=${encodeURIComponent(timeOffset)}`);
    if (!res.ok) throw new Error(`Road status fetch failed: ${res.status}`);
    return await res.json();
  },
  getRoadHistory: async (segmentId: string): Promise<RoadHistoryPoint[]> => {
    const base = getApiBase();
    const res = await fetch(`${base}/api/v1/roads/${encodeURIComponent(segmentId)}/history`);
    if (!res.ok) throw new Error(`Road history fetch failed: ${res.status}`);
    return await res.json();
  },
  getDrainageNetwork: async (): Promise<DrainageCollectionResponse> => {
    const base = getApiBase();
    const res = await fetch(`${base}/api/v1/drainage/network`);
    if (!res.ok) throw new Error(`Drainage network fetch failed: ${res.status}`);
    return await res.json();
  },


  postReport: async (payload: {
    latitude: number;
    longitude: number;
    water_depth_band: string;
    vehicle_passability: string;
    transport_type: string;
    description?: string;
    photo_url?: string;
  }): Promise<StandardResponse<FloodReport>> => {
    const base = getApiBase();
    const res = await fetch(`${base}/api/v1/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Report submission failed: ${res.status}`);
    return await res.json();
  },

  verifyImage: async (file: File, lat?: number, lng?: number): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    const base = getApiBase();
    let url = `${base}/api/v1/reports/verify-image`;
    if (lat !== undefined && lng !== undefined) {
      url += `?latitude=${lat}&longitude=${lng}`;
    }
    const res = await fetch(url, {
      method: "POST",
      body: formData
    });
    if (!res.ok) throw new Error(`Image verification failed: ${res.status}`);
    return await res.json();
  },

  postHelpRequest: async (payload: {
    latitude: number;
    longitude: number;
    help_type: string;
    priority?: string;
    requester_name?: string;
    contact_phone?: string;
    people_count?: number;
    vulnerable_details?: string;
    current_water_level?: string;
    description?: string;
  }): Promise<StandardResponse<HelpRequest>> => {
    const base = getApiBase();
    const res = await fetch(`${base}/api/v1/help`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Help request failed: ${res.status}`);
    return await res.json();
  },

  evaluateRoute: async (payload: {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    mode?: string;
  }): Promise<StandardResponse<RouteEvaluationData>> => {
    const base = getApiBase();
    const res = await fetch(`${base}/api/v1/routes/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Route evaluation failed: ${res.status}`);
    return await res.json();
  },

  getReplayTimeline: (eventId: string = "e7b0c3a1-5f28-4e89-9a14-b8163f458129") =>
    fetchJSON<ReplayTimelineData>(`/api/v1/replay/events/${eventId}/timeline`),

  // Operator Actions
  overrideReport: async (reportId: string, action: string, reason?: string): Promise<any> => {
    const base = getApiBase();
    let url = `${base}/api/v1/admin/reports/${reportId}/override?action=${encodeURIComponent(action)}`;
    if (reason) {
      url += `&reason=${encodeURIComponent(reason)}`;
    }
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error(`Report override failed: ${res.status}`);
    return await res.json();
  },

  updateIncidentStatus: async (incidentId: string, action: string, notes?: string): Promise<any> => {
    const base = getApiBase();
    let url = `${base}/api/v1/admin/incidents/${incidentId}/status?action=${encodeURIComponent(action)}`;
    if (notes) {
      url += `&notes=${encodeURIComponent(notes)}`;
    }
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error(`Incident status update failed: ${res.status}`);
    return await res.json();
  }
};
