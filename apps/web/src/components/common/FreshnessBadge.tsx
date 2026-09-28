import React from "react";
import clsx from "clsx";

interface FreshnessBadgeProps {
  freshness: "FRESH" | "RECENT" | "AGING" | "STALE" | "EXPIRED" | string;
  dataAgeText?: string;
  className?: string;
}

export const FreshnessBadge: React.FC<FreshnessBadgeProps> = ({
  freshness,
  dataAgeText,
  className
}) => {
  const styles = {
    FRESH: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    RECENT: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    AGING: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    STALE: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    EXPIRED: "bg-gray-500/10 text-gray-400 border-gray-500/30"
  };

  const currentStyle = styles[freshness as keyof typeof styles] || styles.EXPIRED;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide",
        currentStyle,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      <span>{freshness}</span>
      {dataAgeText && (
        <span className="opacity-80 text-[10px] border-l border-current/20 pl-1.5 ml-0.5">
          {dataAgeText}
        </span>
      )}
    </span>
  );
};
