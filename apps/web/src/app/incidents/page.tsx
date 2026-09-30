"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  MapPin,
  Clock,
  Radio,
  ExternalLink,
  RefreshCw,
  Filter,
  CheckCircle2,
  Users,
  Search,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { api } from "../../lib/api";
import { Incident, SelectedFeature } from "../../lib/types";
import { ConfidenceIndicator } from "../../components/common/ConfidenceIndicator";
import clsx from "clsx";

const FloodMap = dynamic(
  () => import("../../components/map/FloodMap").then((mod) => mod.FloodMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-500 gap-2">
        <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="font-mono text-xs text-blue-700">Loading Tactical Map...</p>
      </div>
    ),
  }
);

function getSeverity(inc: Incident): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (inc.consensus_depth_band === "ABOVE_60CM") return "CRITICAL";
  if (inc.consensus_depth_band === "40_TO_60CM") return "HIGH";
  if (inc.consensus_depth_band === "20_TO_40CM") return "MEDIUM";
  return "LOW";
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterSource, setFilterSource] = useState<string>("ALL");
  const [filterRecency, setFilterRecency] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Map focus state
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [centerTarget, setCenterTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  const loadIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getIncidents();
      setIncidents(res.data);
      if (res.data.length > 0 && !selectedIncidentId) {
        setSelectedIncidentId(res.data[0].id);
        setCenterTarget({ lat: res.data[0].latitude, lng: res.data[0].longitude, zoom: 15 });
      }
    } catch (err: any) {
      console.error("Failed to load incidents:", err);
      setError("Failed to fetch active incidents. Displaying degraded cache if available.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      // 1. Severity filter
      const sev = getSeverity(inc);
      if (filterSeverity !== "ALL" && sev !== filterSeverity) return false;

      // 2. Status filter
      if (filterStatus !== "ALL") {
        if (filterStatus === "ACTIVE" && inc.status !== "ACTIVE") return false;
        if (filterStatus === "RESOLVED" && inc.status !== "RESOLVED") return false;
      }

      // 3. Recency filter
      if (filterRecency !== "ALL") {
        const ageMin = inc.last_report_age_min || 0;
        if (filterRecency === "1H" && ageMin > 60) return false;
        if (filterRecency === "6H" && ageMin > 360) return false;
      }

      // 4. Source filter
      if (filterSource !== "ALL") {
        if (filterSource === "CITIZEN" && inc.report_count < 1) return false;
        if (filterSource === "CORROBORATED" && inc.report_count < 2) return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          inc.title.toLowerCase().includes(q) ||
          inc.consensus_depth_band.toLowerCase().includes(q) ||
          String(inc.incident_number).includes(q)
        );
      }

      return true;
    });
  }, [incidents, filterSeverity, filterStatus, filterRecency, filterSource, searchQuery]);

  const handleSelectIncident = (inc: Incident) => {
    setSelectedIncidentId(inc.id);
    setCenterTarget({ lat: inc.latitude, lng: inc.longitude, zoom: 16 });
  };

  return (
    <div className="flex-1 flex flex-col w-full bg-slate-50 dark:bg-slate-950">
      {/* HEADER BAR */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">
              <Radio className="w-4 h-4" />
              <span>SPATIO-TEMPORAL CLUSTERED INCIDENTS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              Flood Hotspots & Incident Operations
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadIncidents}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
            >
              <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
              <span>Refresh</span>
            </button>

            <Link
              href="/report"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm"
            >
              <span>+ Report Flood</span>
            </Link>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3 text-xs">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, street, depth..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Severity filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono text-slate-500 mr-1">Severity:</span>
            {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={clsx(
                  "px-2 py-1 rounded-md text-[11px] font-mono font-bold border transition-colors",
                  filterSeverity === sev
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                )}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Recency filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono text-slate-500 mr-1">Recency:</span>
            {[
              { id: "ALL", label: "All" },
              { id: "1H", label: "< 1h" },
              { id: "6H", label: "< 6h" }
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setFilterRecency(r.id)}
                className={clsx(
                  "px-2 py-1 rounded-md text-[11px] font-mono font-bold border transition-colors",
                  filterRecency === r.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono text-slate-500 mr-1">Status:</span>
            {[
              { id: "ALL", label: "All" },
              { id: "ACTIVE", label: "Active" },
              { id: "RESOLVED", label: "Resolved" }
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setFilterStatus(s.id)}
                className={clsx(
                  "px-2 py-1 rounded-md text-[11px] font-mono font-bold border transition-colors",
                  filterStatus === s.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                )}
              >
                {rLabel(s.id)}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-mono text-slate-400 ml-auto hidden md:inline">
            Showing {filtered.length} of {incidents.length} clusters
          </span>
        </div>
      </div>

      {/* ─── LIST + MAP SPLIT LAYOUT ─────────────────────────────────────────── */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-14rem)] min-h-[600px]">
        {/* LEFT PANEL: SCROLLABLE INCIDENTS LIST (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 uppercase">
              Incident Feed ({filtered.length})
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Sorted by Recency
            </span>
          </div>

          {error && (
            <div className="p-3 m-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No active incidents matching criteria</p>
                <p className="text-[11px] text-slate-400">Try broadening your severity or time filter.</p>
              </div>
            ) : (
              filtered.map((inc) => {
                const sev = getSeverity(inc);
                const isSelected = inc.id === selectedIncidentId;
                const sevStyle = {
                  CRITICAL: "bg-red-50 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300",
                  HIGH: "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300",
                  MEDIUM: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
                  LOW: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                }[sev];

                return (
                  <div
                    key={inc.id}
                    onClick={() => handleSelectIncident(inc)}
                    className={clsx(
                      "p-3.5 rounded-xl border cursor-pointer transition-all space-y-2 text-left",
                      isSelected
                        ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-600 ring-2 ring-blue-500/20 shadow-sm"
                        : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={clsx("text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase", sevStyle)}>
                        {sev} SEVERITY
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{inc.last_report_age_min}m ago</span>
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                      {inc.title}
                    </h3>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 font-mono">
                      <div className="bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-slate-400 block text-[9px]">DEPTH</span>
                        <span className="font-bold text-orange-700 dark:text-orange-400">
                          {inc.consensus_depth_band.replace("DEPTH_", "").replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-slate-400 block text-[9px]">PASSABILITY</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {inc.consensus_passability}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500 font-mono">
                      <span>{inc.report_count} corroborating reports</span>
                      <ConfidenceIndicator confidence={inc.confidence} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: INTERACTIVE MAP (7 COLS) */}
        <div className="lg:col-span-7 h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative bg-slate-100 dark:bg-slate-900">
          <FloodMap
            layers={{
              floodStatus: true,
              waterDepth: false,
              floodTrend: false,
              waterFlow: false,
              drainage: false,
              incidents: true,
              reports: true,
              waterStations: false,
              rain: false,
              satellite: false,
              shelters: false
            }}
            incidents={filtered}
            reports={[]}
            waterStations={[]}
            shelters={[]}
            centerTarget={centerTarget}
            onSelectIncident={(inc) => handleSelectIncident(inc)}
            className="w-full h-full"
          />

          <div className="absolute top-3 right-3 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 shadow-sm">
            <span>Click marker or card to inspect</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function rLabel(status: string) {
  if (status === "ACTIVE") return "Active";
  if (status === "RESOLVED") return "Resolved";
  return "All";
}
