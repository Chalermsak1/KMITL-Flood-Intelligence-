"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { FloodMap } from "../../components/map/FloodMap";
import { LayerControl, LayerState } from "../../components/map/LayerControl";
import { api } from "../../lib/api";
import { Incident, FloodReport, WaterStation, AssistancePoint, SatelliteObservation, WebSocketEvent } from "../../lib/types";
import { useWebSocket } from "../../hooks/useWebSocket";
import { AlertTriangle, Clock, RefreshCw, X, Wifi, WifiOff, Sun, Satellite } from "lucide-react";
import { ConfidenceIndicator } from "../../components/common/ConfidenceIndicator";

// ─── Low-Bandwidth Detection ─────────────────────────────────────────────────
// Uses Network Information API (where available) to detect slow connections.
// Falls back to a manual toggle for browsers that don't support the API.
function detectLowBandwidth(): boolean {
  if (typeof navigator === "undefined") return false;
  // Network Information API (Chrome/Android)
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (conn) {
    const slowTypes = ["slow-2g", "2g"];
    if (slowTypes.includes(conn.effectiveType)) return true;
    if (conn.downlink !== undefined && conn.downlink < 1.0) return true; // < 1 Mbps
  }
  return false;
}

// ─── Satellite Age Label ──────────────────────────────────────────────────────
function SatelliteAgeLabel({ satellite }: { satellite: SatelliteObservation | null }) {
  if (!satellite) return null;
  const acqTime = satellite.acquisition_at ? new Date(satellite.acquisition_at) : null;
  const ageMs = acqTime ? Date.now() - acqTime.getTime() : null;
  const ageHours = ageMs ? Math.round(ageMs / 3600000) : null;
  const ageLabel = ageHours === null ? "Unknown age"
    : ageHours < 1 ? "< 1 hour ago"
    : ageHours < 24 ? `${ageHours}h ago`
    : `${Math.round(ageHours / 24)}d ago`;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30"
      title="Sentinel-1 SAR acquisition. Not real-time street water depth."
    >
      <Satellite className="w-3 h-3" />
      OBSERVATION — Acquired {ageLabel}
    </span>
  );
}

export default function MapPage() {
  const [layers, setLayers] = useState<LayerState>({
    incidents: true,
    reports: true,
    waterStations: true,
    rain: true,
    satellite: false,   // P1-01: satellite OFF by default in low-bandwidth path
    shelters: true,
  });

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [reports, setReports] = useState<FloodReport[]>([]);
  const [waterStations, setWaterStations] = useState<WaterStation[]>([]);
  const [shelters, setShelters] = useState<AssistancePoint[]>([]);
  const [satellite, setSatellite] = useState<SatelliteObservation | null>(null);
  const [satelliteLoaded, setSatelliteLoaded] = useState(false);
  const [satelliteLoading, setSatelliteLoading] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // P1-01: Low-bandwidth mode
  const [isLowBandwidth, setIsLowBandwidth] = useState(false);
  const [showLowBwBanner, setShowLowBwBanner] = useState(false);
  // P2-01: High-contrast mode for outdoor daylight
  const [highContrast, setHighContrast] = useState(false);

  // Detect low bandwidth on mount
  useEffect(() => {
    const detected = detectLowBandwidth();
    setIsLowBandwidth(detected);
    if (detected) setShowLowBwBanner(true);
  }, []);

  // Load non-satellite data (fast, always loaded)
  const loadCoreData = useCallback(async () => {
    try {
      const [incRes, repRes, waterRes, shelterRes] = await Promise.all([
        api.getIncidents(),
        api.getReports(),
        api.getWaterStations(),
        api.getShelters(),
      ]);
      setIncidents(incRes.data);
      setReports(repRes.data);
      setWaterStations(waterRes.data);
      setShelters(shelterRes.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Map data refresh error:", err);
    }
  }, []);

  // P1-01: Satellite loaded separately and only on demand
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

  // When satellite layer is toggled ON, lazy-load if not yet loaded
  const prevSatelliteLayer = useRef(layers.satellite);
  useEffect(() => {
    if (layers.satellite && !prevSatelliteLayer.current) {
      // Layer was just turned on — lazy load
      loadSatellite();
    }
    prevSatelliteLayer.current = layers.satellite;
  }, [layers.satellite, loadSatellite]);

  // Handle live incoming SSE events without page refresh
  const handleWsEvent = useCallback((event: WebSocketEvent) => {
    if (event.event === "INCIDENT_UPDATED" || event.event === "REPORT_CREATED") {
      loadCoreData();
    }
  }, [loadCoreData]);

  const { isConnected } = useWebSocket({ onEvent: handleWsEvent });

  useEffect(() => {
    loadCoreData();
    // On good connections load satellite eagerly (non-blocking)
    if (!detectLowBandwidth()) {
      loadSatellite();
    }
  }, [loadCoreData, loadSatellite]);

  return (
    <div className={`relative flex-1 w-full h-[calc(100vh-6rem)] overflow-hidden ${highContrast ? "high-contrast-map" : ""}`}>

      {/* P1-01: LOW BANDWIDTH BANNER */}
      {showLowBwBanner && (
        <div className="absolute top-0 left-0 right-0 z-40 px-4 py-2 bg-amber-600/95 backdrop-blur-sm border-b border-amber-500 flex items-center gap-2 text-xs text-white font-mono">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span className="flex-1">
            <strong>LOW BANDWIDTH DETECTED:</strong> Satellite layer deferred. Core incidents, reports, and SOS remain fully available.
          </span>
          <button
            onClick={() => setShowLowBwBanner(false)}
            className="text-amber-200 hover:text-white font-bold px-1"
            aria-label="Dismiss bandwidth notice"
          >✕</button>
        </div>
      )}

      {/* FULL-SCREEN MAPLIBRE CANVAS */}
      <FloodMap
        layers={layers}
        incidents={incidents}
        reports={reports}
        waterStations={waterStations}
        shelters={shelters}
        satellite={layers.satellite && satelliteLoaded ? satellite : null}
        onSelectIncident={(inc) => setSelectedIncident(inc)}
        highContrast={highContrast}
        className="w-full h-full"
      />

      {/* TOP FLOATING LAYER CONTROLS */}
      <div className="absolute top-4 left-4 z-20 w-64 max-w-[calc(100vw-2rem)]">
        <LayerControl layers={layers} onChange={setLayers} />
      </div>

      {/* P2-01: HIGH CONTRAST TOGGLE & SATELLITE LABEL */}
      <div className="absolute top-4 right-14 z-20 flex flex-col items-end gap-2">
        {/* Satellite acquisition age — never implies live road data */}
        {satellite && satelliteLoaded && layers.satellite && (
          <SatelliteAgeLabel satellite={satellite} />
        )}
        {/* Satellite loading indicator */}
        {satelliteLoading && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Satellite className="w-3 h-3 animate-pulse" /> Loading satellite…
          </span>
        )}
        {/* P1-01: Satellite manual load button when in low-bandwidth mode */}
        {isLowBandwidth && !satelliteLoaded && !satelliteLoading && (
          <button
            onClick={() => { setLayers(l => ({ ...l, satellite: true })); loadSatellite(); }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-surface/90 border border-surface-border text-gray-300 hover:text-white"
          >
            <Satellite className="w-3 h-3" /> Load Satellite (may be slow)
          </button>
        )}
        {/* Telemetry badge */}
        <div className="hidden sm:flex items-center gap-2 bg-surface/90 backdrop-blur-md border border-surface-border px-3 py-1.5 rounded-xl shadow-lg text-xs font-mono text-gray-300">
          <Clock className="w-3.5 h-3.5 text-primary-400" />
          <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
          <button
            onClick={loadCoreData}
            className="p-1 hover:bg-surface-card rounded text-gray-400 hover:text-white transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {/* P2-01: High contrast toggle */}
          <button
            onClick={() => setHighContrast(h => !h)}
            className={`p-1 rounded transition-colors ${highContrast ? "text-yellow-400 bg-yellow-500/20" : "text-gray-400 hover:text-yellow-300"}`}
            title={highContrast ? "Disable High Contrast Mode" : "Enable High Contrast Mode (outdoor daylight)"}
            aria-pressed={highContrast}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* FLOATING INCIDENT INSPECTOR DRAWER */}
      {selectedIncident && (
        <div className="absolute bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-30 bg-surface/95 backdrop-blur-xl border border-surface-border rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
          <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-surface-border">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-orange-400 font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>INCIDENT #{selectedIncident.incident_number}</span>
              </div>
              <h3 className="font-bold text-base text-white mt-1">
                {selectedIncident.title}
              </h3>
            </div>
            <button
              onClick={() => setSelectedIncident(null)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-card"
              aria-label="Close incident detail"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-card p-2.5 rounded-xl border border-surface-border">
                <div className="text-gray-400 text-[10px]">ระดับน้ำท่วม</div>
                <div className="text-orange-300 font-bold text-sm mt-0.5">
                  {selectedIncident.consensus_depth_band.replace("DEPTH_", "").replace("_", " ")}
                </div>
              </div>
              <div className="bg-surface-card p-2.5 rounded-xl border border-surface-border">
                <div className="text-gray-400 text-[10px]">สภาพการจราจร</div>
                <div className="text-white font-bold text-sm mt-0.5">
                  {selectedIncident.consensus_passability}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-gray-300 py-1">
              <span>รายงานที่ตรวจพบ:</span>
              <span className="font-bold text-white">{selectedIncident.report_count} ครั้ง</span>
            </div>

            <div className="flex items-center justify-between text-gray-300 py-1">
              <span>ความน่าเชื่อถือ:</span>
              <ConfidenceIndicator confidence={selectedIncident.confidence} />
            </div>

            <div className="flex items-center justify-between text-gray-400 text-[11px] pt-2 border-t border-surface-border">
              <span>พิกัด: {selectedIncident.latitude.toFixed(4)}, {selectedIncident.longitude.toFixed(4)}</span>
              <span>ล่าสุด: {selectedIncident.last_report_age_min} นาทีที่แล้ว</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
