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
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/40",
      dot: "bg-emerald-400",
      label: "LOW RISK"
    },
    MODERATE: {
      color: "bg-amber-500/10 text-amber-400 border-amber-500/40",
      dot: "bg-amber-400",
      label: "MODERATE"
    },
    HIGH: {
      color: "bg-orange-500/10 text-orange-400 border-orange-500/40",
      dot: "bg-orange-400",
      label: "HIGH FLOOD RISK"
    },
    CRITICAL: {
      color: "bg-red-500/15 text-red-400 border-red-500/50",
      dot: "bg-red-500 animate-ping",
      label: "CRITICAL DANGER"
    },
    UNKNOWN: {
      color: "bg-gray-500/10 text-gray-400 border-gray-500/30",
      dot: "bg-gray-400",
      label: "INSUFFICIENT DATA"
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
