"use client";

import React, { useState, useEffect } from "react";
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
  Users
} from "lucide-react";
import { api } from "../../lib/api";
import { Incident } from "../../lib/types";

function getSeverity(inc: Incident): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (inc.consensus_depth_band === "ABOVE_60CM") return "CRITICAL";
  if (inc.consensus_depth_band === "40_TO_60CM") return "HIGH";
  if (inc.consensus_depth_band === "20_TO_40CM") return "MEDIUM";
  return "LOW";
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const res = await api.getIncidents();
      setIncidents(res.data);
    } catch (err) {
      console.error("Failed to load incidents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 20000);
    return () => clearInterval(interval);
  }, []);

  const filtered = incidents.filter((inc) => {
    const sev = getSeverity(inc);
    if (filterSeverity === "ALL") return true;
    return sev === filterSeverity;
  });

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-primary-400 uppercase tracking-widest mb-1">
            <Radio className="w-4 h-4" />
            <span>SPATIO-TEMPORAL CLUSTERED INCIDENTS</span>
          </div>
          <h1 className="text-2xl font-black text-white">Active Flood Hotspots & Incidents</h1>
          <p className="text-sm text-gray-400 mt-1">
            Aggregated spatio-temporal clusters computed from corroborating citizen reports in Lat Krabang.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadIncidents}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-card border border-surface-border text-xs font-bold text-gray-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/map"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs uppercase tracking-wider transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>View on Map</span>
          </Link>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-mono">
        <Filter className="w-4 h-4 text-gray-400 shrink-0 mr-1" />
        {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              filterSeverity === sev
                ? "bg-primary-500/20 border-primary-500 text-primary-300 font-bold"
                : "bg-surface border-surface-border text-gray-400 hover:text-white"
            }`}
          >
            {sev}
          </button>
        ))}
        <span className="text-gray-500 ml-auto text-[11px]">
          Showing {filtered.length} of {incidents.length} clusters
        </span>
      </div>

      {/* INCIDENTS GRID */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-surface-card border border-surface-border rounded-2xl space-y-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">No active incidents matching criteria</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Surface drainage in monitored corridors is currently stable or within safe operational thresholds.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((inc) => {
            const sev = getSeverity(inc);
            const sevColors: Record<string, { bg: string; text: string; border: string }> = {
              CRITICAL: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
              HIGH: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
              MEDIUM: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30" },
              LOW: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" }
            };
            const style = sevColors[sev] || sevColors.LOW;

            return (
              <div
                key={inc.id}
                className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4 hover:border-gray-600 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${style.bg} ${style.text} ${style.border}`}>
                      {sev} SEVERITY
                    </span>
                    <span className="text-[11px] font-mono text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(inc.first_reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white line-clamp-2">
                    {inc.title || `Incident Cluster #${inc.id.slice(0, 8)}`}
                  </h3>

                  <div className="text-xs text-gray-400 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary-400 shrink-0" />
                      <span className="font-mono text-[11px] text-gray-300">
                        {inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{inc.report_count} corroborating citizen reports</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 font-mono text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-surface border border-surface-border text-orange-300">
                        Depth: {inc.consensus_depth_band.replace("BELOW_", "< ").replace("_TO_", "–").replace("ABOVE_", "> ")}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-surface border border-surface-border text-gray-300">
                        {inc.consensus_passability}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-surface-border flex items-center justify-between text-xs">
                  <span className="text-gray-400 text-[11px]">
                    Confidence: <strong className="text-white">{inc.confidence}</strong>
                  </span>

                  <Link
                    href={`/map?lat=${inc.latitude}&lng=${inc.longitude}&zoom=16`}
                    className="text-primary-400 hover:text-primary-300 font-bold flex items-center gap-1"
                  >
                    <span>Inspect</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
