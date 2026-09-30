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
  MapPin,
  Truck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { api } from "../../lib/api";
import { RouteCandidate, RouteEvaluationData } from "../../lib/types";
import { useLocationContext } from "../../hooks/useLocationContext";
import clsx from "clsx";

export default function RoutePage() {
  const {
    currentLocation,
    homeLocation,
    savedLocations,
    requestCurrentLocation,
    gpsLoading
  } = useLocationContext();

  const routeLocations = React.useMemo(() => {
    const list: { name: string; lat: number; lng: number; isGps?: boolean; isHome?: boolean }[] = [];

    if (currentLocation) {
      list.push({
        name: "📍 My Current Location (Device GPS)",
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        isGps: true
      });
    }

    if (homeLocation) {
      list.push({
        name: `⌂ My Home (${homeLocation.name})`,
        lat: homeLocation.lat,
        lng: homeLocation.lng,
        isHome: true
      });
    }

    savedLocations.forEach((loc) => {
      if (loc.id !== homeLocation?.id) {
        list.push({
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng
        });
      }
    });

    return list;
  }, [currentLocation, homeLocation, savedLocations]);

  const [originIdx, setOriginIdx] = useState(0);
  const [destIdx, setDestIdx] = useState(1);
  const [mode, setMode] = useState<"CAR" | "MOTORCYCLE" | "WALK" | "TRUCK">("CAR");
  const [evaluation, setEvaluation] = useState<RouteEvaluationData | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRouteEvaluation = async () => {
    if (routeLocations.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const orig = routeLocations[originIdx] || routeLocations[0];
      const dest = routeLocations[destIdx] || routeLocations[1] || routeLocations[0];
      const res = await api.evaluateRoute({
        origin: { lat: orig.lat, lng: orig.lng },
        destination: { lat: dest.lat, lng: dest.lng },
        mode: mode === "TRUCK" ? "CAR" : mode // API expects CAR, MOTORCYCLE, WALK
      });
      setEvaluation(res.data);
      if (res.data.routes.length > 0) {
        setSelectedRouteId(res.data.routes[0].route_id);
      }
    } catch (err: any) {
      console.error("Failed to evaluate routes:", err);
      setError("Could not evaluate transit corridors. Corroborating live telemetry feeds may be degraded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRouteEvaluation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originIdx, destIdx, mode]);

  const selectedRoute = evaluation?.routes.find((r) => r.route_id === selectedRouteId) || evaluation?.routes[0];

  const getExposureBadge = (exposure: string) => {
    switch (exposure) {
      case "LOW":
        return {
          label: "LOWER OBSERVED FLOOD EXPOSURE",
          style: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
        };
      case "MEDIUM":
        return {
          label: "MODERATE FLOOD EXPOSURE",
          style: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
        };
      case "HIGH":
        return {
          label: "HIGH FLOOD RISK",
          style: "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800"
        };
      case "CRITICAL":
        return {
          label: "CRITICAL WATER IMPASSABLE",
          style: "bg-red-50 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
        };
      default:
        return {
          label: "UNKNOWN EXPOSURE",
          style: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
        };
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* HEADER & OPERATIONAL SAFETY ADVISORY */}
      <div className="pb-6 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono text-blue-700 dark:text-blue-400 uppercase tracking-widest font-bold">
          <Navigation className="w-4 h-4" />
          <span>DECISION SUPPORT ROUTING ENGINE</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Flood-Aware Transit Route Evaluation
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
          Evaluates multi-corridor transit across KMITL campus and the Lat Krabang basin against recent citizen water reports, DBSCAN incident clusters, and canal water levels.
        </p>

        {/* MANDATORY DISCLAIMER: NEVER LABEL A ROUTE "SAFE" */}
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 rounded-2xl flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <span className="font-bold">Operational Safety Disclaimer: </span>
            <span>
              This system provides <strong>LOWER OBSERVED FLOOD EXPOSURE</strong> corridors based on available observations. It does <u>NOT guarantee 100% safe or flood-free passage</u>. Surface water depth, canal overflow, and vehicle wakes can change rapidly during monsoon precipitation.
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: INTUITIVE ROUTE PLANNING CONTROLS */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Route Parameters</span>
              </h2>
            </div>

            {/* Quick Route Shortcuts (Section 9) */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                Quick Route Shortcuts:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {currentLocation && homeLocation && (
                  <button
                    type="button"
                    onClick={() => {
                      const origI = routeLocations.findIndex((l) => l.isGps);
                      const destI = routeLocations.findIndex((l) => l.isHome);
                      if (origI !== -1 && destI !== -1) {
                        setOriginIdx(origI);
                        setDestIdx(destI);
                      }
                    }}
                    className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800 transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <span>📍 Current GPS → ⌂ Home</span>
                  </button>
                )}
                {homeLocation && (
                  <button
                    type="button"
                    onClick={() => {
                      const origI = routeLocations.findIndex((l) => l.isHome);
                      const destI = routeLocations.findIndex((l) => l.name.includes("KMITL"));
                      if (origI !== -1 && destI !== -1) {
                        setOriginIdx(origI);
                        setDestIdx(destI);
                      }
                    }}
                    className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <span>⌂ Home → 🎓 KMITL</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const origI = routeLocations.findIndex((l) => l.name.includes("Airport Rail Link"));
                    const destI = routeLocations.findIndex((l) => l.name.includes("KMITL"));
                    if (origI !== -1 && destI !== -1) {
                      setOriginIdx(origI);
                      setDestIdx(destI);
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1"
                >
                  <span>🚉 ARL → 🎓 KMITL</span>
                </button>
              </div>
            </div>

            {/* Origin Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Origin Location (จุดเริ่มต้น)
                </label>
                {!currentLocation && (
                  <button
                    type="button"
                    onClick={() => requestCurrentLocation()}
                    disabled={gpsLoading}
                    className="text-[10px] font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span>{gpsLoading ? "Detecting..." : "📍 Add My GPS as Origin"}</span>
                  </button>
                )}
              </div>
              <select
                value={originIdx}
                onChange={(e) => setOriginIdx(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium font-mono"
              >
                {routeLocations.map((loc, idx) => (
                  <option key={idx} value={idx}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Selection */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Destination Location (จุดหมายปลายทาง)
              </label>
              <select
                value={destIdx}
                onChange={(e) => setDestIdx(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium font-mono"
              >
                {routeLocations.map((loc, idx) => (
                  <option key={idx} value={idx}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode of Transport */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Travel Mode (รูปแบบการเดินทาง)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "CAR", label: "Sedan / Taxi", icon: Car },
                  { id: "MOTORCYCLE", label: "Motorcycle", icon: Bike },
                  { id: "WALK", label: "Pedestrian", icon: Footprints },
                  { id: "TRUCK", label: "High Clearance", icon: Truck }
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = mode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMode(item.id as any)}
                      className={clsx(
                        "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-left",
                        isActive
                          ? "bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Evaluate Button */}
            <button
              onClick={fetchRouteEvaluation}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
              <span>{loading ? "Evaluating Corridors..." : "Evaluate Route Options"}</span>
            </button>
          </div>

          {/* UNKNOWN SEGMENTS DISCLOSURE */}
          <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-mono font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Unknown Segments Notice</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              Certain inner alleyways (Soi) and campus residential passages lack telemetric water stage sensors and citizen reports. Areas marked <span className="font-mono font-bold text-slate-700 dark:text-slate-300">UNKNOWN</span> are treated with caution.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: ROUTE ALTERNATIVES & SEGMENT BREAKDOWN */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Route Alternatives ({evaluation?.routes.length || 0})</span>
            </h2>
            {evaluation?.evaluated_at && (
              <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Freshness: {new Date(evaluation.evaluated_at).toLocaleTimeString()}</span>
              </span>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-2xl text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ROUTE CARDS */}
          <div className="space-y-4">
            {evaluation?.routes.map((route: RouteCandidate) => {
              const isSelected = route.route_id === selectedRoute?.route_id;
              const badge = getExposureBadge(route.flood_exposure);

              return (
                <div
                  key={route.route_id}
                  onClick={() => setSelectedRouteId(route.route_id)}
                  className={clsx(
                    "cursor-pointer bg-white dark:bg-slate-900 border rounded-2xl p-5 transition-all space-y-4 shadow-sm",
                    isSelected
                      ? "border-blue-600 ring-2 ring-blue-500/20 shadow-md"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className={clsx("inline-block text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded border", badge.style)}>
                        {badge.label}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">
                        {route.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                      <div>
                        <span className="text-slate-500 text-[10px] block">DISTANCE</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{route.distance_km} km</span>
                      </div>
                      <div className="border-l border-slate-200 dark:border-slate-700 pl-3">
                        <span className="text-slate-500 text-[10px] block">EST. TIME</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{route.estimated_travel_minutes} min</span>
                      </div>
                    </div>
                  </div>

                  {/* Operational Evidence Indicators */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500 text-[11px] block">Observed Flood Exposure</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{route.flood_exposure}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px] block">Field Evidence</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{route.evidence_count} corroborating reports</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px] block">Observation Age</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {route.latest_observation_age_min != null ? `${route.latest_observation_age_min} min ago` : "Historical baseline"}
                      </span>
                    </div>
                  </div>

                  {/* Route Segment Breakdown */}
                  {isSelected && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                        Segment Risk Breakdown:
                      </div>
                      <div className="space-y-1.5">
                        {route.segments.map((seg, idx) => {
                          const segBadge = getExposureBadge(seg.flood_exposure);
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60"
                            >
                              <span className="text-slate-700 dark:text-slate-300 font-medium">
                                {seg.name} ({seg.length_km} km)
                              </span>
                              <span className={clsx("text-[10px] font-mono font-bold px-2 py-0.5 rounded border", segBadge.style)}>
                                {seg.flood_exposure}
                              </span>
                            </div>
                          );
                        })}
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
