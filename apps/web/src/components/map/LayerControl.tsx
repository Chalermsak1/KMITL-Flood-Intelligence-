"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  AlertTriangle,
  Droplets,
  CloudRain,
  Satellite,
  Building,
  Eye,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import clsx from "clsx";

export interface LayerState {
  floodStatus: boolean;
  waterDepth: boolean;
  floodTrend: boolean;
  waterFlow: boolean;
  drainage: boolean;
  reports: boolean;
  incidents: boolean;
  waterStations: boolean;
  rain: boolean;
  shelters: boolean;
  satellite?: boolean;
}

interface LayerControlProps {
  layers: LayerState;
  onChange: (layers: LayerState) => void;
  className?: string;
  counts?: {
    incidents?: number;
    reports?: number;
    waterStations?: number;
    shelters?: number;
    floodedRoads?: number;
  };
}

export const LayerControl: React.FC<LayerControlProps> = ({
  layers,
  onChange,
  className,
  counts
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggle = (key: keyof LayerState) => {
    onChange({ ...layers, [key]: !layers[key] });
  };

  const items = [
    {
      key: "floodStatus" as const,
      label: "1. Flood Status (Roads)",
      tag: "EVALUATED",
      count: counts?.floodedRoads,
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400",
      activeBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800"
    },
    {
      key: "waterDepth" as const,
      label: "2. Water Depth",
      tag: "MEASURED/REP",
      icon: Droplets,
      color: "text-blue-600 dark:text-blue-400",
      activeBg: "bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800"
    },
    {
      key: "floodTrend" as const,
      label: "3. Flood Trend",
      tag: "HISTORICAL",
      icon: Layers,
      color: "text-purple-600 dark:text-purple-400",
      activeBg: "bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-800"
    },
    {
      key: "waterFlow" as const,
      label: "4. Water Flow Direction",
      tag: "ESTIMATED",
      icon: Droplets,
      color: "text-cyan-600 dark:text-cyan-400",
      activeBg: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800"
    },
    {
      key: "drainage" as const,
      label: "5. Drainage Network",
      tag: "GEOGRAPHIC",
      icon: Layers,
      color: "text-teal-600 dark:text-teal-400",
      activeBg: "bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 border-teal-200 dark:border-teal-800"
    },
    {
      key: "reports" as const,
      label: "6. Citizen Reports",
      tag: "LIVE",
      count: counts?.reports,
      icon: Eye,
      color: "text-blue-600 dark:text-blue-400",
      activeBg: "bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800"
    },
    {
      key: "incidents" as const,
      label: "7. Flood Incidents",
      tag: "CLUSTERS",
      count: counts?.incidents,
      icon: AlertTriangle,
      color: "text-orange-600 dark:text-orange-400",
      activeBg: "bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800"
    },
    {
      key: "waterStations" as const,
      label: "8. Water Gauges (Canals)",
      tag: "PENDING_ACCESS",
      count: counts?.waterStations,
      icon: Droplets,
      color: "text-cyan-600 dark:text-cyan-400",
      activeBg: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800"
    },
    {
      key: "rain" as const,
      label: "9. Rain / Radar",
      tag: "PENDING_ACCESS",
      icon: CloudRain,
      color: "text-indigo-600 dark:text-indigo-400",
      activeBg: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800"
    },
    {
      key: "shelters" as const,
      label: "10. Shelters & Aid",
      tag: "VERIFIED",
      count: counts?.shelters,
      icon: Building,
      color: "text-emerald-600 dark:text-emerald-400",
      activeBg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
    },
  ];

  return (
    <div
      className={clsx(
        "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-md transition-all",
        isCollapsed ? "w-auto" : "w-64 max-w-[calc(100vw-2rem)]",
        className
      )}
    >
      {/* HEADER / TOGGLE */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between p-3 cursor-pointer select-none text-slate-800 dark:text-slate-200"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-bold font-mono uppercase tracking-wider">
            Operational Layers
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {Object.values(layers).filter(Boolean).length}/{items.length}
          </span>
        </div>
        <button
          type="button"
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label={isCollapsed ? "Expand layer controls" : "Collapse layer controls"}
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* LAYER LIST */}
      {!isCollapsed && (
        <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-slate-100 dark:border-slate-800">
          {items.map((item) => {
            const Icon = item.icon;
            const active = layers[item.key];
            return (
              <button
                key={item.key}
                onClick={() => toggle(item.key)}
                className={clsx(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all text-left",
                  active
                    ? item.activeBg
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={clsx("w-3.5 h-3.5 shrink-0", active ? item.color : "text-slate-400")} />
                  <span className="truncate">{item.label}</span>
                  {typeof item.count === "number" && (
                    <span className="text-[10px] font-mono px-1 rounded bg-black/5 dark:bg-white/10 shrink-0 font-bold">
                      {item.count}
                    </span>
                  )}
                </div>
                <div
                  className={clsx(
                    "w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] font-bold border transition-colors shrink-0 ml-2",
                    active
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-transparent"
                  )}
                >
                  ✓
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
