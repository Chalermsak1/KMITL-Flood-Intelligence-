"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Search,
  AlertCircle,
  ShieldCheck,
  Compass
} from "lucide-react";
import { api } from "../../lib/api";
import { AssistancePoint } from "../../lib/types";
import clsx from "clsx";

export default function SheltersPage() {
  const [shelters, setShelters] = useState<AssistancePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const loadShelters = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getShelters();
      setShelters(res.data);
    } catch (err: any) {
      console.error("Failed to load shelters:", err);
      setError("Unable to load shelter directory from backend. Please call emergency hotline 02-329-8000 directly.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShelters();
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        null,
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);

  // Distance helper from user GPS or central campus
  const calculateDistance = (targetLat: number, targetLng: number) => {
    const baseLat = userCoords?.lat || 13.7298; // Default KMITL campus
    const baseLng = userCoords?.lng || 100.7782;
    const R = 6371; // Earth radius km
    const dLat = (targetLat - baseLat) * (Math.PI / 180);
    const dLon = (targetLng - baseLng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(baseLat * (Math.PI / 180)) * Math.cos(targetLat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
  };

  const filtered = useMemo(() => {
    return shelters.filter((s) => {
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
  }, [shelters, filterType, searchQuery]);

  const getPointTypeBadge = (type: string) => {
    switch (type) {
      case "SHELTER":
        return {
          icon: Building,
          label: "EVACUATION SHELTER",
          style: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
        };
      case "MEDICAL":
        return {
          icon: HeartPulse,
          label: "MEDICAL FIRST AID",
          style: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
        };
      case "BOAT_PICKUP":
        return {
          icon: Ship,
          label: "BOAT PICKUP POINT",
          style: "bg-cyan-50 text-cyan-800 border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800"
        };
      default:
        return {
          icon: LifeBuoy,
          label: type,
          style: "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
        };
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">
            <ShieldAlert className="w-4 h-4" />
            <span>DISASTER RELIEF DIRECTORY</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            Emergency Shelters & Assistance Points
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Designated safe zones, medical triage stations, and boat evacuation points for the KMITL and Lat Krabang community.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadShelters}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </button>

          <Link
            href="/help"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
          >
            <LifeBuoy className="w-3.5 h-3.5 text-white" />
            <span>Request SOS</span>
          </Link>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
          {[
            { id: "ALL", label: "ALL POINTS" },
            { id: "SHELTER", label: "SHELTERS" },
            { id: "MEDICAL", label: "MEDICAL" },
            { id: "BOAT_PICKUP", label: "BOAT PICKUP" }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterType(item.id)}
              className={clsx(
                "px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap font-bold",
                filterType === item.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="sm:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search point name or telephone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-sm"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SHELTERS DIRECTORY GRID */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
          <Building className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No assistance points found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try adjusting your search query or selecting a different category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((point) => {
            const badge = getPointTypeBadge(point.point_type);
            const Icon = badge.icon;
            const distanceText = calculateDistance(point.latitude, point.longitude);

            return (
              <div
                key={point.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-400 dark:hover:border-slate-600 transition-all flex flex-col justify-between shadow-sm"
              >
                <div className="space-y-3">
                  {/* Point Type Badge + Distance */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={clsx(
                        "flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase",
                        badge.style
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{badge.label}</span>
                    </span>

                    <span className="text-[11px] font-mono text-slate-500 font-bold flex items-center gap-1">
                      <Compass className="w-3 h-3 text-slate-400" />
                      <span>~{distanceText}</span>
                    </span>
                  </div>

                  {/* Name */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {point.name}
                  </h3>

                  {/* OCCUPANCY STATUS: UNVERIFIED EXPLICITLY SHOWN */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 font-mono text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>Occupancy Status:</span>
                      </span>
                      {point.is_verified ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          {point.capacity ? `${point.current_occupancy}/${point.capacity} persons` : "Operational"}
                        </span>
                      ) : (
                        <span className="text-amber-800 dark:text-amber-300 font-black px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 border border-amber-300 text-[10px]">
                          OCCUPANCY NOT VERIFIED
                        </span>
                      )}
                    </div>
                    {!point.is_verified && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                        ไม่มีเซ็นเซอร์ตรวจวัดจำนวนคนอัตโนมัติ กรุณาติดต่อสถานีก่อนเดินทาง.
                      </p>
                    )}
                  </div>

                  {/* METADATA: HOURS, PHONE, COORDINATES */}
                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 pt-1">
                    {point.operating_hours && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Hours: <strong className="text-slate-800 dark:text-slate-200">{point.operating_hours}</strong></span>
                      </div>
                    )}

                    {point.contact_number && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <a
                          href={`tel:${point.contact_number}`}
                          className="text-blue-700 dark:text-blue-400 font-mono font-bold hover:underline"
                        >
                          {point.contact_number}
                        </a>
                      </div>
                    )}

                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}</span>
                    </div>
                  </div>
                </div>

                {/* PROVENANCE AND ACTION FOOTER */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="text-[10px] font-mono text-slate-500">
                    <div>Source: KMITL Disaster Directory</div>
                    <div>
                      Verified: {point.last_verified_at ? new Date(point.last_verified_at).toLocaleDateString() : "Active Record"}
                    </div>
                  </div>

                  <Link
                    href={`/map?lat=${point.latitude}&lng=${point.longitude}&zoom=17`}
                    className="text-blue-700 dark:text-blue-400 hover:text-blue-800 font-bold flex items-center gap-1"
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
    </div>
  );
}
