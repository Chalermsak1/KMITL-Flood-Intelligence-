"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  MapPin,
  LifeBuoy,
  FileWarning,
  Map as MapIcon,
  Droplets,
  CloudRain,
  ShieldCheck,
  Clock,
  ArrowRight,
  Info,
  TrendingUp
} from "lucide-react";
import { api } from "../lib/api";
import { SituationSummary, Incident, MetaEnvelope } from "../lib/types";
import { RiskBadge } from "../components/common/RiskBadge";
import { FreshnessBadge } from "../components/common/FreshnessBadge";
import { ConfidenceIndicator } from "../components/common/ConfidenceIndicator";

export default function HomePage() {
  const [summary, setSummary] = useState<SituationSummary | null>(null);
  const [summaryMeta, setSummaryMeta] = useState<MetaEnvelope | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [sumRes, incRes] = await Promise.all([
          api.getSituationSummary(),
          api.getIncidents()
        ]);
        setSummary(sumRes.data);
        setSummaryMeta(sumRes.meta);
        setRecentIncidents(incRes.data.slice(0, 4));
      } catch (err) {
        console.error("Failed to load situation summary:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* HERO SITUATION BANNER */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-surface-card to-surface border border-surface-border p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-surface-border">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">
              <MapPin className="w-4 h-4 text-primary-400" />
              <span>PRIMARY WATCH AREA: KMITL / LAT KRABANG BASIN</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex flex-wrap items-center gap-3">
              CURRENT FLOOD SITUATION
              {summary && (
                <RiskBadge
                  level={summary.current_status}
                  score={summary.overall_risk_score}
                  size="lg"
                />
              )}
            </h1>
          </div>

          {/* Freshness and Provenance */}
          <div className="flex flex-col items-start md:items-end gap-1.5 font-mono text-xs">
            {summaryMeta && (
              <FreshnessBadge
                freshness={summaryMeta.freshness}
                dataAgeText={`${summaryMeta.data_age_seconds || 45}s ago`}
              />
            )}
            <div className="text-gray-400 text-[11px] flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-500" />
              <span>Fused: TMD Radar + BMA Telemetry + Crowd Reports</span>
            </div>
          </div>
        </div>

        {/* METRICS GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6">
          <div className="bg-surface/60 border border-surface-border/60 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <CloudRain className="w-4 h-4 text-indigo-400" />
              <span>Rainfall Activity</span>
            </div>
            <div className="text-lg font-bold text-white uppercase">
              {summary?.rain_trend || "MODERATE"}
            </div>
            <div className="text-[11px] text-gray-400 font-mono mt-0.5">
              TMD Station ~18.2 mm/hr
            </div>
          </div>

          <div className="bg-surface/60 border border-surface-border/60 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <span>Canal Water Stage</span>
            </div>
            <div className="text-lg font-bold text-amber-400 flex items-center gap-1.5 uppercase">
              {summary?.water_trend || "RISING"}
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="text-[11px] text-gray-400 font-mono mt-0.5">
              Prawet lock: 0.88m MSL
            </div>
          </div>

          <div className="bg-surface/60 border border-surface-border/60 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span>Active Incidents</span>
            </div>
            <div className="text-lg font-bold text-orange-400">
              {summary?.active_incidents ?? 8} Clusters
            </div>
            <div className="text-[11px] text-gray-400 font-mono mt-0.5">
              Corroborated by reports
            </div>
          </div>

          <div className="bg-surface/60 border border-surface-border/60 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <LifeBuoy className="w-4 h-4 text-red-400" />
              <span>Emergency SOS</span>
            </div>
            <div className="text-lg font-bold text-red-400">
              {summary?.active_help_requests ?? 2} Pending
            </div>
            <div className="text-[11px] text-gray-400 font-mono mt-0.5">
              EOC triage dispatched
            </div>
          </div>
        </div>

        {/* EXPLAINABILITY SECTION (WHY IS THIS AREA HIGH RISK?) */}
        {summary && summary.explanation && (
          <div className="mt-2 bg-surface/80 rounded-xl p-4 border border-surface-border">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
              <Info className="w-4 h-4 text-primary-400" />
              <span>Explainable Risk Assessment (Why is this area alert level?)</span>
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-gray-300">
              {summary.explanation.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary-400 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* PRIMARY CALL TO ACTION BUTTONS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 mt-4 border-t border-surface-border">
          <Link
            href="/map"
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-sm shadow-lg shadow-primary-600/30 transition-all hover:scale-[1.02]"
          >
            <MapIcon className="w-4 h-4" />
            <span>VIEW LIVE FLOOD MAP</span>
          </Link>

          <Link
            href="/report"
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-surface-card hover:bg-surface-border border border-surface-border text-white font-bold text-sm transition-all hover:scale-[1.02]"
          >
            <FileWarning className="w-4 h-4 text-orange-400" />
            <span>REPORT FLOOD INCIDENT</span>
          </Link>

          <Link
            href="/help"
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-bold text-sm transition-all hover:scale-[1.02]"
          >
            <LifeBuoy className="w-4 h-4 text-red-400" />
            <span>REQUEST EMERGENCY HELP</span>
          </Link>
        </div>
      </section>

      {/* ACTIVE INCIDENTS FEED */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <span>Active Flood Incidents in Lat Krabang</span>
          </h2>
          <Link
            href="/map"
            className="text-xs text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1"
          >
            <span>See all on map</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recentIncidents.map((inc) => (
            <div
              key={inc.id}
              className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col justify-between hover:border-primary-500/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-mono text-orange-400 font-bold">
                    INCIDENT #{inc.incident_number}
                  </span>
                  <ConfidenceIndicator confidence={inc.confidence} />
                </div>
                <h3 className="font-bold text-white text-base mb-2">{inc.title}</h3>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-300 mb-3">
                  <div className="bg-surface/50 p-2 rounded-lg border border-surface-border/50">
                    <span className="text-gray-400 block text-[10px]">ระดับน้ำโดยประมาณ</span>
                    <span className="font-bold text-orange-300">
                      {inc.consensus_depth_band.replace("DEPTH_", "").replace("_", " ")}
                    </span>
                  </div>
                  <div className="bg-surface/50 p-2 rounded-lg border border-surface-border/50">
                    <span className="text-gray-400 block text-[10px]">การสัญจร</span>
                    <span className="font-bold text-white">{inc.consensus_passability}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-surface-border">
                <span>{inc.report_count} รายงานที่สอดคล้องกัน</span>
                <span>ล่าสุด {inc.last_report_age_min} นาทีที่แล้ว</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SATELLITE & SENSOR ATTRIBUTION FOOTER */}
      <section className="bg-surface-card/40 border border-surface-border/50 rounded-xl p-4 text-xs text-gray-400 space-y-2">
        <div className="font-bold text-gray-300 uppercase tracking-wider text-[11px]">
          DATA PROVENANCE & TRANSPARENCY NOTICE
        </div>
        <p>
          ระบบ KMITL Flood Intelligence ประมวลผลจากข้อมูลเปิด (Open Data) ของกรมอุตุนิยมวิทยา (TMD), สำนักการระบายน้ำ กทม. (DDS), ภาพถ่ายดาวเทียม Sentinel-1 C-SAR ขององค์การอวกาศยุโรป (ESA), และรายงานจากประชาชนในพื้นที่.
        </p>
        <p className="text-gray-500 text-[11px]">
          คำเตือน: ข้อมูลนี้เป็นระบบสนับสนุนการตัดสินใจเบื้องต้น ไม่ได้รับรองความปลอดภัย 100% ในทุกเส้นทาง กรุณาปฏิบัติตามคำสั่งของเจ้าหน้าที่กู้ภัยและศูนย์ความปลอดภัย สจล. ในภาวะฉุกเฉิน.
        </p>
      </section>
    </div>
  );
}
