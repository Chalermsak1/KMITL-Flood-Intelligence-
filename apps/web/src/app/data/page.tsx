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
  FileCheck
} from "lucide-react";
import { api } from "../../lib/api";
import { DataSourceStatus } from "../../lib/types";

export default function DataStatusPage() {
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getDataStatus();
      setSources(res.data.sources);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Failed to load data status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string, mode: string) => {
    if (mode === "LIVE") {
      return {
        label: "LIVE FEED",
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/30"
      };
    }
    if (mode === "OBSERVATION") {
      return {
        label: "OBSERVATIONAL EVIDENCE",
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        border: "border-blue-500/30"
      };
    }
    if (status === "PENDING_ACCESS" || mode === "DEMO") {
      return {
        label: "DEMO / PENDING ACCESS",
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/30"
      };
    }
    return {
      label: status,
      bg: "bg-gray-500/10",
      text: "text-gray-400",
      border: "border-gray-500/30"
    };
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-primary-400 uppercase tracking-widest mb-1">
            <Database className="w-4 h-4" />
            <span>DATA PROVENANCE & GOVERNANCE</span>
          </div>
          <h1 className="text-2xl font-black text-white">Data Sources & Ingestion Telemetry</h1>
          <p className="text-sm text-gray-400 mt-1">
            Public transparency registry tracking latency, freshness, update cadences, and official agreements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] font-mono text-gray-400">LAST MONITORED</div>
            <div className="text-xs font-mono text-white font-bold">
              {lastRefreshed.toLocaleTimeString()}
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-card border border-surface-border text-xs font-bold text-gray-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Health</span>
          </button>
        </div>
      </div>

      {/* DATA TRUTH NOTICE */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold">
          <ShieldCheck className="w-4 h-4" />
          <span>NON-NEGOTIABLE DATA TRUTH RULES</span>
        </div>
        <p className="text-xs text-amber-200/90 leading-relaxed">
          KMITL Flood Intelligence operates under strict data provenance. We never claim external data is real-time if official credentials are pending. Radar reflectivity is never converted directly into road flood depth without calibrated ground validation. Synthetic mock models are explicitly tagged as <strong>DEMO</strong>.
        </p>
      </div>

      {/* SOURCE CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sources.map((src) => {
          const badge = getStatusBadge(src.status, src.mode);

          return (
            <div
              key={src.source_id}
              className="bg-surface-card border border-surface-border rounded-2xl p-6 space-y-5 flex flex-col justify-between hover:border-gray-600 transition-all"
            >
              <div className="space-y-4">
                {/* TOP BAR */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono text-gray-400 block mb-0.5">
                      {src.source_id}
                    </span>
                    <h3 className="text-lg font-black text-white">{src.full_name || src.name}</h3>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border whitespace-nowrap ${badge.bg} ${badge.text} ${badge.border}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* METRICS GRID */}
                <div className="grid grid-cols-3 gap-2 bg-surface/60 p-3 rounded-xl border border-surface-border/50 text-center font-mono">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase">Data Age</div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      {formatAge(src.data_age_seconds)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-gray-400 uppercase">Latency</div>
                    <div className="text-xs font-bold text-primary-400 mt-0.5">
                      {src.latency_ms} ms
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-gray-400 uppercase">Error Rate</div>
                    <div className="text-xs font-bold text-emerald-400 mt-0.5">
                      {src.error_rate.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* NOTES & INTEGRATION STATUS */}
                <div className="space-y-2 text-xs">
                  <div className="text-gray-300 bg-surface/40 p-3 rounded-lg border border-surface-border/30 font-sans leading-relaxed">
                    {src.notes || "Operational telemetry verified."}
                  </div>

                  {src.is_satellite_observational && (
                    <div className="flex items-center gap-2 text-[11px] font-mono text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded border border-blue-500/20">
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      <span>Revisit: 6-12 days • Resolution: 10m GRD • STAC API</span>
                    </div>
                  )}
                </div>
              </div>

              {/* FOOTER */}
              <div className="pt-4 border-t border-surface-border flex items-center justify-between text-xs">
                <span className="text-gray-500 text-[11px] font-mono">
                  Mode: <strong className="text-gray-300">{src.mode}</strong>
                </span>

                <Link
                  href="/admin"
                  className="text-primary-400 hover:text-primary-300 font-bold flex items-center gap-1"
                >
                  <span>EOC Audit</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* DOCUMENTATION & AUDIT CALLOUT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-primary-400 font-bold text-sm">
            <Radio className="w-4 h-4" />
            <span>TMD Weather Feed</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Direct integration with Thai Meteorological Department open weather radar & stations in eastern Bangkok.
          </p>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
            <Layers className="w-4 h-4" />
            <span>Copernicus STAC</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            ESA Sentinel-1 SAR imagery query via Copernicus Data Space Ecosystem STAC API for synoptic flood footprint detection.
          </p>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <FileCheck className="w-4 h-4" />
            <span>Citizen Crowdsourcing</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            First-party high-frequency reports processed asynchronously via DBSCAN spatio-temporal clustering.
          </p>
        </div>
      </div>
    </div>
  );
}
