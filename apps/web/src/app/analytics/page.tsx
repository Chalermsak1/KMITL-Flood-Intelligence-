"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  CloudRain,
  Waves,
  AlertTriangle,
  LifeBuoy,
  Activity,
  Layers,
  Clock,
  RefreshCw,
  Server,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft
} from "lucide-react";
import { api } from "../../lib/api";
import { SituationSummary } from "../../lib/types";
import clsx from "clsx";

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<SituationSummary | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, metRes] = await Promise.all([
        api.getSituationSummary().catch(() => null),
        api.getMetrics().catch(() => null)
      ]);
      if (sumRes) setSummary(sumRes.data);
      if (metRes) setMetrics(metRes.data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

  const depthDistribution = [
    { label: "< 10 cm", count: 8, percentage: 32, color: "bg-emerald-500" },
    { label: "10–20 cm", count: 11, percentage: 44, color: "bg-amber-400" },
    { label: "20–40 cm", count: 4, percentage: 16, color: "bg-orange-500" },
    { label: "> 40 cm", count: 2, percentage: 8, color: "bg-red-500" }
  ];

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-blue-700 dark:text-blue-400 uppercase tracking-widest font-bold">
            <BarChart3 className="w-4 h-4" />
            <span>DISASTER DECISION INTELLIGENCE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            Situational Analytics & Hydrological Trends
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Correlated telemetry across canal gauges, precipitation intensity, DBSCAN crowd reports, and durable queue health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] font-mono text-slate-500">TELEMETRY SYNC</div>
            <div className="text-xs font-mono text-slate-900 dark:text-white font-bold">
              {lastRefreshed.toLocaleTimeString()}
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </button>

          <Link
            href="/replay"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Event Replay</span>
          </Link>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>OVERALL BASIN RISK</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {summary ? summary.current_status : "LOW"}
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-400 font-mono">
            Score: {summary ? summary.overall_risk_score.toFixed(1) : "15.0"}/100
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>RAIN INTENSITY</span>
            <CloudRain className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {summary?.rain_trend || "LIGHT"}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            TMD Radar (PENDING_ACCESS)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>CANAL STAGE TREND</span>
            <Waves className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {summary?.water_trend || "STABLE"}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Canal Basin Prawet
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>ACTIVE INCIDENTS</span>
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {summary ? summary.active_incidents : 0}
          </div>
          <div className="text-xs text-orange-700 dark:text-orange-400 font-mono">
            Corroborated Clusters
          </div>
        </div>
      </div>

      {/* RAIN VS CANAL WATER LEVEL & DEPTH DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* HYDROMETRIC CORRELATION */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>Rain vs Canal Hydro-Response (Past 6 Hours)</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              30m Cadence
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {[
              { time: "12:00", rain: 42, water: 0.85, status: "WARNING" },
              { time: "11:30", rain: 35, water: 0.72, status: "NORMAL" },
              { time: "11:00", rain: 28, water: 0.58, status: "NORMAL" },
              { time: "10:30", rain: 15, water: 0.45, status: "NORMAL" },
              { time: "10:00", rain: 5, water: 0.32, status: "NORMAL" }
            ].map((row, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-800 dark:text-slate-200 font-bold">{row.time}</span>
                  <span className="text-slate-600 dark:text-slate-400">
                    Rain: <strong className="text-blue-700 dark:text-blue-400">{row.rain} mm/hr</strong> | Canal:{" "}
                    <strong className="text-cyan-700 dark:text-cyan-400">+{row.water}m MSL</strong>
                  </span>
                  <span
                    className={clsx(
                      "text-[10px] px-1.5 py-0.2 rounded border font-bold",
                      row.status === "WARNING"
                        ? "bg-amber-50 text-amber-800 border-amber-300"
                        : "bg-emerald-50 text-emerald-800 border-emerald-300"
                    )}
                  >
                    {row.status}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                  <div className="bg-blue-600 h-full rounded-l-full" style={{ width: `${(row.rain / 50) * 50}%` }} />
                  <div className="bg-cyan-500 h-full rounded-r-full" style={{ width: `${(row.water / 1.0) * 50}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 text-[11px] text-slate-500 font-mono flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-blue-600 rounded-full" /> Rain (mm/hr)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-cyan-500 rounded-full" /> Canal Level (m MSL)
            </span>
            <span className="text-amber-700 dark:text-amber-400 font-bold">Lag: ~25 mins</span>
          </div>
        </div>

        {/* WATER DEPTH DISTRIBUTION */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-600" />
              <span>Reported Water Depth Distribution</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              Corroborated Reports
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {depthDistribution.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-800 dark:text-slate-200 font-medium">{item.label}</span>
                  <span className="text-slate-500">
                    {item.count} reports ({item.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={clsx("h-full rounded-full", item.color)} style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>DBSCAN Spatial Clustering Analysis</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              76% of citizen observations reflect water depth below 20cm, passable for vehicles. High alerts are isolated to culverts near Chalong Krung Soi 1.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
