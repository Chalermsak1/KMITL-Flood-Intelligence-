"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, Activity, Map, FileWarning, LifeBuoy, ShieldCheck, Home } from "lucide-react";
import clsx from "clsx";

interface HeaderProps {
  isWsConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isWsConnected = true }) => {
  const pathname = usePathname();

  const navItems = [
    { label: "Situation", href: "/", icon: Home },
    { label: "Live Map", href: "/map", icon: Map },
    { label: "Report Flood", href: "/report", icon: FileWarning },
    { label: "Request SOS", href: "/help", icon: LifeBuoy, highlight: true },
    { label: "Admin EOC", href: "/admin", icon: ShieldCheck }
  ];

  return (
    <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-surface-border">
      {/* Demo Warning Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1 text-center text-xs text-amber-300 font-mono flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span>DEMO MODE ACTIVE: Sensor & radar inputs use validated scenario models. User reports are LIVE.</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo and Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-blue-700 flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:scale-105 transition-transform">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-black text-base tracking-wider text-white flex items-center gap-2">
              KMITL FLOOD INTELLIGENCE
              <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/20 text-blue-400 rounded font-mono border border-blue-500/30">
                v1.0
              </span>
            </div>
            <div className="text-[11px] text-gray-400 font-medium">
              Lat Krabang Situational Awareness & Assistance
            </div>
          </div>
        </Link>

        {/* Navigation Items */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-600/15 text-primary-400 border border-primary-500/30"
                    : "text-gray-300 hover:text-white hover:bg-surface-card",
                  item.highlight && "text-red-400 hover:text-red-300 font-bold"
                )}
              >
                <Icon className={clsx("w-4 h-4", item.highlight && "text-red-400")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Live Hub Telemetry Pulse */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-card border border-surface-border text-xs font-mono">
            <span
              className={clsx(
                "w-2 h-2 rounded-full",
                isWsConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              )}
            />
            <span className="text-gray-300 hidden sm:inline">
              {isWsConnected ? "LIVE STREAM" : "RECONNECTING"}
            </span>
          </div>

          <Link
            href="/help"
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30"
          >
            <LifeBuoy className="w-4 h-4" />
            <span>SOS</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
