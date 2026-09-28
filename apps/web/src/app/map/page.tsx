"use client";

import React, { useEffect, useState, useCallback } from "react";
import { FloodMap } from "../../components/map/FloodMap";
import { LayerControl, LayerState } from "../../components/map/LayerControl";
import { api } from "../../lib/api";
import { Incident, FloodReport, WaterStation, AssistancePoint, SatelliteObservation, WebSocketEvent } from "../../lib/types";
import { useWebSocket } from "../../hooks/useWebSocket";
import { AlertTriangle, Clock, RefreshCw, X } from "lucide-react";
import { ConfidenceIndicator } from "../../components/common/ConfidenceIndicator";

export default function MapPage() {
  const [layers, setLayers] = useState<LayerState>({
    incidents: true,
    reports: true,
    waterStations: true,
    rain: true,
    satellite: true,
    shelters: true,
  });

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [reports, setReports] = useState<FloodReport[]>([]);
  const [waterStations, setWaterStations] = useState<WaterStation[]>([]);
  const [shelters, setShelters] = useState<AssistancePoint[]>([]);
  const [satellite, setSatellite] = useState<SatelliteObservation | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadData = useCallback(async () => {
    try {
      const [incRes, repRes, waterRes, shelterRes, satRes] = await Promise.all([
        api.getIncidents(),
        api.getReports(),
        api.getWaterStations(),
        api.getShelters(),
        api.getSatellite()
      ]);
      setIncidents(incRes.data);
      setReports(repRes.data);
      setWaterStations(waterRes.data);
      setShelters(shelterRes.data);
      setSatellite(satRes.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Map data refresh error:", err);
    }
  }, []);

  // Handle live incoming WebSocket events without page refresh
  const handleWsEvent = useCallback((event: WebSocketEvent) => {
    console.log("WebSocket live delta event received:", event);
    if (event.event === "INCIDENT_UPDATED" || event.event === "REPORT_CREATED") {
      // Refresh vector entities
      loadData();
    }
  }, [loadData]);

  const { isConnected } = useWebSocket({ onEvent: handleWsEvent });

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="relative flex-1 w-full h-[calc(100vh-6rem)] overflow-hidden">
      {/* FULL-SCREEN MAPLIBRE CANVAS */}
      <FloodMap
        layers={layers}
        incidents={incidents}
        reports={reports}
        waterStations={waterStations}
        shelters={shelters}
        satellite={satellite}
        onSelectIncident={(inc) => setSelectedIncident(inc)}
        className="w-full h-full"
      />

      {/* TOP FLOATING LAYER CONTROLS */}
      <div className="absolute top-4 left-4 z-20 w-64 max-w-[calc(100vw-2rem)]">
        <LayerControl layers={layers} onChange={setLayers} />
      </div>

      {/* REFRESH & TELEMETRY BADGE */}
      <div className="absolute top-4 right-14 z-20 hidden sm:flex items-center gap-2 bg-surface/90 backdrop-blur-md border border-surface-border px-3 py-1.5 rounded-xl shadow-lg text-xs font-mono text-gray-300">
        <Clock className="w-3.5 h-3.5 text-primary-400" />
        <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
        <button
          onClick={loadData}
          className="p-1 hover:bg-surface-card rounded text-gray-400 hover:text-white transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
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
