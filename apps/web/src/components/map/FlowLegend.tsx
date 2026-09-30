"use client";

import React, { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import clsx from "clsx";

interface FlowLegendProps {
  className?: string;
  isWaterMovementMode?: boolean;
}

export const FlowLegend: React.FC<FlowLegendProps> = ({
  className,
  isWaterMovementMode = false
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={clsx(
        "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-2.5 text-xs select-none transition-all duration-200",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-slate-800 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
          <span>{isWaterMovementMode ? "➔ Water Movement Legend" : "🗺️ Map Legend"}</span>
        </div>
        <button
          type="button"
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5"
          aria-label={collapsed ? "Expand legend" : "Collapse legend"}
        >
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-2 space-y-2.5">
          {/* Visual Elements */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Map Elements</div>
            
            <div className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300">
              <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0 border border-white dark:border-slate-900 shadow-sm" />
              <span>● Flood / water observation (Sensor / Report)</span>
            </div>

            {isWaterMovementMode && (
              <div className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                <span className="font-bold text-cyan-600 dark:text-cyan-400 shrink-0 font-mono">➔</span>
                <span>→ Estimated water movement (Flow Vector)</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300">
              <span className="w-4 h-1 bg-cyan-600 rounded shrink-0" />
              <span>━━ Drainage path (Canal network / Swale)</span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300">
              <span className="w-3.5 h-3.5 border-2 border-teal-600 rounded bg-teal-50 dark:bg-teal-950 shrink-0 flex items-center justify-center text-[8px] font-bold text-teal-700">□</span>
              <span>□ Drainage infrastructure (Pump / Sluice / Basin)</span>
            </div>
          </div>

          {/* Evidence / Data Trust Status */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data Trust Class</div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              <div className="flex items-center gap-1.5 p-1 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="font-bold">OBSERVED</span>
              </div>
              <div className="flex items-center gap-1.5 p-1 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="font-bold">REPORTED</span>
              </div>
              <div className="flex items-center gap-1.5 p-1 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span className="font-bold">ESTIMATED</span>
              </div>
              <div className="flex items-center gap-1.5 p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span className="font-bold">UNKNOWN</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
