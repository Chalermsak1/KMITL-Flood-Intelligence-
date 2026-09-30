"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Activity,
  Map,
  FileWarning,
  LifeBuoy,
  ShieldCheck,
  Home,
  Navigation,
  History,
  Building,
  BarChart3,
  Database,
  Menu,
  X,
  ChevronDown,
  Sun,
  Moon,
  Clock,
  Radio
} from "lucide-react";
import clsx from "clsx";

interface HeaderProps {
  isWsConnected?: boolean;
  transportMode?: "WEBSOCKET" | "SSE" | "POLLING";
  lastUpdated?: Date;
  isDegraded?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: any;
  highlight?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isWsConnected = true,
  transportMode,
  lastUpdated,
  isDegraded = false
}) => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    if (typeof document !== "undefined") {
      setIsDark(document.documentElement.classList.contains("dark"));
    }
    const updateClock = () => {
      const d = lastUpdated || new Date();
      setCurrentTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  const toggleTheme = () => {
    const willBeDark = !isDark;
    setIsDark(willBeDark);
    if (willBeDark) {
      document.documentElement.classList.add("dark");
      try { localStorage.setItem("kmitl_theme_v2", "dark"); } catch {}
    } else {
      document.documentElement.classList.remove("dark");
      try { localStorage.setItem("kmitl_theme_v2", "light"); } catch {}
    }
  };

  const mainNavItems: NavItem[] = [
    { label: "Situation", href: "/", icon: Home },
    { label: "Live Map", href: "/map", icon: Map },
    { label: "Route", href: "/route", icon: Navigation },
    { label: "Incidents", href: "/incidents", icon: AlertTriangle },
    { label: "Shelters", href: "/shelters", icon: Building },
    { label: "Report Flood", href: "/report", icon: FileWarning }
  ];

  const moreNavItems: NavItem[] = [
    { label: "Analytics & Trends", href: "/analytics", icon: BarChart3 },
    { label: "Data Provenance", href: "/data", icon: Database },
    { label: "Event Replay", href: "/replay", icon: History },
    { label: "Admin EOC", href: "/admin", icon: ShieldCheck },
    { label: "Limitations & Safety", href: "/limitations", icon: AlertTriangle }
  ];

  const isLive = isWsConnected && !isDegraded;

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
      {/* OPERATIONS STATUS BANNER (Light, honest provenance) */}
      <div className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 px-4 py-1 text-xs text-slate-700 dark:text-slate-300 font-mono flex items-center justify-between gap-2 overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-[11px] font-medium">
            <strong className="text-slate-900 dark:text-slate-100">DATA FEEDS:</strong> Citizen reports are <strong>LIVE</strong>. Copernicus SAR is <strong>OBSERVATION</strong>. External agency feeds are <strong>PENDING_ACCESS</strong>.
          </span>
        </div>
        <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span>Lat Krabang Operations Zone</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span suppressHydrationWarning>Updated: {currentTime || "--:--:--"}</span>
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between">
        {/* Logo and Brand */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-700 dark:bg-blue-600 flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>KMITL FLOOD INTELLIGENCE</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded font-mono border border-blue-200 dark:border-blue-700 font-semibold">
                v1.0 (Operations)
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
              Emergency Situational Awareness & Operational Decision Support
            </div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  isActive
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* More Dropdown */}
          <div className="relative">
            <button
              onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
              className={clsx(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800",
                moreNavItems.some((i) => pathname === i.href) &&
                  "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
              )}
              aria-label="More operational tools"
            >
              <span>More</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {toolsDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 space-y-1 z-50"
                onMouseLeave={() => setToolsDropdownOpen(false)}
              >
                {moreNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setToolsDropdownOpen(false)}
                      className={clsx(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                        isActive
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold"
                          : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* SOS Emergency Button */}
          <Link
            href="/help"
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-sm uppercase tracking-wider transition-colors"
          >
            <LifeBuoy className="w-3.5 h-3.5 text-white" />
            <span>SOS</span>
          </Link>
        </nav>

        {/* Telemetry Indicator + Theme Toggle + Mobile Menu Trigger */}
        <div className="flex items-center gap-2">
          {/* LIVE / DEGRADED indicator */}
          <div
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-bold tracking-tight shadow-sm",
              isLive
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700"
                : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700"
            )}
            title={isLive ? "Telemetry: Live connected" : "Telemetry: Degraded or Polling fallback"}
          >
            <span
              className={clsx(
                "w-2 h-2 rounded-full",
                isLive ? "bg-emerald-600 dark:bg-emerald-400 animate-pulse" : "bg-amber-600 dark:bg-amber-400 animate-pulse"
              )}
            />
            <span>
              {isLive ? (transportMode ? `${transportMode} LIVE` : "LIVE") : "DEGRADED"}
            </span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
          </button>

          {/* Mobile SOS button */}
          <Link
            href="/help"
            className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-sm uppercase"
          >
            <LifeBuoy className="w-3.5 h-3.5 text-white" />
            <span>SOS</span>
          </Link>

          {/* Mobile Menu Toggle button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer (Accessible from top hamburger when opened) */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 space-y-2 animate-in slide-in-from-top duration-150">
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            {[...mainNavItems, ...moreNavItems].map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors",
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-bold"
                      : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-white"
                  )}
                >
                  <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
