import React from "react";
import clsx from "clsx";

interface RiskBadgeProps {
  level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "UNKNOWN" | string;
  score?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  score,
  className,
  size = "md"
}) => {
  const config = {
    LOW: {
      color: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/40",
      dot: "bg-emerald-600 dark:bg-emerald-400",
      label: "LOW RISK"
    },
    MEDIUM: {
      color: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/40",
      dot: "bg-amber-500 dark:bg-amber-400",
      label: "MEDIUM RISK"
    },
    MODERATE: {
      color: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/40",
      dot: "bg-amber-500 dark:bg-amber-400",
      label: "MODERATE"
    },
    HIGH: {
      color: "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-500/40",
      dot: "bg-orange-600 dark:bg-orange-400",
      label: "HIGH FLOOD RISK"
    },
    CRITICAL: {
      color: "bg-red-50 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-500/40 font-bold",
      dot: "bg-red-600 dark:bg-red-500 animate-ping",
      label: "CRITICAL DANGER"
    },
    UNKNOWN: {
      color: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-600",
      dot: "bg-slate-500 dark:bg-slate-400",
      label: "UNKNOWN / INSUFFICIENT"
    }
  };

  const current = config[level as keyof typeof config] || config.UNKNOWN;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm font-semibold",
    lg: "px-4 py-1.5 text-base font-bold"
  };

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 rounded-lg border font-mono tracking-wider shadow-sm",
        current.color,
        sizeClasses[size],
        className
      )}
    >
      <span className={clsx("w-2 h-2 rounded-full", current.dot)} />
      <span>{current.label}</span>
      {typeof score === "number" && (
        <span className="opacity-75 text-xs ml-1 font-normal font-sans">
          ({score.toFixed(0)}/100)
        </span>
      )}
    </div>
  );
};
