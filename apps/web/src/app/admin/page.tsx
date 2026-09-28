"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  LifeBuoy,
  Database,
  CheckCircle,
  Clock,
  RefreshCw,
  TrendingUp,
  Activity
} from "lucide-react";
import { api } from "../../lib/api";
import { Incident, HelpRequest, SituationSummary } from "../../lib/types";

export default function AdminPage() {
  const [summary, setSummary] = useState<SituationSummary | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [sumRes, incRes, helpRes] = await Promise.all([
        api.getSituationSummary(),
        api.getIncidents(),
        api.getHelpRequests()
      ]);
      setSummary(sumRes.data);
      setIncidents(incRes.data);
      setHelpRequests(helpRes.data);
    } catch (err) {
      console.error("Admin dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* HEADER & OPERATIONS STATUS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-primary-400 uppercase tracking-widest mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>KMITL EMERGENCY OPERATIONS CENTER (EOC)</span>
          </div>
          <h1 className="text-2xl font-black text-white">Operations & Triage Dashboard</h1>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-card border border-surface-border text-xs font-bold text-gray-300 hover:text-white transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-primary-400" />
          <span>Refresh Feeds</span>
        </button>
      </div>

      {/* TOP METRICS SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <div className="text-xs text-gray-400 mb-1 flex items-center justify-between">
            <span>ACTIVE INCIDENTS</span>
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-3xl font-black text-orange-400">
            {incidents.length}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            DBSCAN clusters in Lat Krabang
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <div className="text-xs text-gray-400 mb-1 flex items-center justify-between">
            <span>PENDING SOS REQUESTS</span>
            <LifeBuoy className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-3xl font-black text-red-400">
            {helpRequests.filter((h) => h.status === "OPEN").length}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Requiring immediate triage
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <div className="text-xs text-gray-400 mb-1 flex items-center justify-between">
            <span>DATA SOURCE INTEGRITY</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400">
            4 / 4
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            All registered adapters operational
          </div>
        </div>
      </div>

      {/* DATA SOURCES HEALTH MONITOR */}
      <section className="bg-surface-card border border-surface-border rounded-2xl p-6">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary-400" />
          <span>External Data Ingestion Pipeline & Health Telemetry</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              name: "TMD Weather & Radar",
              status: "AVAILABLE",
              mode: "DEMO / MODEL",
              lastRun: "3 min ago",
              latency: "18 ms",
              badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            },
            {
              name: "BMA DDS Canal Gauges",
              status: "AVAILABLE",
              mode: "DEMO / MODEL",
              lastRun: "5 min ago",
              latency: "24 ms",
              badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            },
            {
              name: "Traffy Fondue Reports",
              status: "AVAILABLE",
              mode: "DEMO / MOCK",
              lastRun: "12 min ago",
              latency: "15 ms",
              badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            },
            {
              name: "Copernicus Sentinel-1 SAR",
              status: "OBSERVATIONAL",
              mode: "EVIDENCE (14h)",
              lastRun: "14 hours ago",
              latency: "35 ms",
              badge: "bg-purple-500/10 text-purple-400 border-purple-500/30"
            }
          ].map((src, i) => (
            <div key={i} className="bg-surface/60 border border-surface-border/60 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">{src.name}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${src.badge}`}>
                  {src.status}
                </span>
              </div>
              <div className="text-[11px] font-mono text-gray-400 space-y-0.5">
                <div>Mode: <span className="text-gray-200">{src.mode}</span></div>
                <div>Last Sync: <span className="text-gray-200">{src.lastRun}</span></div>
                <div>Ping: <span className="text-gray-200">{src.latency}</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* EMERGENCY SOS REQUESTS QUEUE */}
      <section className="bg-surface-card border border-surface-border rounded-2xl p-6">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <LifeBuoy className="w-4 h-4 text-red-400" />
          <span>Active SOS Assistance Dispatch Queue</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-surface-border text-gray-400 font-mono">
              <tr>
                <th className="pb-3">Ticket</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Requester</th>
                <th className="pb-3">Contact</th>
                <th className="pb-3">People</th>
                <th className="pb-3">Priority</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border text-gray-300">
              {helpRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-gray-500">
                    No active emergency requests in queue.
                  </td>
                </tr>
              ) : (
                helpRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-surface/50 transition-colors">
                    <td className="py-3 font-mono text-primary-400 font-bold">#{req.ticket_number}</td>
                    <td className="py-3 font-bold text-white">{req.help_type}</td>
                    <td className="py-3">{req.requester_name || "Anonymous"}</td>
                    <td className="py-3 font-mono">{req.contact_phone || "N/A"}</td>
                    <td className="py-3">{req.people_count}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-red-600/20 text-red-400 font-bold border border-red-500/30 text-[10px]">
                        {req.priority}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-[10px]">
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
