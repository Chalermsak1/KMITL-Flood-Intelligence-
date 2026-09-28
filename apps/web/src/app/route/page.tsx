"use client";

import React, { useState, useEffect } from "react";
import {
  Navigation,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Car,
  Bike,
  Footprints,
  RefreshCw,
  Info,
  ChevronRight,
  MapPin
} from "lucide-react";
import { api } from "../../lib/api";
import { RouteCandidate, RouteEvaluationData } from "../../lib/types";

const PRESET_LOCATIONS = [
  { name: "Airport Rail Link Lat Krabang", lat: 13.7275, lng: 100.7505 },
  { name: "KMITL Engineering Main Gate", lat: 13.7298, lng: 100.7782 },
  { name: "KMITL Railway Station (Commuter Stop)", lat: 13.7315, lng: 100.7770 },
  { name: "Hua Takhe Community Market", lat: 13.7215, lng: 100.7895 },
  { name: "Motorway Chalong Krung Ramp", lat: 13.7150, lng: 100.7720 }
];

export default function RoutePage() {
  const [originIdx, setOriginIdx] = useState(0);
  const [destIdx, setDestIdx] = useState(1);
  const [mode, setMode] = useState<"CAR" | "MOTORCYCLE" | "WALK">("CAR");
  const [evaluation, setEvaluation] = useState<RouteEvaluationData | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRouteEvaluation = async () => {
    setLoading(true);
    setError(null);
    try {
      const orig = PRESET_LOCATIONS[originIdx];
      const dest = PRESET_LOCATIONS[destIdx];
      const res = await api.evaluateRoute({
        origin: { lat: orig.lat, lng: orig.lng },
        destination: { lat: dest.lat, lng: dest.lng },
        mode
      });
      setEvaluation(res.data);
      if (res.data.routes.length > 0) {
        setSelectedRouteId(res.data.routes[0].route_id);
      }
    } catch (err: any) {
      console.error("Failed to evaluate routes:", err);
      setError("Could not evaluate flood exposure routes. Please check network connectivity.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRouteEvaluation();
  }, [originIdx, destIdx, mode]);

  const selectedRoute = evaluation?.routes.find((r) => r.route_id === selectedRouteId) || evaluation?.routes[0];

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* HEADER & ADVISORY BANNER */}
      <div className="pb-6 border-b border-surface-border">
        <div className="flex items-center gap-2 text-xs font-mono text-primary-400 uppercase tracking-widest mb-1">
          <Navigation className="w-4 h-4" />
          <span>DECISION SUPPORT ROUTING ENGINE</span>
        </div>
        <h1 className="text-2xl font-black text-white">Flood-Aware Route Evaluation</h1>
        <p className="text-sm text-gray-400 mt-1 max-w-3xl">
          Evaluates multi-corridor transit across KMITL and Lat Krabang against recent citizen water reports,
          clustered incidents, and satellite evidence.
        </p>

        {/* MANDATORY DISCLAIMER */}
        <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200">
            <span className="font-bold">Operational Safety Disclaimer: </span>
            This tool provides <span className="font-semibold underline">LOWER OBSERVED FLOOD EXPOSURE</span> corridors based on active observations.
            It does <strong>NOT guarantee 100% safe passage</strong>. Surface conditions and canal backwater can fluctuate rapidly during tropical monsoon events.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: ROUTE CONTROLS & TRIP PLANNER */}
        <div className="space-y-6">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-400" />
              <span>Trip Coordinates</span>
            </h2>

            {/* Origin Selection */}
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Origin Location</label>
              <select
                value={originIdx}
                onChange={(e) => setOriginIdx(Number(e.target.value))}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary-500"
              >
                {PRESET_LOCATIONS.map((loc, idx) => (
                  <option key={idx} value={idx}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Selection */}
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Destination Location</label>
              <select
                value={destIdx}
                onChange={(e) => setDestIdx(Number(e.target.value))}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary-500"
              >
                {PRESET_LOCATIONS.map((loc, idx) => (
                  <option key={idx} value={idx}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode of Transport */}
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Transport Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "CAR", label: "Car / Taxi", icon: Car },
                  { id: "MOTORCYCLE", label: "Motorcycle", icon: Bike },
                  { id: "WALK", label: "Pedestrian", icon: Footprints }
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = mode === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setMode(item.id as any)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        isActive
                          ? "bg-primary-500/20 border-primary-500 text-primary-300"
                          : "bg-surface border-surface-border text-gray-400 hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Re-evaluate Button */}
            <button
              onClick={fetchRouteEvaluation}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Evaluating Conditions..." : "Re-evaluate Route"}</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: CANDIDATE ROUTES & FLOOD EXPOSURE BREAKDOWN */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary-400" />
              <span>Candidate Routes ({evaluation?.routes.length || 0})</span>
            </h2>
            {evaluation?.evaluated_at && (
              <span className="text-[11px] font-mono text-gray-400">
                Evaluated {new Date(evaluation.evaluated_at).toLocaleTimeString()}
              </span>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* CANDIDATE ROUTE CARDS */}
          <div className="space-y-4">
            {evaluation?.routes.map((route: RouteCandidate) => {
              const isSelected = route.route_id === selectedRoute?.route_id;
              const exposureColors: Record<string, { bg: string; text: string; border: string }> = {
                LOW: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/40" },
                MEDIUM: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/40" },
                HIGH: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/40" },
                CRITICAL: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/40" },
                UNKNOWN: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/40" }
              };
              const style = exposureColors[route.flood_exposure] || exposureColors.UNKNOWN;

              return (
                <div
                  key={route.route_id}
                  onClick={() => setSelectedRouteId(route.route_id)}
                  className={`cursor-pointer bg-surface-card border rounded-2xl p-5 transition-all space-y-4 ${
                    isSelected ? "border-primary-500 ring-2 ring-primary-500/20 shadow-xl" : "border-surface-border hover:border-gray-600"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${style.bg} ${style.text} ${style.border}`}>
                        {route.recommendation_label}
                      </span>
                      <h3 className="text-base font-bold text-white mt-1.5">{route.name}</h3>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-gray-300">
                      <div>
                        <span className="text-gray-500 text-[10px] block">DISTANCE</span>
                        <span className="text-sm font-bold text-white">{route.distance_km} km</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-[10px] block">EST. TIME</span>
                        <span className="text-sm font-bold text-white">{route.estimated_travel_minutes} min</span>
                      </div>
                    </div>
                  </div>

                  {/* Exposure & Evidence Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-surface-border/60 text-xs">
                    <div>
                      <span className="text-gray-400 block text-[11px]">Observed Exposure</span>
                      <span className={`font-bold ${style.text}`}>{route.flood_exposure}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[11px]">Citizen Evidence</span>
                      <span className="font-bold text-white">{route.evidence_count} corroborating reports</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[11px]">Latest Observation</span>
                      <span className="font-bold text-white">
                        {route.latest_observation_age_min != null ? `${route.latest_observation_age_min} min ago` : "No recent reports"}
                      </span>
                    </div>
                  </div>

                  {/* Segment Details */}
                  {isSelected && (
                    <div className="pt-3 border-t border-surface-border/60 space-y-2">
                      <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">
                        Route Segment Risk Breakdown:
                      </div>
                      <div className="space-y-1.5">
                        {route.segments.map((seg, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-surface/50 px-3 py-2 rounded-lg">
                            <span className="text-gray-300">{seg.name} ({seg.length_km} km)</span>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                              seg.flood_exposure === "LOW"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : seg.flood_exposure === "MEDIUM"
                                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                                : seg.flood_exposure === "HIGH"
                                ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                                : seg.flood_exposure === "CRITICAL"
                                ? "bg-red-500/10 text-red-400 border-red-500/30"
                                : "bg-gray-500/10 text-gray-400 border-gray-500/30"
                            }`}>
                              {seg.flood_exposure}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
