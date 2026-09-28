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
      className={clsx("inline-flex items-center gap-1.5 text-xs text-gray-400 font-medium", className)}
      title={`Confidence: ${confidence} (Based on report corroboration & sensor alignment)`}
    >
      <span className="text-[11px] uppercase tracking-wider text-gray-400">Confidence:</span>
      <div className="flex items-end gap-0.5 h-3">
        <div className={clsx("w-1 h-1.5 rounded-sm", bars >= 1 ? "bg-primary-500" : "bg-gray-700")} />
        <div className={clsx("w-1 h-2.5 rounded-sm", bars >= 2 ? "bg-primary-500" : "bg-gray-700")} />
        <div className={clsx("w-1 h-3.5 rounded-sm", bars >= 3 ? "bg-primary-500" : "bg-gray-700")} />
      </div>
      <span className="text-[11px] font-semibold text-gray-300 ml-0.5">{confidence}</span>
    </div>
  );
};
