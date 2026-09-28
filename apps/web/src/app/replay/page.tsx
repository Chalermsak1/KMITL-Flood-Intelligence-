"use client";

import React, { useState, useEffect } from "react";
import {
  History,
  Play,
  Pause,
  RotateCcw,
  CloudRain,
  Waves,
  AlertTriangle,
  Radio,
  Clock,
  Sparkles,
  Info
} from "lucide-react";
import { api } from "../../lib/api";
import { ReplayTimelineData, ReplaySnapshot } from "../../lib/types";

export default function ReplayPage() {
  const [data, setData] = useState<ReplayTimelineData | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState("1x");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReplay() {
      try {
        const res = await api.getReplayTimeline();
        setData(res.data);
      } catch (err) {
        console.error("Failed to load replay timeline:", err);
      } finally {
        setLoading(false);
      }
    }
    loadReplay();
  }, []);

  // Automatic playback timer
  useEffect(() => {
    if (!isPlaying || !data || data.timeline.length === 0) return;

    const speedMultiplier: Record<string, number> = {
      "0.5x": 4000,
      "1x": 2000,
      "2x": 1000,
      "5x": 400,
      "10x": 200
    };

    const intervalTime = speedMultiplier[speed] || 2000;
    const interval = setInterval(() => {
      setCurrentIdx((prev) => {
        if (prev >= data.timeline.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isPlaying, currentIdx, data, speed]);

  const currentSnapshot: ReplaySnapshot | undefined = data?.timeline[currentIdx];

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* PROMINENT DEMO MODE BANNER */}
      <div className="p-4 bg-purple-900/30 border-2 border-purple-500/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-purple-950/40">
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1 bg-purple-600 text-white font-mono font-bold text-xs uppercase rounded-lg tracking-wider">
            DEMO MODE
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Historical Event Intelligence Replay</h2>
            <p className="text-xs text-purple-200">
              Scenario: Tropical Storm Monsoon Inundation (Historical Event Simulation)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-purple-300">
          <Info className="w-4 h-4 shrink-0" />
          <span>Strict Truth Rule: Historical scenario isolated from Live Feeds.</span>
        </div>
      </div>

      {/* EVENT TITLE & SUMMARY */}
      <div className="pb-4 border-b border-surface-border">
        <h1 className="text-2xl font-black text-white">{data?.event.name}</h1>
        <p className="text-sm text-gray-400 mt-1">{data?.event.description}</p>
        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-mono text-gray-400">
          <span>Area: <strong className="text-gray-200">{data?.event.area}</strong></span>
          <span>Source: <strong className="text-gray-200">{data?.event.source}</strong></span>
          <span>Peak Risk: <strong className="text-red-400 font-bold">{data?.event.peak_risk}</strong></span>
        </div>
      </div>

      {/* TIMELINE CONTROLS & SCRUBBER */}
      <section className="bg-surface-card border border-surface-border rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs uppercase tracking-wider transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? "Pause" : "Play Replay"}</span>
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentIdx(0);
              }}
              className="p-2 rounded-xl bg-surface border border-surface-border text-gray-400 hover:text-white transition-colors"
              title="Reset Timeline"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <span className="text-sm font-mono font-bold text-white ml-2">
              Time: {currentSnapshot?.time_label}
            </span>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1.5 bg-surface border border-surface-border rounded-xl p-1 text-xs font-mono">
            {["0.5x", "1x", "2x", "5x"].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  speed === s ? "bg-primary-600 text-white font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Timeline Slider */}
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={(data?.timeline.length || 1) - 1}
            value={currentIdx}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentIdx(Number(e.target.value));
            }}
            className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary-500"
          />

          {/* Timeline markers */}
          <div className="flex justify-between text-[11px] font-mono text-gray-400 pt-1">
            {data?.timeline.map((step, idx) => (
              <span
                key={idx}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentIdx(idx);
                }}
                className={`cursor-pointer transition-colors ${
                  idx === currentIdx ? "text-primary-400 font-bold underline" : "hover:text-gray-200"
                }`}
              >
                {step.time_label.split(" ")[0]}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* SYNCHRONIZED OBSERVATIONAL STATUS CARDS */}
      {currentSnapshot && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Rain Telemetry */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>ATMOSPHERIC RAINFALL</span>
              <CloudRain className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-black text-white">{currentSnapshot.rainfall_rate_mm} mm/h</div>
            <div className="text-xs text-sky-300 font-semibold">{currentSnapshot.rain_intensity} Downpour</div>
          </div>

          {/* Canal Hydro Gauge */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>CANAL WATER LEVEL</span>
              <Waves className="w-4 h-4 text-primary-400" />
            </div>
            <div className="text-2xl font-black text-white">{currentSnapshot.canal_water_level_m} m MSL</div>
            <div className={`text-xs font-semibold ${
              currentSnapshot.canal_status === "CRITICAL"
                ? "text-red-400"
                : currentSnapshot.canal_status === "WARNING"
                ? "text-amber-400"
                : "text-emerald-400"
            }`}>
              Status: {currentSnapshot.canal_status}
            </div>
          </div>

          {/* Citizen Corroboration */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>ACTIVE CITIZEN REPORTS</span>
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">{currentSnapshot.active_reports_count}</div>
            <div className="text-xs text-gray-400">
              Clustered Incidents: <span className="text-white font-bold">{currentSnapshot.active_incidents_count}</span>
            </div>
          </div>

          {/* Risk Level */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>OVERALL FLOOD RISK</span>
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            </div>
            <div className={`text-2xl font-black ${
              currentSnapshot.risk_level === "HIGH"
                ? "text-red-400"
                : currentSnapshot.risk_level === "MEDIUM"
                ? "text-yellow-400"
                : "text-emerald-400"
            }`}>
              {currentSnapshot.risk_level}
            </div>
            <div className="text-xs text-gray-400 font-mono">
              Risk Score: {(currentSnapshot.risk_score * 100).toFixed(0)} / 100
            </div>
          </div>
        </div>
      )}

      {/* SCENARIO EVENT NARRATIVE */}
      {currentSnapshot && (
        <div className="p-5 bg-surface-card border border-surface-border rounded-2xl space-y-2">
          <h3 className="text-xs font-mono uppercase tracking-wider text-primary-400 font-bold">
            Simulated Situation Narrative ({currentSnapshot.time_label}):
          </h3>
          <p className="text-sm text-gray-200 leading-relaxed">{currentSnapshot.summary}</p>
          {currentSnapshot.satellite_available && currentSnapshot.satellite_note && (
            <div className="mt-2 text-xs text-purple-300 font-mono bg-purple-950/30 p-2.5 rounded-xl border border-purple-800/40">
              🛰️ {currentSnapshot.satellite_note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
