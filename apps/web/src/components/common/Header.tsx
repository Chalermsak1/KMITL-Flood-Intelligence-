"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
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
  ChevronDown
} from "lucide-react";
import clsx from "clsx";

interface HeaderProps {
  isWsConnected?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: any;
  highlight?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isWsConnected = true }) => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);

  const mainNavItems: NavItem[] = [
    { label: "Situation", href: "/", icon: Home },
    { label: "Live Map", href: "/map", icon: Map },
    { label: "Route", href: "/route", icon: Navigation },
    { label: "Incidents", href: "/incidents", icon: AlertCircle },
    { label: "Shelters", href: "/shelters", icon: Building },
    { label: "Report Flood", href: "/report", icon: FileWarning }
  ];

  const moreNavItems: NavItem[] = [
    { label: "Analytics & Trends", href: "/analytics", icon: BarChart3 },
    { label: "Data Provenance", href: "/data", icon: Database },
    { label: "Event Replay", href: "/replay", icon: History },
    { label: "Admin EOC", href: "/admin", icon: ShieldCheck }
  ];

  const allMobileNavItems: NavItem[] = [
    ...mainNavItems,
    ...moreNavItems,
    { label: "Request SOS", href: "/help", icon: LifeBuoy, highlight: true }
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
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-blue-700 flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:scale-105 transition-transform">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-black text-sm tracking-wider text-white flex items-center gap-2">
              KMITL FLOOD INTELLIGENCE
              <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/20 text-blue-400 rounded font-mono border border-blue-500/30">
                v1.0
              </span>
            </div>
            <div className="text-[10px] text-gray-400 font-medium hidden sm:block">
              Lat Krabang Situational Awareness & Assistance
            </div>
          </div>
        </Link>

        {/* Navigation Items (Desktop) */}
        <nav className="hidden xl:flex items-center gap-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary-600/15 text-primary-400 border border-primary-500/30"
                    : "text-gray-300 hover:text-white hover:bg-surface-card"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Tools & Analytics Dropdown */}
          <div className="relative">
            <button
              onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
              className={clsx(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-gray-300 hover:text-white hover:bg-surface-card",
                moreNavItems.some((i) => pathname === i.href) &&
                  "bg-primary-600/15 text-primary-400 border border-primary-500/30"
              )}
            >
              <span>More</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {toolsDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-48 bg-surface-card border border-surface-border rounded-xl shadow-2xl p-1.5 space-y-1 z-50"
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
                          ? "bg-primary-500/20 text-primary-300 font-bold"
                          : "text-gray-300 hover:text-white hover:bg-surface"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 text-primary-400" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* SOS Highlight Button */}
          <Link
            href="/help"
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/20 uppercase tracking-wider transition-colors"
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>SOS</span>
          </Link>
        </nav>

        {/* Live Pulse + Mobile Toggle */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-card border border-surface-border text-xs font-mono">
            <span
              className={clsx(
                "w-2 h-2 rounded-full",
                isWsConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              )}
            />
            <span className="text-gray-300 hidden sm:inline text-[11px]">
              {isWsConnected ? "LIVE STREAM" : "RECONNECTING"}
            </span>
          </div>

          <Link
            href="/help"
            className="xl:hidden flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-600/30"
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>SOS</span>
          </Link>

          {/* Hamburger Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-lg bg-surface-card border border-surface-border text-gray-300 hover:text-white transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-surface border-b border-surface-border px-4 py-4 space-y-2 animate-in slide-in-from-top duration-200">
          <div className="grid grid-cols-2 gap-2 text-xs font-medium">
            {allMobileNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors",
                    isActive
                      ? "bg-primary-600/20 text-primary-400 border border-primary-500/30 font-bold"
                      : item.highlight
                      ? "bg-red-600/20 text-red-400 border border-red-500/30 font-bold"
                      : "text-gray-300 hover:text-white bg-surface-card border border-surface-border"
                  )}
                >
                  <Icon
                    className={clsx(
                      "w-4 h-4",
                      item.highlight ? "text-red-400" : "text-primary-400"
                    )}
                  />
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
