import React from "react";
import clsx from "clsx";

interface ConfidenceIndicatorProps {
  confidence: "LOW" | "MEDIUM" | "HIGH" | string;
  className?: string;
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  className
}) => {
  const bars = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3
  }[confidence] || 1;

  return (
    <div
      className={clsx("inline-flex items-center gap-1.5 text-xs font-mono", className)}
      title={`Confidence: ${confidence} (Based on report corroboration & sensor alignment)`}
    >
      <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Confidence:</span>
      <div className="flex items-end gap-0.5 h-3">
        <div className={clsx("w-1 h-1.5 rounded-sm", bars >= 1 ? "bg-blue-600 dark:bg-blue-400" : "bg-slate-200 dark:bg-slate-700")} />
        <div className={clsx("w-1 h-2.5 rounded-sm", bars >= 2 ? "bg-blue-600 dark:bg-blue-400" : "bg-slate-200 dark:bg-slate-700")} />
        <div className={clsx("w-1 h-3.5 rounded-sm", bars >= 3 ? "bg-blue-600 dark:bg-blue-400" : "bg-slate-200 dark:bg-slate-700")} />
      </div>
      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 ml-0.5">{confidence}</span>
    </div>
  );
};
