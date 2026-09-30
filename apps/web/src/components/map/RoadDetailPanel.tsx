"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Navigation,
  Compass,
  TrendingUp,
  TrendingDown,
  Minus,
  Droplets,
  Layers,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  CheckCircle2,
  HelpCircle,
  Activity
} from "lucide-react";
import { RoadProperties, RoadHistoryPoint } from "../../lib/types";
import { api } from "../../lib/api";
import clsx from "clsx";

interface RoadDetailPanelProps {
  road: RoadProperties;
  onClose: () => void;
  onFollowWaterMovement?: (road: RoadProperties) => void;
  onClearTrace?: () => void;
  isFlowTracing?: boolean;
  isTracing?: boolean;
  className?: string;
}

export const RoadDetailPanel: React.FC<RoadDetailPanelProps> = ({
  road,
  onClose,
  onFollowWaterMovement,
  onClearTrace,
  isFlowTracing = false,
  isTracing,
  className
}) => {
  const isTracingActive = isTracing ?? isFlowTracing;
  const [history, setHistory] = useState<RoadHistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showWhyExplanation, setShowWhyExplanation] = useState(false);

  // Safely normalize flow_path_steps regardless of whether GeoJSON passed an array or JSON string
  const flowPathSteps = React.useMemo(() => {
    if (!road.flow_path_steps) return [];
    if (Array.isArray(road.flow_path_steps)) return road.flow_path_steps;
    if (typeof road.flow_path_steps === "string") {
      try {
        const parsed = JSON.parse(road.flow_path_steps);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [road.flow_path_steps]);

  // Safely normalize flow_explanation
  const flowExplanation = React.useMemo(() => {
    if (!road.flow_explanation) return null;
    if (typeof road.flow_explanation === "object") return road.flow_explanation;
    if (typeof road.flow_explanation === "string") {
      try {
        const parsed = JSON.parse(road.flow_explanation);
        return typeof parsed === "object" ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }, [road.flow_explanation]);

  useEffect(() => {
    let isMounted = true;
    setLoadingHistory(true);
    api.getRoadHistory(road.road_segment_id)
      .then((res) => {
        if (isMounted) {
          setHistory(res || []);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch road history:", err);
        if (isMounted) setHistory([]);
      })
      .finally(() => {
        if (isMounted) setLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [road.road_segment_id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "BLOCKED":
        return {
          bg: "bg-red-950 text-red-100 border-red-800",
          label: "BLOCKED / ปิดการจราจร",
          color: "#991b1b"
        };
      case "SEVERELY_FLOODED":
        return {
          bg: "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-200 border-red-300 dark:border-red-800",
          label: "SEVERELY FLOODED / ท่วมสูงวิกฤต",
          color: "#ef4444"
        };
      case "FLOODED":
        return {
          bg: "bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-800",
          label: "FLOODED / มีน้ำท่วมขัง",
          color: "#f97316"
        };
      case "WATER_PRESENT":
        return {
          bg: "bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-800",
          label: "WATER PRESENT / ผิวทางเปียกขัง",
          color: "#eab308"
        };
      case "NO_EVIDENCE":
        return {
          bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
          label: "NO EVIDENCE / ไม่มีหลักฐานน้ำท่วมล่าสุด",
          color: "#94a3b8"
        };
      default:
        return {
          bg: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300",
          label: "UNKNOWN / ไม่ทราบสถานะ",
          color: "#64748b"
        };
    }
  };

  const statusConfig = getStatusBadge(road.status);

  const getTrendIcon = (trend: string) => {
    if (trend === "INCREASING") {
      return <TrendingUp className="w-3.5 h-3.5 text-red-600 shrink-0" />;
    }
    if (trend === "DECREASING") {
      return <TrendingDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    }
    if (trend === "STABLE") {
      return <Minus className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
    }
    return <span className="text-[10px] text-slate-400 font-mono">UNKNOWN</span>;
  };

  const hasFlowEvidence = road.flow_status === "ESTIMATED" || road.flow_status === "OBSERVED";
  const depth1hAgo =
    road.water_depth_cm != null && road.change_1h_cm != null
      ? Math.max(0, Math.round((road.water_depth_cm - road.change_1h_cm) * 10) / 10)
      : null;

  return (
    <div
      className={clsx(
        "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 sm:p-5 space-y-3.5 w-full transition-all animate-in slide-in-from-bottom duration-200 overflow-y-auto max-h-[75vh] sm:max-h-[85vh]",
        className
      )}
    >
      {/* MOBILE SHEET DRAG HANDLE */}
      <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto sm:hidden" />

      {/* HEADER */}
      <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={clsx(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border",
                statusConfig.bg
              )}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusConfig.color }} />
              <span>{statusConfig.label}</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {road.road_segment_id}
            </span>
          </div>
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-snug">
            {road.road_name}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          aria-label="Close road details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* SECTION 13: ROAD TREND & WATER DEPTH */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Current Depth */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Current Depth (ระดับน้ำ)
            </span>
            <Droplets className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="font-black text-sm text-slate-900 dark:text-slate-100 mt-1">
            {road.water_depth_display ? road.water_depth_display : "No depth evidence"}
          </div>
          <div className="text-[9px] font-mono text-slate-500 mt-0.5">
            Status: <strong className="text-slate-700 dark:text-slate-300">{road.measurement_status}</strong>
          </div>
        </div>

        {/* Trend & 1h Change */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              1-Hour Trend (แนวโน้ม)
            </span>
            {getTrendIcon(road.trend)}
          </div>
          <div className="font-black text-sm text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-1.5">
            <span>{road.trend}</span>
            {road.change_1h_cm != null && (
              <span className="text-[11px] font-mono font-normal text-slate-500">
                ({road.change_1h_cm > 0 ? `+${road.change_1h_cm}` : road.change_1h_cm} cm)
              </span>
            )}
          </div>
          <div className="text-[9px] font-mono text-slate-500 mt-0.5">
            1h ago: <strong className="text-slate-700 dark:text-slate-300">{depth1hAgo != null ? `${depth1hAgo} cm` : "n/a"}</strong>
          </div>
        </div>
      </div>

      {/* SECTION 2, 3, 4, 5, 6, 7, 8: WATER MOVEMENT INTELLIGENCE */}
      <div className="bg-cyan-50/40 dark:bg-cyan-950/20 p-3 rounded-xl border border-cyan-200 dark:border-cyan-800 text-xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-cyan-200/60 dark:border-cyan-800/60 pb-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-900 dark:text-cyan-200 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Water Movement (ทิศทางการไหล)</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 font-bold border border-cyan-300">
              {road.flow_status}
            </span>
            {road.flow_confidence && road.flow_confidence !== "UNKNOWN" && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-300">
                Conf: {road.flow_confidence}
              </span>
            )}
          </div>
        </div>

        {/* SECTION 16: UNKNOWN STATE HANDLING */}
        {!hasFlowEvidence ? (
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200 text-xs">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span>WATER MOVEMENT UNKNOWN</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {road.flow_story || "Water movement cannot currently be determined from available observations."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Human-Friendly Flow Story (Section 8) */}
            <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-cyan-100 dark:border-cyan-900/40 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
              {road.flow_story}
            </div>

            {/* Source / Path / Destination Breakdown (Section 5) */}
            <div className="space-y-1.5 p-2 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-cyan-100/60 dark:border-cyan-900/30 text-[11px] font-mono">
              <div className="flex items-start gap-2">
                <span className="text-slate-400 text-[10px] w-28 shrink-0">FLOW ORIGIN:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{road.flow_origin || road.road_name} ({road.elevation_m}m MSL)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-400 text-[10px] w-28 shrink-0">MOVING TOWARD:</span>
                <span className="font-semibold text-cyan-700 dark:text-cyan-300">{road.flow_direction}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-400 text-[10px] w-28 shrink-0">LIKELY DRAINAGE:</span>
                <span className="font-bold text-teal-700 dark:text-teal-300">{road.drainage_destination}</span>
              </div>
            </div>

            {/* FLOW TRACE STEPS DIAGRAM (Section 3) */}
            {flowPathSteps.length > 0 && (
              <div className="p-2.5 rounded-lg bg-slate-900 text-white space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
                  <span>Traced Flow Pathway</span>
                  <span className="text-[9px] text-slate-400">DEM Slope Chain</span>
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  {flowPathSteps.map((st: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/80 text-cyan-300 flex items-center justify-center text-[10px] shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 truncate">
                        <span className="text-slate-200 font-bold">{st.name}</span>
                        {st.elevation_m != null && (
                          <span className="text-slate-400 text-[10px] ml-1">({st.elevation_m}m MSL)</span>
                        )}
                      </div>
                      {i < flowPathSteps.length - 1 && (
                        <span className="text-cyan-400 text-xs shrink-0">↓</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ACTION BUTTON: FOLLOW WATER MOVEMENT (Section 3 & Section 14) */}
            <div className="pt-1 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => onFollowWaterMovement?.(road)}
                className={clsx(
                  "w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm",
                  isTracingActive
                    ? "bg-cyan-600 text-white hover:bg-cyan-700 shadow-cyan-600/30"
                    : "bg-cyan-700 text-white hover:bg-cyan-800 shadow-md"
                )}
              >
                <Compass className="w-4 h-4 shrink-0" />
                <span>{isTracingActive ? "✓ TRACING ACTIVE FLOW PATH" : "FOLLOW WATER MOVEMENT (ติดตามเส้นทางน้ำไหล)"}</span>
              </button>

              {isTracingActive && onClearTrace && (
                <button
                  type="button"
                  onClick={onClearTrace}
                  className="w-full py-1 text-[11px] font-mono text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  ✕ Clear flow trace
                </button>
              )}
            </div>

            {/* SECTION 7: COMPACT FLOW EXPLANATION ("WHY THIS FLOW?") */}
            <div className="pt-1 border-t border-cyan-200/60 dark:border-cyan-800/60">
              <button
                type="button"
                onClick={() => setShowWhyExplanation(!showWhyExplanation)}
                className="w-full flex items-center justify-between text-[11px] font-bold text-cyan-800 dark:text-cyan-300 hover:underline py-1"
              >
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Why this flow direction? (เหตุผลการประเมินทิศทางน้ำ)</span>
                </span>
                {showWhyExplanation ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showWhyExplanation && flowExplanation && (
                <div className="mt-2 p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-cyan-200 dark:border-cyan-800/80 text-[11px] space-y-2">
                  {Array.isArray(flowExplanation.evidence_based_on) && flowExplanation.evidence_based_on.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Based on (หลักฐานที่ใช้):</div>
                      <ul className="mt-1 space-y-1 text-slate-700 dark:text-slate-300">
                        {flowExplanation.evidence_based_on.map((ev: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{ev}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(flowExplanation.missing_evidence) && flowExplanation.missing_evidence.length > 0 && (
                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Missing (ข้อมูลที่ยังขาด):</div>
                      <ul className="mt-1 space-y-1 text-slate-500 dark:text-slate-400">
                        {flowExplanation.missing_evidence.map((me: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 flex items-center justify-center text-[9px] shrink-0 mt-0.5">!</span>
                            <span>{me}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {flowExplanation.confidence && (
                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>Flow Model Confidence:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{flowExplanation.confidence}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TIME-SERIES HISTORICAL OBSERVATIONS CHART */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Historical Evidence Points (Timeline)</span>
          </span>
          <span className="text-[9px] font-mono text-slate-400">
            {history.length} Real Observations
          </span>
        </div>

        {loadingHistory ? (
          <div className="py-3 text-center text-xs text-slate-400 font-mono animate-pulse">
            Loading historical observations...
          </div>
        ) : history.length === 0 ? (
          <div className="py-2.5 text-center text-xs text-slate-400 font-mono">
            No historical observations recorded for this segment.
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500 pb-1 border-b border-slate-200 dark:border-slate-700">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> OBSERVED
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> REPORTED
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> ESTIMATED
              </span>
            </div>

            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
              {history.map((pt, idx) => {
                const dotColor =
                  pt.measurement_status === "OBSERVED"
                    ? "bg-emerald-500"
                    : pt.measurement_status === "REPORTED"
                    ? "bg-blue-500"
                    : "bg-purple-500";

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className={clsx("w-2 h-2 rounded-full shrink-0", dotColor)} />
                      <span className="font-mono text-[10px] text-slate-500">
                        {new Date(pt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {pt.water_depth_display || (pt.water_depth_cm ? `${pt.water_depth_cm} cm` : pt.status)}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {pt.measurement_status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* DATA PROVENANCE & ATTRIBUTION */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Evidence Provenance</span>
          </span>
          <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {road.measurement_status}
          </span>
        </div>

        <div className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">
          Source: {road.source}
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500 pt-1">
          <div>
            Observed: <strong className="text-slate-700 dark:text-slate-300">{road.observed_at ? new Date(road.observed_at).toLocaleTimeString() : "No recent evidence"}</strong>
          </div>
          <div>
            Freshness: <strong className="text-slate-700 dark:text-slate-300">{road.freshness}</strong>
          </div>
          <div>
            Confidence: <strong className="text-slate-700 dark:text-slate-300">{road.confidence}</strong>
          </div>
          <div>
            Corroborating: <strong className="text-slate-700 dark:text-slate-300">{road.corroborating_reports} reports</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
