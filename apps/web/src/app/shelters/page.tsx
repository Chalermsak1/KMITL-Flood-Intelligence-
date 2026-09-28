"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  MapPin,
  Phone,
  Clock,
  Users,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Filter,
  LifeBuoy,
  Building,
  HeartPulse,
  Ship,
  Sparkles
} from "lucide-react";
import { api } from "../../lib/api";
import { AssistancePoint } from "../../lib/types";

export default function SheltersPage() {
  const [shelters, setShelters] = useState<AssistancePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadShelters = async () => {
    setLoading(true);
    try {
      const res = await api.getShelters();
      setShelters(res.data);
    } catch (err) {
      console.error("Failed to load shelters:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShelters();
  }, []);

  const filtered = shelters.filter((s) => {
    if (filterType !== "ALL" && s.point_type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.contact_number && s.contact_number.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getPointTypeBadge = (type: string) => {
    switch (type) {
      case "SHELTER":
        return {
          icon: Building,
          label: "EVACUATION SHELTER",
          bg: "bg-blue-500/10",
          text: "text-blue-400",
          border: "border-blue-500/30"
        };
      case "MEDICAL":
        return {
          icon: HeartPulse,
          label: "MEDICAL FIRST AID",
          bg: "bg-rose-500/10",
          text: "text-rose-400",
          border: "border-rose-500/30"
        };
      case "BOAT_PICKUP":
        return {
          icon: Ship,
          label: "BOAT PICKUP POINT",
          bg: "bg-cyan-500/10",
          text: "text-cyan-400",
          border: "border-cyan-500/30"
        };
      default:
        return {
          icon: LifeBuoy,
          label: type,
          bg: "bg-purple-500/10",
          text: "text-purple-400",
          border: "border-purple-500/30"
        };
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-primary-400 uppercase tracking-widest mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>DISASTER RELIEF DIRECTORY</span>
          </div>
          <h1 className="text-2xl font-black text-white">Emergency Shelters & Assistance Points</h1>
          <p className="text-sm text-gray-400 mt-1">
            Official designated safe zones, medical stations, and emergency evacuation transport points in KMITL & Lat Krabang.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadShelters}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-card border border-surface-border text-xs font-bold text-gray-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/help"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-red-600/20"
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Request SOS</span>
          </Link>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-mono">
          <Filter className="w-4 h-4 text-gray-400 shrink-0 mr-1" />
          {[
            { id: "ALL", label: "ALL POINTS" },
            { id: "SHELTER", label: "SHELTERS" },
            { id: "MEDICAL", label: "MEDICAL" },
            { id: "BOAT_PICKUP", label: "BOAT PICKUP" }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterType(item.id)}
              className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                filterType === item.id
                  ? "bg-primary-500/20 border-primary-500 text-primary-300 font-bold"
                  : "bg-surface border-surface-border text-gray-400 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="sm:w-72">
          <input
            type="text"
            placeholder="Search point name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
          />
        </div>
      </div>

      {/* SHELTERS LIST */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-surface-card border border-surface-border rounded-2xl space-y-3">
          <Building className="w-8 h-8 text-gray-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No assistance points found</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Try adjusting your search query or selecting a different category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((point) => {
            const badge = getPointTypeBadge(point.point_type);
            const Icon = badge.icon;
            const occupancyRatio =
              point.capacity && point.capacity > 0
                ? Math.min(100, Math.round((point.current_occupancy / point.capacity) * 100))
                : 0;

            const isCrowded = occupancyRatio >= 85;
            const isModerate = occupancyRatio >= 50 && occupancyRatio < 85;

            return (
              <div
                key={point.id}
                className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4 hover:border-gray-600 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>

                    {point.is_verified && (
                      <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <CheckCircle className="w-3 h-3" />
                        <span>VERIFIED</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white line-clamp-2">
                    {point.name}
                  </h3>

                  {/* CAPACITY BAR (IF APPLICABLE) */}
                  {point.capacity ? (
                    <div className="space-y-1.5 bg-surface/60 p-3 rounded-xl border border-surface-border/50">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-gray-400 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>Occupancy <span className="text-[10px] text-amber-400 font-sans font-normal">(Operator Log)</span></span>
                        </span>
                        <span className="text-white font-bold">
                          {point.current_occupancy} / {point.capacity} ({occupancyRatio}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all rounded-full ${
                            isCrowded
                              ? "bg-red-500"
                              : isModerate
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                          }`}
                          style={{ width: `${occupancyRatio}%` }}
                        />
                      </div>
                      <div className="text-[10px] font-mono text-gray-400">
                        Status: <em>OCCUPANCY NOT VERIFIED VIA SENSORS (Manual EOC Log)</em>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] font-mono text-gray-400 bg-surface/40 px-3 py-2 rounded-xl border border-surface-border/40">
                      Occupancy: <strong>NOT VERIFIED</strong> (Contact station)
                    </div>
                  )}

                  {/* METADATA */}
                  <div className="text-xs text-gray-400 space-y-1.5 pt-1">
                    {point.operating_hours && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>Hours: <strong className="text-gray-200">{point.operating_hours}</strong></span>
                      </div>
                    )}

                    {point.contact_number && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-primary-400 shrink-0" />
                        <a
                          href={`tel:${point.contact_number}`}
                          className="text-primary-400 hover:text-primary-300 font-mono font-medium underline"
                        >
                          {point.contact_number}
                        </a>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="font-mono text-[11px] text-gray-400">
                        {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ACTION BAR */}
                <div className="pt-3 border-t border-surface-border flex items-center justify-between text-xs">
                  <span className="text-gray-500 text-[10px] font-mono">
                    Updated: {point.last_verified_at ? new Date(point.last_verified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                  </span>

                  <Link
                    href={`/map?lat=${point.latitude}&lng=${point.longitude}&zoom=17`}
                    className="text-primary-400 hover:text-primary-300 font-bold flex items-center gap-1"
                  >
                    <span>View on Map</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DISASTER PROTOCOL CALLOUT */}
      <div className="bg-primary-950/20 border border-primary-800/40 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary-400 text-xs font-mono font-bold">
            <Sparkles className="w-4 h-4" />
            <span>CIVIL PROTECTION COORDINATION NOTICE</span>
          </div>
          <p className="text-xs text-gray-300 max-w-2xl leading-relaxed">
            All evacuation shelters maintain backup electricity generators and potable water distribution supplies. In case of emergency medical triage or floodwater isolation, submit an immediate SOS request through our emergency portal.
          </p>
        </div>

        <Link
          href="/help"
          className="shrink-0 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-red-600/30"
        >
          Submit Emergency Request
        </Link>
      </div>
    </div>
  );
}
