"use client";

import React from "react";
import { Layers, AlertTriangle, Droplets, CloudRain, Satellite, Home, Eye } from "lucide-react";
import clsx from "clsx";

export interface LayerState {
  incidents: boolean;
  reports: boolean;
  waterStations: boolean;
  rain: boolean;
  satellite: boolean;
  shelters: boolean;
}

interface LayerControlProps {
  layers: LayerState;
  onChange: (layers: LayerState) => void;
  className?: string;
}

export const LayerControl: React.FC<LayerControlProps> = ({ layers, onChange, className }) => {
  const toggle = (key: keyof LayerState) => {
    onChange({ ...layers, [key]: !layers[key] });
  };

  const items = [
    { key: "incidents" as const, label: "Flood Incidents", icon: AlertTriangle, color: "text-orange-400" },
    { key: "reports" as const, label: "User Reports", icon: Eye, color: "text-blue-400" },
    { key: "waterStations" as const, label: "Canal Water Gauges", icon: Droplets, color: "text-cyan-400" },
    { key: "rain" as const, label: "Rain / Radar Overlay", icon: CloudRain, color: "text-indigo-400" },
    { key: "satellite" as const, label: "Satellite SAR Evidence", icon: Satellite, color: "text-purple-400" },
    { key: "shelters" as const, label: "Shelters & Emergency", icon: Home, color: "text-emerald-400" },
  ];

  return (
    <div className={clsx("bg-surface/95 backdrop-blur-md border border-surface-border rounded-xl p-3 shadow-xl", className)}>
      <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider mb-2.5 pb-2 border-b border-surface-border">
        <Layers className="w-4 h-4 text-primary-400" />
        <span>Map Layers</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = layers[item.key];
          return (
            <button
              key={item.key}
              onClick={() => toggle(item.key)}
              className={clsx(
                "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left",
                active ? "bg-surface-card border border-surface-border text-white" : "text-gray-400 hover:text-gray-200"
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={clsx("w-3.5 h-3.5", active ? item.color : "text-gray-500")} />
                <span>{item.label}</span>
              </div>
              <div
                className={clsx(
                  "w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] font-bold border transition-colors",
                  active
                    ? "bg-primary-600 border-primary-500 text-white"
                    : "border-gray-600 bg-gray-800 text-transparent"
                )}
              >
                ✓
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
