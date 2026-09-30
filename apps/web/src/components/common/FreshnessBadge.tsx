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
    FRESH: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30",
    RECENT: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/30",
    AGING: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30",
    STALE: "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-500/30",
    EXPIRED: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-600"
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
