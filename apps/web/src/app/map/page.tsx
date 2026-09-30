"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { LayerControl, LayerState } from "../../components/map/LayerControl";
import { MarkerDetailPanel } from "../../components/map/MarkerDetailPanel";
import { RoadDetailPanel } from "../../components/map/RoadDetailPanel";
import { FlowLegend } from "../../components/map/FlowLegend";
import { MapDisplayMode } from "../../components/map/FloodMap";
import { api } from "../../lib/api";
import {
  Incident,
  FloodReport,
  WaterStation,
  AssistancePoint,
  SatelliteObservation,
  WebSocketEvent,
  SelectedFeature,
  RoadCollectionResponse,
  RoadProperties,
  DrainageCollectionResponse
} from "../../lib/types";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useLocationContext } from "../../hooks/useLocationContext";
import {
  AlertTriangle,
  Clock,
  RefreshCw,
  X,
  WifiOff,
  Sun,
  Satellite,
  Search,
  MapPin,
  Layers,
  Compass,
  Target,
  Home,
  Navigation2
} from "lucide-react";

const FloodMap = dynamic(
  () => import("../../components/map/FloodMap").then((mod) => mod.FloodMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-500 gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="font-mono text-xs text-blue-700 dark:text-blue-400">Loading MapLibre Tactical Canvas...</p>
      </div>
    ),
  }
);

const CAMPUS_LOCATIONS = [
  { name: "Engineering Gate", lat: 13.7298, lng: 100.7782, zoom: 16 },
  { name: "ECC Building", lat: 13.7278, lng: 100.7749, zoom: 16 },
  { name: "Central Library", lat: 13.7289, lng: 100.7765, zoom: 16 },
  { name: "Chalong Krung Gate 1", lat: 13.7314, lng: 100.7812, zoom: 16 },
  { name: "ARL Lat Krabang", lat: 13.7275, lng: 100.7483, zoom: 15 },
  { name: "Hua Takhe Market", lat: 13.7215, lng: 100.7895, zoom: 15 }
];

function detectLowBandwidth(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (conn) {
    const slowTypes = ["slow-2g", "2g"];
    if (slowTypes.includes(conn.effectiveType)) return true;
    if (conn.downlink !== undefined && conn.downlink < 1.0) return true;
  }
  return false;
}

function SatelliteAgeLabel({ satellite, mounted }: { satellite: SatelliteObservation | null; mounted?: boolean }) {
  if (!satellite || !mounted) return null;
  const acqTime = satellite.acquisition_at ? new Date(satellite.acquisition_at) : null;
  const ageMs = acqTime ? Date.now() - acqTime.getTime() : null;
  const ageHours = ageMs ? Math.round(ageMs / 3600000) : null;
  const ageLabel = ageHours === null ? "Unknown age"
    : ageHours < 1 ? "< 1 hour ago"
    : ageHours < 24 ? `${ageHours}h ago`
    : `${Math.round(ageHours / 24)}d ago`;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-purple-50 text-purple-800 border border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 shadow-sm"
      title="Sentinel-1 SAR acquisition. Observational evidence, not real-time street water depth."
    >
      <Satellite className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
      <span>OBSERVATION — Acquired {ageLabel}</span>
    </span>
  );
}

export default function MapPage() {
  const [layers, setLayers] = useState<LayerState>({
    floodStatus: true,
    waterDepth: true,
    floodTrend: true,
    waterFlow: true,
    drainage: true,
    incidents: true,
    reports: true,
    waterStations: true,
    rain: true,
    satellite: false,
    shelters: true,
  });

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [reports, setReports] = useState<FloodReport[]>([]);
  const [waterStations, setWaterStations] = useState<WaterStation[]>([]);
  const [shelters, setShelters] = useState<AssistancePoint[]>([]);
  const [satellite, setSatellite] = useState<SatelliteObservation | null>(null);
  const [roads, setRoads] = useState<RoadCollectionResponse | null>(null);
  const [drainage, setDrainage] = useState<DrainageCollectionResponse | null>(null);
  const [satelliteLoaded, setSatelliteLoaded] = useState(false);
  const [satelliteLoading, setSatelliteLoading] = useState(false);
  const {
    currentLocation,
    selectedMonitoringLocation,
    homeLocation,
    gpsLoading,
    requestCurrentLocation,
    setMonitoringLocation,
    savedLocations
  } = useLocationContext();

  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
  const [selectedRoad, setSelectedRoad] = useState<RoadProperties | null>(null);
  const [activeTraceRoad, setActiveTraceRoad] = useState<RoadProperties | null>(null);
  const [mapMode, setMapMode] = useState<MapDisplayMode>("FLOOD_CONDITION");
  const [timeOffset, setTimeOffset] = useState<"NOW" | "1H" | "3H" | "6H" | "24H">("NOW");
  const [centerTarget, setCenterTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  useEffect(() => {
    if (selectedMonitoringLocation) {
      setCenterTarget({
        lat: selectedMonitoringLocation.lat,
        lng: selectedMonitoringLocation.lng,
        zoom: selectedMonitoringLocation.zoom || 15.5
      });
    }
  }, [selectedMonitoringLocation]);

  // Center map on user's real physical GPS location without affecting monitoring target
  const handleFlyToCurrentLocation = useCallback(() => {
    if (currentLocation) {
      setCenterTarget({
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        zoom: 16
      });
    } else {
      requestCurrentLocation((loc) => {
        setCenterTarget({
          lat: loc.lat,
          lng: loc.lng,
          zoom: 16
        });
      });
    }
  }, [currentLocation, requestCurrentLocation]);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  const [isLowBandwidth, setIsLowBandwidth] = useState(false);
  const [showLowBwBanner, setShowLowBwBanner] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    setMounted(true);
    const detected = detectLowBandwidth();
    setIsLowBandwidth(detected);
    if (detected) setShowLowBwBanner(true);
  }, []);

  const loadCoreData = useCallback(async (offset: string = timeOffset) => {
    try {
      const [incRes, repRes, waterRes, shelterRes, roadsRes, drainRes] = await Promise.allSettled([
        api.getIncidents(),
        api.getReports(),
        api.getWaterStations(),
        api.getShelters(),
        api.getRoadsStatus(offset),
        api.getDrainageNetwork(),
      ]);
      if (incRes.status === "fulfilled" && incRes.value?.data) setIncidents(incRes.value.data);
      if (repRes.status === "fulfilled" && repRes.value?.data) setReports(repRes.value.data);
      if (waterRes.status === "fulfilled" && waterRes.value?.data) setWaterStations(waterRes.value.data);
      if (shelterRes.status === "fulfilled" && shelterRes.value?.data) setShelters(shelterRes.value.data);
      if (roadsRes.status === "fulfilled" && roadsRes.value?.features) {
        setRoads(roadsRes.value);
        if (activeTraceRoad) {
          const match = roadsRes.value.features.find(
            (f: any) => f.properties.road_segment_id === activeTraceRoad.road_segment_id
          );
          if (match) {
            setActiveTraceRoad(match.properties);
          }
        }
      }
      if (drainRes.status === "fulfilled" && drainRes.value?.features) setDrainage(drainRes.value);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Map data refresh error:", err);
    }
  }, [timeOffset, activeTraceRoad]);

  const handleTimeChange = (offset: "NOW" | "1H" | "3H" | "6H" | "24H") => {
    setTimeOffset(offset);
    loadCoreData(offset);
  };

  const loadSatellite = useCallback(async () => {
    if (satelliteLoading || satelliteLoaded) return;
    setSatelliteLoading(true);
    try {
      const satRes = await api.getSatellite();
      setSatellite(satRes.data);
      setSatelliteLoaded(true);
    } catch (err) {
      console.error("Satellite load error:", err);
    } finally {
      setSatelliteLoading(false);
    }
  }, [satelliteLoading, satelliteLoaded]);

  const prevSatelliteLayer = useRef(layers.satellite);
  useEffect(() => {
    if (layers.satellite && !prevSatelliteLayer.current) {
      loadSatellite();
    }
    prevSatelliteLayer.current = layers.satellite;
  }, [layers.satellite, loadSatellite]);

  const handleWsEvent = useCallback((event: WebSocketEvent) => {
    if (event.event === "INCIDENT_UPDATED" || event.event === "REPORT_CREATED") {
      loadCoreData();
    }
  }, [loadCoreData]);

  const { isConnected, transportMode } = useWebSocket({ onEvent: handleWsEvent });

  useEffect(() => {
    loadCoreData();
    if (!detectLowBandwidth()) {
      loadSatellite();
    }
  }, [loadCoreData, loadSatellite]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const match = CAMPUS_LOCATIONS.find(loc =>
      loc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (match) {
      setCenterTarget({ lat: match.lat, lng: match.lng, zoom: match.zoom });
    }
  };

  const handleSelectFeature = useCallback((feat: SelectedFeature) => {
    setSelectedFeature(feat);
    setSelectedRoad(null);
  }, []);

  const handleSelectRoad = useCallback((road: RoadProperties) => {
    setSelectedRoad(road);
    setSelectedFeature(null);
    if (mapMode === "WATER_MOVEMENT" && road.flow_path_coordinates && road.flow_path_coordinates.length >= 2) {
      setActiveTraceRoad(road);
    }
  }, [mapMode]);

  return (
    <div className={`relative flex-1 w-full h-[calc(100vh-6.5rem)] overflow-hidden bg-slate-100 dark:bg-slate-900 ${highContrast ? "high-contrast-map" : ""}`}>
      {/* LOW BANDWIDTH BANNER */}
      {showLowBwBanner && (
        <div className="absolute top-0 left-0 right-0 z-40 px-4 py-2 bg-amber-600 text-white font-mono text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              <strong>LOW BANDWIDTH:</strong> Satellite SAR layer deferred to conserve bandwidth. Incidents and reports remain live.
            </span>
          </div>
          <button
            onClick={() => setShowLowBwBanner(false)}
            className="text-white hover:opacity-80 font-bold px-2 py-0.5"
            aria-label="Dismiss bandwidth notice"
          >
            ✕
          </button>
        </div>
      )}

      {/* FULL-SCREEN MAPLIBRE CANVAS */}
      <FloodMap
        layers={layers}
        roads={roads}
        drainage={drainage}
        incidents={incidents}
        reports={reports}
        waterStations={waterStations}
        shelters={shelters}
        satellite={layers.satellite && satelliteLoaded ? satellite : null}
        centerTarget={centerTarget}
        currentLocation={currentLocation}
        monitoredLocation={selectedMonitoringLocation}
        onRequestCurrentLocation={handleFlyToCurrentLocation}
        gpsLoading={gpsLoading}
        mapMode={mapMode}
        activeTraceRoad={activeTraceRoad}
        onSelectFeature={handleSelectFeature}
        onSelectRoad={handleSelectRoad}
        highContrast={highContrast}
        className="w-full h-full"
      />

      {/* TOP-CENTER: DEDICATED MAP MODE SWITCHER & ACTIVE TRACE BAR (Requirements 1, 2, 3, 14) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-none">
        <div className="pointer-events-auto flex items-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-1 rounded-2xl shadow-lg">
          <button
            type="button"
            onClick={() => {
              setMapMode("FLOOD_CONDITION");
              setActiveTraceRoad(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              mapMode === "FLOOD_CONDITION"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            title="Default view prioritizing verified flood conditions and depth observations"
          >
            <span>🌊</span>
            <span>FLOOD CONDITION</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMapMode("WATER_MOVEMENT");
              if (selectedRoad?.flow_path_coordinates && selectedRoad.flow_path_coordinates.length >= 2) {
                setActiveTraceRoad(selectedRoad);
              }
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              mapMode === "WATER_MOVEMENT"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            title="Dedicated view showing estimated flow paths, low points, and drainage infrastructure"
          >
            <span>➔</span>
            <span>WATER MOVEMENT</span>
          </button>
        </div>

        {/* Active Trace Info Chip with Return to Map Button (Requirement 14) */}
        {activeTraceRoad && (
          <div className="pointer-events-auto flex items-center gap-2 px-3 py-1 bg-cyan-900/90 text-cyan-100 backdrop-blur-md border border-cyan-700/80 rounded-full shadow-lg text-xs font-mono animate-fadeIn">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Tracing: <strong>{activeTraceRoad.road_name}</strong></span>
            <span className="text-cyan-300">({activeTraceRoad.flow_direction || "Flow Path"})</span>
            <button
              onClick={() => {
                setActiveTraceRoad(null);
              }}
              className="ml-1 bg-cyan-800 hover:bg-cyan-700 px-2 py-0.5 rounded text-[11px] font-bold text-white transition-colors"
              title="Return to full flood map view"
            >
              Clear Trace ✕
            </button>
          </div>
        )}
      </div>

      {/* TOP-LEFT: SEARCH AND PRESET CHIPS */}
      <div className="absolute top-4 left-4 z-20 w-72 max-w-[calc(100vw-2rem)] space-y-2 pointer-events-none">
        <form
          onSubmit={handleSearchSubmit}
          className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-md p-1.5 flex items-center gap-2"
        >
          <Search className="w-4 h-4 text-slate-400 ml-1.5 shrink-0" />
          <input
            type="text"
            placeholder="Search campus landmark..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-slate-400 hover:text-slate-600 text-xs px-1"
            >
              ✕
            </button>
          )}
        </form>

        <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {CAMPUS_LOCATIONS.slice(0, 3).map((loc) => (
            <button
              key={loc.name}
              onClick={() => setCenterTarget({ lat: loc.lat, lng: loc.lng, zoom: loc.zoom })}
              className="text-[10px] font-mono px-2 py-1 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-blue-500 whitespace-nowrap shadow-sm transition-colors"
            >
              {loc.name}
            </button>
          ))}
        </div>

        {/* LAYER CONTROLS */}
        <div className="pointer-events-auto">
          <LayerControl
            layers={layers}
            onChange={setLayers}
            counts={{
              incidents: incidents.length,
              reports: reports.length,
              waterStations: waterStations.length,
              shelters: shelters.length
            }}
          />
        </div>
      </div>

      {/* TOP-RIGHT TELEMETRY AND CONTROLS */}
      <div className="absolute top-4 right-14 z-20 flex flex-col items-end gap-2 pointer-events-none">
        {/* Satellite Acquisition Age Badge */}
        {satellite && satelliteLoaded && layers.satellite && (
          <div className="pointer-events-auto">
            <SatelliteAgeLabel satellite={satellite} mounted={mounted} />
          </div>
        )}

        {satelliteLoading && (
          <span className="pointer-events-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono bg-purple-50 text-purple-800 border border-purple-300 shadow-sm">
            <Satellite className="w-3.5 h-3.5 animate-pulse text-purple-600" />
            <span>Loading Copernicus SAR...</span>
          </span>
        )}

        {/* Live Telemetry Pill */}
        <div className="pointer-events-auto flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-md text-xs font-mono text-slate-700 dark:text-slate-300">
          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Updated: {mounted ? lastUpdated.toLocaleTimeString() : "--:--:--"}</span>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
              isConnected
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {isConnected ? transportMode : "POLLING"}
          </span>

          <button
            onClick={() => loadCoreData()}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Refresh Map Data"
            aria-label="Refresh Map Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setHighContrast((h) => !h)}
            className={`p-1 rounded transition-colors ${
              highContrast
                ? "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/40"
                : "text-slate-500 hover:text-yellow-600 dark:hover:text-yellow-300"
            }`}
            title={highContrast ? "Disable High Contrast" : "Enable High Contrast (Outdoor Daylight)"}
            aria-pressed={highContrast}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* BOTTOM-LEFT: COMPACT MONITORING LOCATION PILL */}
      <div className="absolute bottom-6 left-4 z-20 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl shadow-md">
          {/* Monitoring target */}
          <button
            type="button"
            onClick={() => {
              if (selectedMonitoringLocation) {
                setCenterTarget({
                  lat: selectedMonitoringLocation.lat,
                  lng: selectedMonitoringLocation.lng,
                  zoom: selectedMonitoringLocation.zoom || 15.5
                });
              }
            }}
            className="flex items-center gap-1.5 text-left hover:opacity-80 transition group"
            title="Focus map on monitored location"
          >
            <div className="w-5 h-5 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center shrink-0">
              {selectedMonitoringLocation?.isHome
                ? <Home className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                : <Target className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
            </div>
            <div>
              <div className="text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Monitoring</div>
              <div className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-100 max-w-[120px] truncate">
                {selectedMonitoringLocation?.name || "KMITL Campus"}
              </div>
            </div>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Where am I / GPS status (Requirement 11) */}
          <button
            type="button"
            onClick={handleFlyToCurrentLocation}
            disabled={gpsLoading}
            className="flex items-center gap-1.5 text-left hover:opacity-80 transition group"
            title="Focus map on your device GPS location"
          >
            <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
              currentLocation
                ? "bg-blue-100 dark:bg-blue-950"
                : "bg-slate-100 dark:bg-slate-800"
            }`}>
              <Navigation2 className={`w-3 h-3 ${
                currentLocation
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-400"
              }`} />
            </div>
            <div>
              <div className="text-[9px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Where Am I?</div>
              <div className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                {currentLocation
                  ? `${currentLocation.name || "My Location"}${currentLocation.accuracy ? ` (±${Math.round(currentLocation.accuracy)}m)` : ""}`
                  : gpsLoading ? "Acquiring GPS..."
                  : "Acquire GPS"
                }
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* BOTTOM-CENTER: TIME EVOLUTION TIMELINE (Requirement 12) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="pointer-events-auto flex items-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-1 rounded-2xl shadow-lg gap-1">
          <div className="px-2.5 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">Timeline:</span>
          </div>
          {(["NOW", "1H", "3H", "6H", "24H"] as const).map((offset) => {
            const isSelected = timeOffset === offset;
            return (
              <button
                key={offset}
                onClick={() => handleTimeChange(offset)}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                  isSelected
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                title={`View flood conditions and water movement ${offset === "NOW" ? "live" : `${offset} ago`}`}
              >
                {offset}
              </button>
            );
          })}
        </div>
      </div>

      {/* FLOATING FLOW / MAP LEGEND (Requirement 9) */}
      <div className="absolute bottom-20 left-4 z-20 pointer-events-none hidden md:block max-w-xs">
        <div className="pointer-events-auto">
          <FlowLegend isWaterMovementMode={mapMode === "WATER_MOVEMENT"} />
        </div>
      </div>

      {/* MARKER OR ROAD DETAIL PANEL */}
      {selectedRoad ? (
        <div className="fixed sm:absolute bottom-0 sm:bottom-20 right-0 sm:right-6 z-30 w-full sm:max-w-sm sm:w-96">
          <RoadDetailPanel
            road={selectedRoad}
            onClose={() => setSelectedRoad(null)}
            onFollowWaterMovement={(road) => {
              setMapMode("WATER_MOVEMENT");
              setActiveTraceRoad(road);
            }}
            isTracing={activeTraceRoad?.road_segment_id === selectedRoad.road_segment_id}
          />
        </div>
      ) : selectedFeature ? (
        <div className="fixed sm:absolute bottom-0 sm:bottom-20 right-0 sm:right-6 z-30 w-full sm:max-w-sm sm:w-96">
          <MarkerDetailPanel
            feature={selectedFeature}
            onClose={() => setSelectedFeature(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
