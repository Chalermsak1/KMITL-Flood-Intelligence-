"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  MapPin,
  LifeBuoy,
  FileWarning,
  Navigation,
  CloudRain,
  Droplets,
  Clock,
  ArrowRight,
  Info,
  Search,
  RefreshCw,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Radio,
  ExternalLink,
  Layers,
  Compass,
  AlertCircle,
  Building,
  TrendingUp,
  TrendingDown,
  Activity
} from "lucide-react";
import { api } from "../lib/api";
import {
  SituationSummary,
  SituationEventItem,
  SituationChangesResponse,
  Incident,
  FloodReport,
  WaterStation,
  AssistancePoint,
  SatelliteObservation,
  RainObservation,
  MetaEnvelope,
  SelectedFeature,
  WebSocketEvent
} from "../lib/types";
import { RiskBadge } from "../components/common/RiskBadge";
import { FreshnessBadge } from "../components/common/FreshnessBadge";
import { ConfidenceIndicator } from "../components/common/ConfidenceIndicator";
import { LayerControl, LayerState } from "../components/map/LayerControl";
import { MarkerDetailPanel } from "../components/map/MarkerDetailPanel";
import { RoadDetailPanel } from "../components/map/RoadDetailPanel";
import { TimeEvolutionControl, TimeOffset } from "../components/map/TimeEvolutionControl";
import { RoadCollectionResponse, RoadProperties, DrainageCollectionResponse } from "../lib/types";
import { useWebSocket } from "../hooks/useWebSocket";
import { useLocationContext } from "../hooks/useLocationContext";
import { LocationContextBar } from "../components/location/LocationContextBar";
import clsx from "clsx";

const FloodMap = dynamic(
  () => import("../components/map/FloodMap").then((mod) => mod.FloodMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[460px] flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-500 gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="font-mono text-xs text-blue-700 dark:text-blue-400">Loading MapLibre Tactical Canvas...</p>
      </div>
    ),
  }
);

const CAMPUS_LOCATIONS = [
  { name: "Engineering Gate", lat: 13.7298, lng: 100.7782, zoom: 16, segmentId: "SEG_CHALONG_KRUNG_CAMPUS" },
  { name: "Chalong Krung Gate 1", lat: 13.7314, lng: 100.7812, zoom: 16, segmentId: "SEG_CHALONG_KRUNG_CAMPUS" },
  { name: "ECC Building", lat: 13.7278, lng: 100.7749, zoom: 16, segmentId: "SEG_KMITL_ENGINEERING_LOOP" },
  { name: "Central Library", lat: 13.7289, lng: 100.7765, zoom: 16, segmentId: "SEG_KMITL_ENGINEERING_LOOP" },
  { name: "ARL Lat Krabang", lat: 13.7275, lng: 100.7483, zoom: 15, segmentId: "SEG_LAT_KRABANG_W" },
  { name: "Hua Takhe Market", lat: 13.7215, lng: 100.7895, zoom: 15, segmentId: "SEG_LAT_KRABANG_E" }
];

export default function HomePage() {
  // All operational layers enabled by default for immediate full situational awareness
  const [layers, setLayers] = useState<LayerState>({
    floodStatus: true,
    waterDepth: true,
    floodTrend: true,
    waterFlow: true,
    drainage: true,
    reports: true,
    incidents: true,
    waterStations: true,
    rain: true,
    shelters: true,
    satellite: false,
  });

  // Time Evolution State (Section 11)
  const [timeOffset, setTimeOffset] = useState<TimeOffset>("NOW");

  // Operational data states
  const [summary, setSummary] = useState<SituationSummary | null>(null);
  const [summaryMeta, setSummaryMeta] = useState<MetaEnvelope | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [reports, setReports] = useState<FloodReport[]>([]);
  const [waterStations, setWaterStations] = useState<WaterStation[]>([]);
  const [shelters, setShelters] = useState<AssistancePoint[]>([]);
  const [rain, setRain] = useState<RainObservation | null>(null);
  const [satellite, setSatellite] = useState<SatelliteObservation | null>(null);
  const [roads, setRoads] = useState<RoadCollectionResponse | null>(null);
  const [drainage, setDrainage] = useState<DrainageCollectionResponse | null>(null);
  const [situationEvents, setSituationEvents] = useState<SituationEventItem[]>([]);
  const [situationChanges, setSituationChanges] = useState<SituationChangesResponse | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [isDegraded, setIsDegraded] = useState(false);
  const [degradedMessage, setDegradedMessage] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
  const [selectedRoad, setSelectedRoad] = useState<RoadProperties | null>(null);
  const [centerTarget, setCenterTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Independent Location Context (Section 1: Current vs Monitored Target)
  const {
    currentLocation,
    gpsLoading,
    gpsError,
    homeLocation,
    savedLocations,
    selectedMonitoringLocation,
    distanceToTargetKm,
    requestCurrentLocation,
    setMonitoringLocation,
    setHomeLocation,
    addWatchLocation,
    removeWatchLocation
  } = useLocationContext();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prioritize monitored location on initial load and when changed (Section 8)
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

  // Dedicated Roads loader by time offset
  const loadRoadsData = useCallback(async (offset: TimeOffset) => {
    try {
      const res = await api.getRoadsStatus(offset);
      if (res?.features) {
        setRoads(res);
      }
    } catch (err) {
      console.warn("Road status fetch error:", err);
    }
  }, []);

  const handleTimeOffsetChange = useCallback((newOffset: TimeOffset) => {
    setTimeOffset(newOffset);
    loadRoadsData(newOffset);
  }, [loadRoadsData]);

  // Resilient data loader: Never crashes the page if an endpoint fails
  const loadAllData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        api.getSituationSummary(),
        api.getIncidents(),
        api.getReports(),
        api.getWaterStations(),
        api.getShelters(),
        api.getRain(),
        api.getSatellite(),
        api.getRoadsStatus(timeOffset),
        api.getDrainageNetwork(),
      ]);

      const [sumRes, incRes, repRes, waterRes, shelterRes, rainRes, satRes, roadsRes, drainRes] = results;

      let failures: string[] = [];

      if (sumRes.status === "fulfilled" && sumRes.value?.data) {
        setSummary(sumRes.value.data);
        setSummaryMeta(sumRes.value.meta);
      } else {
        failures.push("Situation Summary");
      }

      if (incRes.status === "fulfilled" && incRes.value?.data) {
        setIncidents(incRes.value.data);
      } else {
        failures.push("Incidents");
      }

      if (repRes.status === "fulfilled" && repRes.value?.data) {
        setReports(repRes.value.data);
      }

      if (waterRes.status === "fulfilled" && waterRes.value?.data) {
        setWaterStations(waterRes.value.data);
      }

      if (shelterRes.status === "fulfilled" && shelterRes.value?.data) {
        setShelters(shelterRes.value.data);
      }

      if (rainRes.status === "fulfilled" && rainRes.value?.data) {
        setRain(rainRes.value.data);
      }

      if (satRes.status === "fulfilled" && satRes.value?.data) {
        setSatellite(satRes.value.data);
      }

      if (roadsRes.status === "fulfilled" && roadsRes.value?.features) {
        setRoads(roadsRes.value);
      }

      if (drainRes.status === "fulfilled" && drainRes.value?.features) {
        setDrainage(drainRes.value);
      }

      if (failures.length > 0) {
        setIsDegraded(true);
        setDegradedMessage(`Some data feeds are currently degraded (${failures.join(", ")}). Visualizing available telemetry.`);
      } else {
        setIsDegraded(false);
        setDegradedMessage(null);
      }

      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error("Home situation load error:", err);
      setIsDegraded(true);
      setDegradedMessage("Operational telemetry connectivity degraded. Map remains operational.");
    } finally {
      setLoading(false);
    }
  }, [timeOffset]);

  // Fetch live situation events and changes (separate, lighter poll)
  const loadSituationFeed = useCallback(async () => {
    try {
      const [eventsRes, changesRes] = await Promise.allSettled([
        api.getSituationEvents(),
        api.getSituationChanges(),
      ]);
      if (eventsRes.status === "fulfilled" && eventsRes.value?.data && Array.isArray(eventsRes.value.data)) {
        setSituationEvents(eventsRes.value.data);
      }
      if (changesRes.status === "fulfilled" && changesRes.value?.data) {
        setSituationChanges(changesRes.value.data);
      }
    } catch {
      // Silent — event feed is supplementary
    }
  }, []);

  // WebSocket Live Stream Handling
  const handleWsEvent = useCallback((event: WebSocketEvent) => {
    if (
      event.event === "REPORT_CREATED" ||
      event.event === "INCIDENT_UPDATED" ||
      event.event === "WATER_UPDATED" ||
      event.event === "RISK_CHANGED"
    ) {
      loadAllData();
      loadSituationFeed();
    }
  }, [loadAllData, loadSituationFeed]);

  const { isConnected, transportMode } = useWebSocket({ onEvent: handleWsEvent });

  useEffect(() => {
    loadAllData();
    loadSituationFeed();
    const interval = setInterval(loadAllData, 25000);
    const feedInterval = setInterval(loadSituationFeed, 20000);
    return () => { clearInterval(interval); clearInterval(feedInterval); };
  }, [loadAllData, loadSituationFeed]);

  // Handle location search filtering / selection
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const match = CAMPUS_LOCATIONS.find(loc =>
      loc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (match) {
      setCenterTarget({ lat: match.lat, lng: match.lng, zoom: match.zoom });
      if (match.segmentId && roads?.features) {
        const found = roads.features.find(f => f.properties.road_segment_id === match.segmentId);
        if (found) {
          setSelectedRoad(found.properties);
          setSelectedFeature(null);
        }
      }
    }
  };

  // Filtered counts for layer badges
  const layerCounts = useMemo(() => ({
    incidents: incidents.length,
    reports: reports.length,
    waterStations: waterStations.length,
    shelters: shelters.length,
    floodedRoads: roads?.features.filter(f => f.properties.status !== "NO_EVIDENCE" && f.properties.status !== "UNKNOWN").length || 0
  }), [incidents.length, reports.length, waterStations.length, shelters.length, roads]);

  // Synthesized "What is happening now" text
  const situationNarrative = useMemo(() => {
    if (summary?.explanation && summary.explanation.length > 0) {
      return summary.explanation;
    }
    if (incidents.length > 0) {
      return [
        `Detected ${incidents.length} active spatio-temporal flood clusters in the Lat Krabang basin.`,
        `Corroborated by ${reports.length} recent citizen field reports.`,
        `Canal water levels and drainage pump stations are being continuously monitored.`
      ];
    }
    return [
      "No critical flood bottlenecks observed across monitored KMITL campus roads.",
      "Citizen observation reports indicate normal traffic passability in primary corridors.",
      "External precipitation radar and drainage feeds are on high alert."
    ];
  }, [summary, incidents, reports]);

  const handleSelectFeature = useCallback((feat: any) => {
    setSelectedFeature(feat);
    setSelectedRoad(null);
  }, []);

  const handleSelectRoad = useCallback((road: any) => {
    setSelectedRoad(road);
    setSelectedFeature(null);
  }, []);

  return (
    <div className="flex-1 flex flex-col w-full bg-slate-50 dark:bg-slate-950">
      {/* DEGRADED STATE WARNING BANNER (IF API FAILS) */}
      {isDegraded && degradedMessage && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 font-mono flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{degradedMessage}</span>
          </div>
          <button
            onClick={loadAllData}
            className="text-[11px] underline font-bold hover:text-amber-950 dark:hover:text-white"
          >
            Retry Feeds
          </button>
        </div>
      )}

      {/* ─── LOCATION CONTEXT BAR: CURRENT LOCATION vs MONITORING TARGET (Section 5, 18) ─── */}
      <div className="bg-slate-100/90 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800/80 px-3 sm:px-4 py-2">
        <div className="max-w-7xl mx-auto">
          <LocationContextBar
            currentLocation={currentLocation}
            selectedMonitoringLocation={selectedMonitoringLocation}
            homeLocation={homeLocation}
            savedLocations={savedLocations}
            distanceToTargetKm={distanceToTargetKm}
            gpsLoading={gpsLoading}
            gpsError={gpsError}
            onRequestCurrentLocation={requestCurrentLocation}
            onFlyToCurrentLocation={handleFlyToCurrentLocation}
            onSelectMonitoringLocation={setMonitoringLocation}
            onSetHomeLocation={setHomeLocation}
            onAddWatchLocation={addWatchLocation}
            onRemoveWatchLocation={removeWatchLocation}
          />
        </div>
      </div>

      {/* ─── 1. MAP-FIRST PRIMARY VISUAL AREA ─────────────────────────────────── */}
      <section className="relative w-full h-[62vh] sm:h-[68vh] lg:h-[72vh] border-b border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-900">
        {/* Full-bleed interactive MapLibre canvas */}
        <FloodMap
          layers={layers}
          roads={roads}
          drainage={drainage}
          incidents={incidents}
          reports={reports}
          waterStations={waterStations}
          shelters={shelters}
          satellite={layers.satellite ? satellite : null}
          centerTarget={centerTarget}
          currentLocation={currentLocation}
          monitoredLocation={selectedMonitoringLocation}
          onRequestCurrentLocation={handleFlyToCurrentLocation}
          gpsLoading={gpsLoading}
          onSelectFeature={handleSelectFeature}
          onSelectRoad={handleSelectRoad}
          className="w-full h-full"
        />

        {/* TOP-LEFT: SEARCH & CAMPUS PRESET CHIPS */}
        <div className="absolute top-3 left-3 w-48 sm:w-64 md:w-80 z-20 space-y-2 pointer-events-none hidden sm:block">
          <form
            onSubmit={handleSearchSubmit}
            className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-md p-1.5 flex items-center gap-2"
          >
            <Search className="w-4 h-4 text-slate-400 ml-1.5 shrink-0" />
            <input
              type="text"
              placeholder="Search KMITL area or landmark..."
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

          {/* Quick Landmark Chips */}
          <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CAMPUS_LOCATIONS.slice(0, 4).map((loc) => (
              <button
                key={loc.name}
                onClick={() => {
                  setCenterTarget({ lat: loc.lat, lng: loc.lng, zoom: loc.zoom });
                  if (loc.segmentId && roads?.features) {
                    const found = roads.features.find(f => f.properties.road_segment_id === loc.segmentId);
                    if (found) {
                      setSelectedRoad(found.properties);
                      setSelectedFeature(null);
                    }
                  }
                }}
                className="text-[10px] font-mono px-2 py-1 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-blue-500 whitespace-nowrap shadow-sm transition-colors"
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>

        {/* TIME EVOLUTION CONTROL (Section 11) - Desktop centered, Mobile/Tablet second row */}
        <div className="absolute top-14 left-3 lg:top-3 lg:left-1/2 lg:-translate-x-1/2 z-20 max-w-[calc(100vw-1.5rem)]">
          <TimeEvolutionControl
            activeOffset={timeOffset}
            onChange={handleTimeOffsetChange}
          />
        </div>

        {/* TOP-RIGHT: COLLAPSIBLE MAP LAYER CONTROL */}
        <div className="absolute top-3 right-3 z-20">
          <LayerControl layers={layers} onChange={setLayers} counts={layerCounts} />
        </div>

        {/* BOTTOM-CENTER / LEGEND: EXPLICIT ROAD STATUS SEMANTICS (Section 20 & Section 3) */}
        <div className="hidden lg:flex items-center gap-3 absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-md text-[10px] font-mono select-none">
          <span className="font-bold text-slate-700 dark:text-slate-300">Road Status:</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> No Evidence</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Water Present</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Flooded</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Severely Flooded</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-900" /> Blocked</span>
        </div>

        {/* BOTTOM-LEFT: COMPACT SITUATION SUMMARY & STATUS CARD (COLLAPSIBLE) */}
        <div className="absolute bottom-3 left-3 z-20 max-w-sm w-[calc(100vw-1.5rem)] sm:w-88">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-3.5 space-y-2.5 transition-all">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
                <div>
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate max-w-[190px]">
                    {selectedMonitoringLocation.name}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    {selectedMonitoringLocation.isHome ? "⌂ Monitored Home" : "🎯 Monitored Target"}
                    {distanceToTargetKm !== null ? ` · ${distanceToTargetKm} km away` : " · GPS Off"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSummaryCollapsed(!summaryCollapsed)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                aria-label={summaryCollapsed ? "Expand situation card" : "Collapse situation card"}
              >
                {summaryCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Risk Badge & Score Header */}
            <div className="flex items-center justify-between gap-2">
              <RiskBadge
                level={summary?.current_status || "LOW"}
                score={summary?.overall_risk_score}
                size="md"
              />
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {mounted ? `Cutoff: ${lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "--:--"}
              </span>
            </div>

            {/* Collapsible Details */}
            {!summaryCollapsed && (
              <div className="space-y-2 pt-1 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                      Active Hotspots
                    </span>
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      {incidents.length} Clusters
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                      Field Reports (24h)
                    </span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {reports.length} Reports
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 font-mono pt-1">
                  <span>Rain: <strong className="text-slate-800 dark:text-slate-100">{summary?.rain_trend || "NONE"}</strong></span>
                  <span>Canals: <strong className="text-slate-800 dark:text-slate-100">{summary?.water_trend || "STABLE"}</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM-RIGHT: ROAD OR MARKER DETAILS INSPECTOR DRAWER */}
        {selectedRoad ? (
          <div className="absolute bottom-3 right-3 z-30 max-w-sm w-[calc(100vw-1.5rem)] sm:w-96">
            <RoadDetailPanel
              road={selectedRoad}
              onClose={() => setSelectedRoad(null)}
            />
          </div>
        ) : selectedFeature ? (
          <div className="absolute bottom-3 right-3 z-30 max-w-sm w-[calc(100vw-1.5rem)] sm:w-96">
            <MarkerDetailPanel
              feature={selectedFeature}
              onClose={() => setSelectedFeature(null)}
            />
          </div>
        ) : null}
      </section>

      {/* ─── 2. SITUATION INTELLIGENCE & OPERATIONAL ASSESSMENT ───────────────── */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* COMPACT KPI METRIC CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Current Risk */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Current Risk Score
              </span>
              <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {summary?.overall_risk_score ?? 15}
              </span>
              <span className="text-xs font-mono text-slate-500">/ 100</span>
            </div>
            <RiskBadge level={summary?.current_status || "LOW"} size="sm" />
          </div>

          {/* Card 2: Rain Activity */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Rainfall & Radar
              </span>
              <CloudRain className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white uppercase">
              {summary?.rain_trend || "LIGHT / NONE"}
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              Source: TMD Weather Radar (PENDING_ACCESS)
            </div>
          </div>

          {/* Card 3: Active Reports */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Active Reports
              </span>
              <FileWarning className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-700 dark:text-blue-400">
              {reports.length}
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              Mode: LIVE Citizen Field Submissions
            </div>
          </div>

          {/* Card 4: Affected Areas */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Monitored Corridors
              </span>
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {incidents.length > 0 ? `${incidents.length} Corridors` : "All Clear"}
            </div>
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  const found = roads?.features.find(f => f.properties.road_segment_id === "SEG_CHALONG_KRUNG_CAMPUS");
                  if (found) {
                    setSelectedRoad(found.properties);
                    setSelectedFeature(null);
                    setCenterTarget({ lat: 13.7298, lng: 100.7782, zoom: 16 });
                  }
                }}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700"
              >
                Chalong Krung
              </button>
              <button
                type="button"
                onClick={() => {
                  const found = roads?.features.find(f => f.properties.road_segment_id === "SEG_LAT_KRABANG_E");
                  if (found) {
                    setSelectedRoad(found.properties);
                    setSelectedFeature(null);
                    setCenterTarget({ lat: 13.7215, lng: 100.7895, zoom: 15 });
                  }
                }}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700"
              >
                Hua Takhe
              </button>
              <button
                type="button"
                onClick={() => {
                  const found = roads?.features.find(f => f.properties.road_segment_id === "SEG_LAT_KRABANG_W");
                  if (found) {
                    setSelectedRoad(found.properties);
                    setSelectedFeature(null);
                    setCenterTarget({ lat: 13.7275, lng: 100.7483, zoom: 15 });
                  }
                }}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700"
              >
                ARL
              </button>
            </div>
          </div>
        </div>

        {/* OPERATIONAL DYNAMICS: LIVE EVENT FEED & WHAT CHANGED (Sections 16 & 17) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LIVE SITUATION EVENT FEED (Section 17-18: Real Events from DB) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight font-mono">
                  Live Event Feed
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {situationEvents.length > 0 ? `${situationEvents.length} events · 20s poll` : "Polling DB..."}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1 max-h-[360px] overflow-y-auto">
              {situationEvents.length === 0 ? (
                <div className="px-6 py-12 text-center text-xs font-mono text-slate-400">
                  No recent events recorded in the database.
                </div>
              ) : (
                situationEvents.slice(0, 8).map((evt) => (
                  <div key={evt.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <span className={[
                      "mt-0.5 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border shrink-0",
                      evt.event_type === "CITIZEN_REPORT" ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300" :
                      evt.event_type === "VERIFIED_INCIDENT" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300" :
                      evt.event_type === "WATER_LEVEL" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300" :
                      evt.event_type === "ROAD_STATUS" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300" :
                      "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    ].join(" ")}>
                      {evt.event_type.replace(/_/g, " ")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">{evt.description}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-mono text-slate-400">{evt.location}</span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(evt.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className={[
                          "text-[10px] font-mono font-bold",
                          evt.status === "VERIFIED" ? "text-emerald-600 dark:text-emerald-400" :
                          evt.status === "REPORTED" ? "text-orange-600 dark:text-orange-400" :
                          "text-slate-500"
                        ].join(" ")}>{evt.status}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* WHAT CHANGED? DELTA ENGINE (Section 16) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight font-mono">
                  What Changed ({situationChanges?.comparison_window || "1 hour"} window)
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                1-Hour Temporal Delta
              </span>
            </div>

            {/* Quick Stat Pill Highlights */}
            <div className="grid grid-cols-4 gap-2 p-4 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 text-center">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {situationChanges?.new_reports_count ?? 0}
                </div>
                <div className="text-[10px] font-mono text-slate-500 uppercase">New Reports</div>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className={clsx(
                  "text-lg font-bold font-mono",
                  (situationChanges?.roads_worsened_count ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"
                )}>
                  {situationChanges?.roads_worsened_count ?? 0}
                </div>
                <div className="text-[10px] font-mono text-slate-500 uppercase">Worsened</div>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className={clsx(
                  "text-lg font-bold font-mono",
                  (situationChanges?.roads_improved_count ?? 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"
                )}>
                  {situationChanges?.roads_improved_count ?? 0}
                </div>
                <div className="text-[10px] font-mono text-slate-500 uppercase">Improved</div>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {situationChanges?.new_incidents_count ?? 0}
                </div>
                <div className="text-[10px] font-mono text-slate-500 uppercase">Incidents</div>
              </div>
            </div>

            {/* Road State Transitions and Hydrological Shifts */}
            <div className="p-4 flex-1 max-h-[280px] overflow-y-auto space-y-3">
              {(!situationChanges?.road_changes || situationChanges.road_changes.length === 0) &&
               (!situationChanges?.water_level_changes || situationChanges.water_level_changes.length === 0) ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400">
                  No state transitions recorded in this comparison window. Road passability and canal levels remain consistent.
                </div>
              ) : (
                <>
                  {situationChanges?.road_changes?.map((rc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        {rc.change_type === "WORSENED" ? (
                          <TrendingUp className="w-4 h-4 text-red-500 shrink-0" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">{rc.road_name}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {rc.previous_status} → <span className="font-bold text-slate-700 dark:text-slate-300">{rc.current_status}</span>
                          </div>
                        </div>
                      </div>
                      <span className={clsx(
                        "text-[10px] font-mono font-bold px-2 py-0.5 rounded border",
                        rc.change_type === "WORSENED"
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                      )}>
                        {rc.change_type}
                      </span>
                    </div>
                  ))}
                  {situationChanges?.water_level_changes?.map((wl, idx) => (
                    <div key={`wl-${idx}`} className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      <span>{wl}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* HUMAN-READABLE "WHAT IS HAPPENING NOW" SECTION */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight font-mono">
                What is happening now (สถานการณ์ปัจจุบัน)
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Operational Intelligence Synthesis
            </span>
          </div>

          <div className="space-y-2.5">
            {situationNarrative.map((text, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-2 shrink-0" />
                <span className="leading-relaxed">{text}</span>
              </div>
            ))}
          </div>

          {/* Quick Actions Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/report"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase shadow-sm transition-colors"
            >
              <FileWarning className="w-4 h-4 text-white" />
              <span>Report Flood</span>
            </Link>

            <Link
              href="/route"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase shadow-sm transition-colors"
            >
              <Navigation className="w-4 h-4 text-white" />
              <span>Evaluate Route</span>
            </Link>

            <Link
              href="/shelters"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase shadow-sm transition-colors"
            >
              <Building className="w-4 h-4 text-white" />
              <span>Shelters & Aid</span>
            </Link>

            <Link
              href="/help"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase shadow-sm transition-colors"
            >
              <LifeBuoy className="w-4 h-4 text-white" />
              <span>Request SOS</span>
            </Link>
          </div>
        </div>

        {/* OPERATIONAL DATA PROVENANCE & TRANSPARENCY AUDIT */}
        <div className="bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Operational Data Provenance & Safety Constraints</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              ISO/IEC 25012 Data Quality Standard
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="space-y-1">
              <span className="text-slate-500 block">generated_at:</span>
              <span className="text-slate-900 dark:text-slate-100 font-bold" suppressHydrationWarning>
                {summary?.last_updated || (mounted ? lastRefreshed.toISOString() : "Synchronizing stream...")}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 block">data_cutoff:</span>
              <span className="text-slate-900 dark:text-slate-100 font-bold">
                Citizen Reports: 120m • Satellite SAR: 24h
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 block">confidence:</span>
              <span className="text-slate-900 dark:text-slate-100 font-bold">
                {summary?.data_quality || "MEDIUM"} (Corroborated by DBSCAN)
              </span>
            </div>
          </div>

          {/* Sources and Unknown Segments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
              <span className="font-bold text-slate-900 dark:text-slate-100 block font-mono text-[11px] uppercase">
                Active Sources & Integration Status:
              </span>
              <ul className="space-y-1 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                <li className="flex items-center justify-between">
                  <span>• Citizen Field Reports</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">LIVE</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>• Copernicus Sentinel-1 SAR</span>
                  <span className="text-purple-700 dark:text-purple-400 font-bold">OBSERVATION</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>• TMD Weather Radar</span>
                  <span className="text-amber-700 dark:text-amber-400 font-bold">PENDING_ACCESS</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>• BMA DDS Canal Telemetry</span>
                  <span className="text-amber-700 dark:text-amber-400 font-bold">PENDING_ACCESS</span>
                </li>
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
              <span className="font-bold text-slate-900 dark:text-slate-100 block font-mono text-[11px] uppercase text-amber-800 dark:text-amber-400">
                Unknown Data Disclosures & Safety Boundaries:
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                เส้นทางและพื้นที่ที่ไม่มีการรายงานไม่ได้หมายความว่าปราศจากน้ำท่วม 100% (No Safe Guarantee). ภาพถ่ายดาวเทียมเป็นข้อมูลสังเกตการณ์ในอดีต (OBSERVATION) ไม่ใช่ข้อมูลความลึกถนนตามเวลาจริง. ระบบ SOS บนเว็บเป็นระบบทดสอบนำร่อง (PILOT_TEST) หากมีภัยคุกคามชีวิตโปรดโทร 199 หรือ 1669 ทันที.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
