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
  Eye,
  Check,
  X,
  FileText,
  MapPin,
  ExternalLink,
  Info,
  Radio,
  Building,
  ChevronRight,
  Filter
} from "lucide-react";
import { api } from "../../lib/api";
import { Incident, FloodReport, HelpRequest, SituationSummary, DataSourceStatus } from "../../lib/types";

export default function AdminPage() {
  const [summary, setSummary] = useState<SituationSummary | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [reports, setReports] = useState<FloodReport[]>([]);
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<"ALL" | "PENDING" | "VERIFIED" | "REJECTED">("ALL");
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const loadData = async () => {
    try {
      const [sumRes, incRes, repRes, helpRes, statusRes] = await Promise.all([
        api.getSituationSummary().catch(() => ({ data: null })),
        api.getIncidents().catch(() => ({ data: [] })),
        api.getReports().catch(() => ({ data: [] })),
        api.getHelpRequests().catch(() => ({ data: [] })),
        api.getDataStatus().catch(() => ({ data: { sources: [] } }))
      ]);

      if (sumRes.data) setSummary(sumRes.data);
      if (incRes.data) setIncidents(incRes.data);
      if (repRes.data) setReports(repRes.data);
      if (helpRes.data) setHelpRequests(helpRes.data);
      if (statusRes.data?.sources) setDataSources(statusRes.data.sources);
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

  const handleReportOverride = async (reportId: string, action: string) => {
    setActionLoading(reportId);
    setStatusMessage(null);
    try {
      await api.overrideReport(reportId, action, `Operator reviewed via EOC console: ${action}`);
      setStatusMessage({ text: `Report #${reportId.slice(0, 8)} status updated to ${action}`, type: "success" });
      await loadData();
    } catch (err) {
      console.error("Override failed:", err);
      setStatusMessage({ text: `Failed to update report status: ${(err as Error).message}`, type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleIncidentResolve = async (incidentId: string) => {
    setActionLoading(incidentId);
    setStatusMessage(null);
    try {
      await api.updateIncidentStatus(incidentId, "RESOLVED", "Operator marked as resolved following drainage completion");
      setStatusMessage({ text: `Incident marked as RESOLVED`, type: "success" });
      await loadData();
    } catch (err) {
      console.error("Incident update failed:", err);
      setStatusMessage({ text: `Failed to resolve incident: ${(err as Error).message}`, type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    if (reportFilter === "PENDING") {
      return !r.verification_status || r.verification_status === "UNVERIFIED" || r.verification_status === "SUBMITTED" || r.verification_status === "UNDER_REVIEW";
    }
    if (reportFilter === "VERIFIED") {
      return r.verification_status === "ADMIN_VERIFIED" || r.verification_status === "AI_CONFIRMED" || r.verification_status === "VERIFIED";
    }
    if (reportFilter === "REJECTED") {
      return r.verification_status === "REJECTED";
    }
    return true;
  });

  const pendingReportsCount = reports.filter(
    (r) => !r.verification_status || r.verification_status === "UNVERIFIED" || r.verification_status === "SUBMITTED" || r.verification_status === "UNDER_REVIEW"
  ).length;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-slate-50 text-slate-800">
      {/* HEADER & OPERATIONS STATUS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-blue-700 uppercase tracking-wider mb-1 font-semibold">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>KMITL EMERGENCY OPERATIONS CENTER (EOC)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Operator & Triage Console</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational review, citizen verification, and source telemetry management
          </p>
        </div>

        <div className="flex items-center gap-3">
          {statusMessage && (
            <div
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-red-50 text-red-800 border-red-200"
              }`}
            >
              {statusMessage.text}
            </div>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 shadow-sm transition-colors self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Feeds</span>
          </button>
        </div>
      </div>

      {/* TOP METRICS SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-500 mb-1 flex items-center justify-between">
            <span>ACTIVE INCIDENTS</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-3xl font-black text-orange-600">
            {incidents.filter((i) => i.status === "ACTIVE").length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            Clustered areas requiring monitoring
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-500 mb-1 flex items-center justify-between">
            <span>PENDING CITIZEN REPORTS</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-black text-blue-600">
            {pendingReportsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            Awaiting operator triage / verification
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-500 mb-1 flex items-center justify-between">
            <span>PENDING SOS REQUESTS</span>
            <LifeBuoy className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-3xl font-black text-red-600">
            {helpRequests.filter((h) => h.status === "OPEN").length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            Pilot emergency assistance calls
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-500 mb-1 flex items-center justify-between">
            <span>SOURCE PROVENANCE</span>
            <Database className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-emerald-600">
            1 LIVE / 3 PENDING
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            Citizen reports operational
          </div>
        </div>
      </div>

      {/* SECTION 1: CITIZEN REPORT REVIEW & TRIAGE (MASTER REQUIREMENT #10) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Incoming Citizen Reports & Verification Triage</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review photos, locations, and depth reports. Unverified citizen reports do not automatically become verified incidents.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
            <button
              onClick={() => setReportFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                reportFilter === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({reports.length})
            </button>
            <button
              onClick={() => setReportFilter("PENDING")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                reportFilter === "PENDING" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Pending ({pendingReportsCount})
            </button>
            <button
              onClick={() => setReportFilter("VERIFIED")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                reportFilter === "VERIFIED" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Verified
            </button>
            <button
              onClick={() => setReportFilter("REJECTED")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                reportFilter === "REJECTED" ? "bg-white text-red-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Rejected
            </button>
          </div>
        </div>

        {/* Reports Table / Card List */}
        {filteredReports.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <CheckCircle className="w-8 h-8 mx-auto text-emerald-400 opacity-60" />
            <p className="text-sm font-medium">No reports matching filter &ldquo;{reportFilter}&rdquo;</p>
            <p className="text-xs text-slate-400">All citizen submissions are current or triaged.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredReports.map((report) => {
              const reportLat = report.latitude ?? 13.7278;
              const reportLng = report.longitude ?? 100.7782;
              const isPending =
                !report.verification_status ||
                report.verification_status === "UNVERIFIED" ||
                report.verification_status === "SUBMITTED" ||
                report.verification_status === "UNDER_REVIEW";

              const statusBadgeStyles: Record<string, string> = {
                ADMIN_VERIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
                AI_CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
                VERIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
                REJECTED: "bg-red-50 text-red-700 border-red-200",
                UNDER_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
                UNVERIFIED: "bg-slate-100 text-slate-700 border-slate-200",
                SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200"
              };

              const badgeClass = statusBadgeStyles[report.verification_status] || "bg-slate-100 text-slate-700 border-slate-200";

              return (
                <div key={report.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/60 px-2 rounded-xl transition-colors">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        #{report.id.slice(0, 8)}
                      </span>
                      <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${badgeClass}`}>
                        {report.verification_status || "SUBMITTED"}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        SOURCE: CITIZEN_REPORT
                      </span>
                      <span className="text-xs text-slate-400">
                        {report.observed_at ? new Date(report.observed_at).toLocaleTimeString("th-TH") : "Just now"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <div>
                        <strong className="text-slate-800">Depth:</strong> {report.water_depth_band?.replace(/_/g, " ")}
                      </div>
                      <div>
                        <strong className="text-slate-800">Passability:</strong> {report.vehicle_passability || "UNKNOWN"}
                      </div>
                      <div>
                        <strong className="text-slate-800">Vehicle:</strong> {report.transport_type || "N/A"}
                      </div>
                      <div className="flex items-center gap-1 font-mono text-slate-500">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{Number(reportLat).toFixed(4)}, {Number(reportLng).toFixed(4)}</span>
                      </div>
                    </div>

                    {report.description && (
                      <p className="text-xs text-slate-700 bg-slate-50 border border-slate-100 p-2 rounded-lg italic">
                        &ldquo;{report.description}&rdquo;
                      </p>
                    )}

                    {report.photo_url && (
                      <div className="pt-1">
                        <a
                          href={report.photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Attached Photo Evidence</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Operator Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 self-end lg:self-center">
                    <button
                      onClick={() => handleReportOverride(report.id, "ADMIN_VERIFIED")}
                      disabled={actionLoading === report.id || report.verification_status === "ADMIN_VERIFIED"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-40 transition-colors shadow-sm"
                      title="Verify and confirm citizen report"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Verify</span>
                    </button>

                    <button
                      onClick={() => handleReportOverride(report.id, "REJECTED")}
                      disabled={actionLoading === report.id || report.verification_status === "REJECTED"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-40 transition-colors shadow-sm"
                      title="Reject false or duplicate report"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => handleReportOverride(report.id, "UNDER_REVIEW")}
                      disabled={actionLoading === report.id || report.verification_status === "UNDER_REVIEW"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold disabled:opacity-40 transition-colors shadow-sm"
                      title="Mark as under active verification"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Review</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: ACTIVE INCIDENTS MANAGEMENT */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <span>Active Clustered Flood Incidents (DBSCAN Clusters)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated from multi-point citizen reports and sensor telemetry
            </p>
          </div>
        </div>

        {incidents.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <CheckCircle className="w-8 h-8 mx-auto text-emerald-500 mb-1 opacity-60" />
            <p className="text-sm font-medium">No active flood incidents recorded.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="p-4 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md">
                      INC-{inc.incident_number}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{inc.title}</h3>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        inc.status === "ACTIVE"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <div>
                      <strong>Reports:</strong> {inc.report_count}
                    </div>
                    <div>
                      <strong>Depth:</strong> {inc.consensus_depth_band?.replace(/_/g, " ")}
                    </div>
                    <div>
                      <strong>Passability:</strong> {inc.consensus_passability}
                    </div>
                    <div>
                      <strong>Coordinates:</strong> {Number(inc.latitude).toFixed(4)}, {Number(inc.longitude).toFixed(4)}
                    </div>
                  </div>

                  {inc.admin_notes && (
                    <p className="text-xs text-slate-600 bg-white border border-slate-100 p-2 rounded-lg mt-1">
                      <strong>Admin Notes:</strong> {inc.admin_notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {inc.status === "ACTIVE" && (
                    <button
                      onClick={() => handleIncidentResolve(inc.id)}
                      disabled={actionLoading === inc.id}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold shadow-sm transition-colors"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 3: DATA SOURCES PROVENANCE & HEALTH MONITOR */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-600" />
            <span>External Data Sources & Realtime Adapter Telemetry</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent provenance badges communicating live ingestion state vs unavailable external APIs
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {[
            {
              source_id: "SRC_USER_REPORT",
              name: "Citizen Reports",
              full_name: "KMITL Direct Mobile Citizen Reports",
              mode: "LIVE",
              badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
              statusText: "Operational",
              description: "Direct crowd reports with 100m geo-fuzzing and spam rate limiting"
            },
            {
              source_id: "SRC_COPERNICUS_S1",
              name: "Copernicus S1",
              full_name: "Sentinel-1 Synthetic Aperture Radar",
              mode: "OBSERVATION",
              badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
              statusText: "Observation Archive",
              description: "Satellite SAR water index (Pass cadence ~14h ago)"
            },
            {
              source_id: "SRC_TMD_WEATHER",
              name: "TMD Radar",
              full_name: "Thai Meteorological Department Radar",
              mode: "PENDING_ACCESS",
              badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
              statusText: "Pending Access",
              description: "Official radar feed credentials pending TMD MOU approval"
            },
            {
              source_id: "SRC_BMA_DDS",
              name: "BMA Canal Telemetry",
              full_name: "BMA Drainage and Sewerage Department",
              mode: "PENDING_ACCESS",
              badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
              statusText: "Pending Access",
              description: "Canal gauge telemetry agreement pending data-sharing authorization"
            },
            {
              source_id: "SRC_TRAFFY_FONDUE",
              name: "Traffy Fondue",
              full_name: "NECTEC Traffy Fondue Open Data API",
              mode: "PENDING_ACCESS",
              badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
              statusText: "Pending Access",
              description: "Production API key request in queue with NECTEC team"
            }
          ].map((src) => (
            <div key={src.source_id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-slate-900 truncate" title={src.full_name}>
                    {src.name}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${src.badgeColor}`}>
                    {src.mode}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  Status: <span className="font-semibold text-slate-700">{src.statusText}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 border-t border-slate-200 pt-2 leading-tight">
                {src.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: EMERGENCY SOS REQUESTS QUEUE */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-red-600" />
              <span>Active SOS Assistance Dispatch Queue</span>
            </h2>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
              PILOT / TEST DISPATCH
            </span>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2 text-xs text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Emergency Dispatch Policy Notice:</strong> This pilot application is not connected to 24/7 staffed rescue services.
              Dispatch entries below are triage tickets. Citizens in immediate danger must contact <strong>199 (Fire & Rescue)</strong> or <strong>1669 (Medical Emergency)</strong>.
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500 font-mono">
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
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {helpRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No active emergency assistance requests in queue.
                  </td>
                </tr>
              ) : (
                helpRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 font-mono text-blue-600 font-bold">#{req.ticket_number}</td>
                    <td className="py-3 font-bold text-slate-900">{req.help_type}</td>
                    <td className="py-3">{req.requester_name || "Anonymous"}</td>
                    <td className="py-3 font-mono">{req.contact_phone || "N/A"}</td>
                    <td className="py-3">{req.people_count}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold border border-red-200 text-[10px]">
                        {req.priority}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10px]">
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
