"use client";

import React from "react";
import { History, Play, RotateCcw } from "lucide-react";
import clsx from "clsx";

export type TimeOffset = "NOW" | "1H_AGO" | "3H_AGO" | "6H_AGO" | "24H_AGO";

interface TimeEvolutionControlProps {
  activeOffset: TimeOffset;
  onChange: (offset: TimeOffset) => void;
  className?: string;
}

export const TimeEvolutionControl: React.FC<TimeEvolutionControlProps> = ({
  activeOffset,
  onChange,
  className
}) => {
  const options: { offset: TimeOffset; label: string; sub: string }[] = [
    { offset: "NOW", label: "NOW", sub: "Live state" },
    { offset: "1H_AGO", label: "-1H", sub: "1 hour ago" },
    { offset: "3H_AGO", label: "-3H", sub: "3 hours ago" },
    { offset: "6H_AGO", label: "-6H", sub: "6 hours ago" },
    { offset: "24H_AGO", label: "-24H", sub: "24 hours ago" }
  ];

  return (
    <div
      className={clsx(
        "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-md p-1.5 flex items-center gap-1 transition-all select-none",
        className
      )}
    >
      <div className="flex items-center gap-1.5 px-2 text-slate-500 border-r border-slate-200 dark:border-slate-800 shrink-0">
        <History className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider hidden sm:inline">
          Evolution
        </span>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        {options.map((opt) => {
          const isActive = activeOffset === opt.offset;
          return (
            <button
              key={opt.offset}
              type="button"
              onClick={() => onChange(opt.offset)}
              className={clsx(
                "px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 whitespace-nowrap",
                isActive
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
              title={opt.sub}
            >
              {opt.offset === "NOW" && (
                <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", isActive ? "bg-white animate-pulse" : "bg-emerald-500")} />
              )}
              <span>{opt.label}</span>
              <span className={clsx("text-[9px] font-normal hidden md:inline", isActive ? "text-purple-200" : "text-slate-400")}>
                {opt.sub}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
