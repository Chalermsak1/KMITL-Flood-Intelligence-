"use client";

import React from "react";
import {
  X,
  AlertTriangle,
  Droplets,
  Building,
  Eye,
  Satellite,
  Clock,
  ShieldCheck,
  Info,
  ExternalLink,
  MapPin
} from "lucide-react";
import { SelectedFeature } from "../../lib/types";
import { ConfidenceIndicator } from "../common/ConfidenceIndicator";
import clsx from "clsx";
import Link from "next/link";

interface MarkerDetailPanelProps {
  feature: SelectedFeature | null;
  onClose: () => void;
  className?: string;
}

export const MarkerDetailPanel: React.FC<MarkerDetailPanelProps> = ({
  feature,
  onClose,
  className
}) => {
  if (!feature) return null;

  const getTypeConfig = () => {
    switch (feature.type) {
      case "INCIDENT":
        return {
          icon: AlertTriangle,
          label: "FLOOD HOTSPOT INCIDENT",
          badge: "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800"
        };
      case "CITIZEN_REPORT":
        return {
          icon: Eye,
          label: "CITIZEN FIELD REPORT",
          badge: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
        };
      case "WATER_STATION":
        return {
          icon: Droplets,
          label: "CANAL WATER GAUGE",
          badge: "bg-cyan-50 text-cyan-800 border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800"
        };
      case "SHELTER":
        return {
          icon: Building,
          label: "EMERGENCY AID / SHELTER",
          badge: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
        };
      case "SATELLITE":
        return {
          icon: Satellite,
          label: "SATELLITE SAR OBSERVATION",
          badge: "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
        };
      case "DRAINAGE":
        return {
          icon: Droplets,
          label: "DRAINAGE INFRASTRUCTURE",
          badge: "bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800"
        };
      default:
        return {
          icon: Info,
          label: feature.type,
          badge: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
        };
    }
  };

  const config = getTypeConfig();
  const Icon = config.icon;

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case "LIVE":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300";
      case "OBSERVATION":
        return "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300";
      case "PENDING_ACCESS":
        return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300";
      case "DEMO":
        return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  return (
    <div
      className={clsx(
        "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-5 space-y-4 max-w-sm w-full transition-all animate-in slide-in-from-bottom duration-200",
        className
      )}
    >
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span
              className={clsx(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border",
                config.badge
              )}
            >
              <Icon className="w-3 h-3" />
              <span>{config.label}</span>
            </span>
          </div>
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug">
            {feature.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close feature details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* RELEVANT MEASUREMENTS GRID */}
      {feature.measurements && Object.keys(feature.measurements).length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(feature.measurements).map(([key, val]) => (
            <div
              key={key}
              className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/60"
            >
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                {key}
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block truncate">
                {String(val ?? "-")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* METADATA LIST (Status, Timestamp, Confidence) */}
      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono">
        <div className="flex items-center justify-between py-0.5">
          <span className="text-slate-500">Status:</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {feature.status}
          </span>
        </div>

        <div className="flex items-center justify-between py-0.5">
          <span className="text-slate-500">Confidence:</span>
          <ConfidenceIndicator confidence={feature.confidence} />
        </div>

        <div className="flex items-center justify-between py-0.5">
          <span className="text-slate-500">Timestamp:</span>
          <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1 text-[11px]">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>
              {feature.timestamp ? new Date(feature.timestamp).toLocaleTimeString() : "Recent"}
            </span>
          </span>
        </div>
      </div>

      {/* DATA PROVENANCE (Honest Semantics) */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Data Provenance</span>
          </span>
          <span
            className={clsx(
              "px-1.5 py-0.2 rounded font-mono text-[9px] font-bold border",
              getModeBadge(feature.provenance?.mode || "LIVE")
            )}
          >
            {feature.provenance?.mode || "LIVE"}
          </span>
        </div>

        <div className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">
          Source: {feature.provenance?.attribution || feature.source}
        </div>

        {feature.provenance?.notes && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 italic">
            {feature.provenance.notes}
          </div>
        )}
      </div>

      {/* QUICK CONTEXT ACTIONS */}
      <div className="pt-1 flex items-center justify-between text-xs">
        {feature.type === "INCIDENT" && (
          <Link
            href="/incidents"
            className="text-blue-700 dark:text-blue-400 hover:underline font-bold flex items-center gap-1"
          >
            <span>View All Incidents</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
        {feature.type === "SHELTER" && (
          <Link
            href="/shelters"
            className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold flex items-center gap-1"
          >
            <span>View Shelter Directory</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
        <Link
          href="/report"
          className="text-orange-700 dark:text-orange-400 hover:underline font-bold flex items-center gap-1 ml-auto"
        >
          <span>Corroborate Report</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};
