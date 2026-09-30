"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Map,
  FileWarning,
  Navigation,
  MoreHorizontal,
  AlertTriangle,
  Building,
  LifeBuoy,
  BarChart3,
  Database,
  History,
  ShieldCheck,
  X
} from "lucide-react";
import clsx from "clsx";

export const MobileBottomNav: React.FC = () => {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mainTabs = [
    { label: "Situation", href: "/", icon: Home },
    { label: "Map", href: "/map", icon: Map },
    { label: "Report", href: "/report", icon: FileWarning, highlight: true },
    { label: "Route", href: "/route", icon: Navigation },
  ];

  const moreItems = [
    { label: "Active Incidents", href: "/incidents", icon: AlertTriangle, desc: "Clustered flood hotspots" },
    { label: "Shelters & Aid", href: "/shelters", icon: Building, desc: "Evacuation points & contacts" },
    { label: "Emergency SOS", href: "/help", icon: LifeBuoy, desc: "Direct 199 / 1669 dispatch", alert: true },
    { label: "Analytics & Trends", href: "/analytics", icon: BarChart3, desc: "Water trends and sensors" },
    { label: "Data Provenance", href: "/data", icon: Database, desc: "Source credibility & status" },
    { label: "Event Replay", href: "/replay", icon: History, desc: "Historical incident playback" },
    { label: "Admin EOC", href: "/admin", icon: ShieldCheck, desc: "Emergency operations console" },
  ];

  return (
    <>
      {/* MOBILE BOTTOM NAVIGATION BAR (< 640px) */}
      <nav
        aria-label="Mobile navigation"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1 shadow-lg"
      >
        <div className="flex items-center justify-around">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setDrawerOpen(false)}
                className={clsx(
                  "flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all text-[11px] font-medium min-w-[56px]",
                  isActive
                    ? "text-blue-700 dark:text-blue-400 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200",
                  tab.highlight && !isActive && "text-orange-600 dark:text-orange-400"
                )}
              >
                <div className={clsx(
                  "p-1 rounded-lg transition-transform",
                  isActive && "bg-blue-50 dark:bg-blue-950/60 scale-105",
                  tab.highlight && !isActive && "bg-orange-50 dark:bg-orange-950/50"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="mt-0.5 leading-none">{tab.label}</span>
              </Link>
            );
          })}

          {/* MORE BUTTON */}
          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={clsx(
              "flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all text-[11px] font-medium min-w-[56px]",
              drawerOpen || moreItems.some((m) => pathname === m.href)
                ? "text-blue-700 dark:text-blue-400 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
            aria-label="More navigation options"
          >
            <div className={clsx(
              "p-1 rounded-lg transition-transform",
              (drawerOpen || moreItems.some((m) => pathname === m.href)) && "bg-blue-50 dark:bg-blue-950/60"
            )}>
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span className="mt-0.5 leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* MOBILE MORE DRAWER SHEET */}
      {drawerOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-2xl max-h-[85vh] overflow-y-auto p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono">
                  Operational Tools & Services
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-xl border transition-all",
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300 font-bold"
                        : item.alert
                        ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 font-bold"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 hover:bg-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        item.alert
                          ? "bg-red-600 text-white"
                          : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-blue-600 dark:text-blue-400"
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-tight">{item.label}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">{item.desc}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="pt-2 text-center text-[10px] text-slate-400 font-mono">
              KMITL Flood Intelligence • Emergency Situational Awareness
            </div>
          </div>
        </div>
      )}
    </>
  );
};
