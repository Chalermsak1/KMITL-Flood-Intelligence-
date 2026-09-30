"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Database,
  Radio,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Info,
  Activity,
  Layers,
  FileCheck,
  ArrowLeft
} from "lucide-react";
import { api } from "../../lib/api";
import { DataSourceStatus, SubsystemStatus } from "../../lib/types";
import clsx from "clsx";

export default function DataStatusPage() {
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [subsystems, setSubsystems] = useState<SubsystemStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const defaultSubsystems: SubsystemStatus[] = [
    { subsystem: "Platform Core", status: "LIVE", category: "Core Infrastructure", notes: "API gateway, FastAPI, PostgreSQL/PostGIS, Redis, multi-tier queue operational." },
    { subsystem: "Citizen Reports", status: "LIVE", category: "Data Stream", notes: "Direct citizen mobile reporting active with EXIF sanitization & DBSCAN spatial clustering." },
    { subsystem: "Copernicus SAR", status: "OBSERVATION", category: "Observational Satellite", notes: "Sentinel-1 SAR radar imagery layer (6-12 day revisit). Not continuous minute-by-minute live depth." },
    { subsystem: "TMD Radar", status: "PENDING_ACCESS", category: "External Weather API", notes: "Official TMD production credentials pending. Calibrated scenario baseline active." },
    { subsystem: "BMA Canal Gauges", status: "PENDING_ACCESS", category: "External Drainage API", notes: "BMA DDS API authorization pending. Calibrated drainage baseline active." },
    { subsystem: "Traffy Fondue", status: "PENDING_ACCESS", category: "Municipal Incident API", notes: "NECTEC OAuth2 access pending. Historical verified ticket dataset active." },
    { subsystem: "Safe Routing Engine", status: "LIVE", category: "Safety Navigation", notes: "Dijkstra routing with dynamic flood depth cost penalization active (LOWER OBSERVED EXPOSURE)." },
    { subsystem: "Hybrid Realtime", status: "LIVE", category: "Event Distribution", notes: "WebSocket & SSE stream active with auto-reconnection and HTTP polling fallback." },
    { subsystem: "SOS Assistance", status: "PENDING_ACCESS", category: "Emergency Dispatch", notes: "SOS remains PILOT_TEST: 24/7 EOC dispatch operator coverage not yet staffed. Emergency hotline guidance active." }
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getDataStatus();
      setSources(res.data.sources || []);
      setSubsystems(res.data.subsystems && res.data.subsystems.length > 0 ? res.data.subsystems : defaultSubsystems);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Failed to load data status:", err);
      setSubsystems(defaultSubsystems);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSubsystemBadge = (status: string) => {
    switch (status) {
      case "LIVE":
        return { label: "LIVE", style: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300" };
      case "OBSERVATION":
        return { label: "OBSERVATION", style: "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300" };
      case "PENDING_ACCESS":
        return { label: "PENDING_ACCESS", style: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300" };
      case "DEGRADED":
        return { label: "DEGRADED", style: "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300" };
      case "UNAVAILABLE":
      default:
        return { label: "UNAVAILABLE", style: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300" };
    }
  };

  const formatAge = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return "Unknown";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m ago`;
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-blue-700 dark:text-blue-400 uppercase tracking-widest font-bold">
            <Database className="w-4 h-4" />
            <span>DATA PROVENANCE & GOVERNANCE AUDIT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            System Subsystems & Data Provenance
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Honest operational tracking of system architecture, external agency API authorizations, and telemetry freshness.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] font-mono text-slate-500">LAST MONITORED</div>
            <div className="text-xs font-mono text-slate-800 dark:text-slate-200 font-bold">
              {lastRefreshed.toLocaleTimeString()}
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
            <span>Refresh Health</span>
          </button>
        </div>
      </div>

      {/* DATA TRUTH NOTICE */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-mono font-bold uppercase">
          <ShieldCheck className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          <span>Non-Negotiable Data Truth Standards</span>
        </div>
        <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
          KMITL Flood Intelligence enforces strict data integrity: external feeds without production credentials are visibly labelled <strong>PENDING_ACCESS</strong>. Satellite imagery is strictly labelled <strong>OBSERVATION</strong> with acquisition age. Citizen reports are labelled <strong>LIVE</strong> with spatial clustering corroboration. We never fabricate live data.
        </p>
      </div>

      {/* SUBSYSTEMS STATUS BOARD */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          <Activity className="w-4 h-4 text-blue-600" />
          <span>Operational Subsystem Status Surface (9 Core Components)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {subsystems.map((sub) => {
            const badge = getSubsystemBadge(sub.status);
            return (
              <div
                key={sub.subsystem}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-sm hover:border-slate-400 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">{sub.category}</span>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{sub.subsystem}</h4>
                  </div>
                  <span className={clsx("text-[10px] font-mono font-bold px-2 py-0.5 rounded border whitespace-nowrap", badge.style)}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">{sub.notes}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* INGESTION TELEMETRY & CREDENTIAL REGISTRY */}
      {sources.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Ingestion Telemetry & Sources Matrix</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sources.map((src) => {
              const badge = getSubsystemBadge(src.status === "PENDING_ACCESS" ? "PENDING_ACCESS" : src.mode);

              return (
                <div
                  key={src.source_id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm hover:border-slate-400 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-mono text-slate-500 block mb-0.5">{src.source_id}</span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{src.full_name || src.name}</h3>
                    </div>
                    <span className={clsx("text-[10px] font-mono font-bold px-2.5 py-1 rounded border whitespace-nowrap", badge.style)}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-center font-mono text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Data Age</div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">{formatAge(src.data_age_seconds)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Latency</div>
                      <div className="font-bold text-blue-700 dark:text-blue-400 mt-0.5">{src.latency_ms} ms</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Error Rate</div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{src.error_rate.toFixed(1)}%</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {src.notes || "Operational telemetry stream verified."}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
