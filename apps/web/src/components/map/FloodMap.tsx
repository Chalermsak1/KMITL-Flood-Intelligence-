"use client";

import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LayerState } from "./LayerControl";
import { Incident, FloodReport, WaterStation, AssistancePoint, SatelliteObservation } from "../../lib/types";

interface FloodMapProps {
  layers: LayerState;
  incidents: Incident[];
  reports: FloodReport[];
  waterStations: WaterStation[];
  shelters: AssistancePoint[];
  satellite?: SatelliteObservation | null;
  onSelectIncident?: (incident: Incident) => void;
  className?: string;
}

export const FloodMap: React.FC<FloodMapProps> = ({
  layers,
  incidents,
  reports,
  waterStations,
  shelters,
  satellite,
  onSelectIncident,
  className
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Default coordinate center: KMITL Campus, Lat Krabang
  const defaultLng = 100.7782;
  const defaultLat = 13.7298;

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"
            ],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
          }
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [defaultLng, defaultLat],
      zoom: 13.5,
      pitch: 25,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      // Add Satellite SAR Water Polygons GeoJSON source
      map.addSource("satellite-water", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: []
        }
      });

      map.addLayer({
        id: "satellite-water-fill",
        type: "fill",
        source: "satellite-water",
        layout: { visibility: "visible" },
        paint: {
          "fill-color": "#8b5cf6",
          "fill-opacity": 0.35
        }
      });

      map.addLayer({
        id: "satellite-water-outline",
        type: "line",
        source: "satellite-water",
        layout: { visibility: "visible" },
        paint: {
          "line-color": "#a78bfa",
          "line-width": 2,
          "line-dasharray": [2, 1]
        }
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Satellite Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource("satellite-water") as maplibregl.GeoJSONSource;
    if (source) {
      if (layers.satellite && satellite && satellite.water_polygons_geojson) {
        source.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: satellite.water_polygons_geojson,
              properties: {
                title: "Sentinel-1 SAR Surface Water Extent",
                acquisition: satellite.acquisition_at
              }
            }
          ]
        });
        map.setLayoutProperty("satellite-water-fill", "visibility", "visible");
        map.setLayoutProperty("satellite-water-outline", "visibility", "visible");
      } else {
        map.setLayoutProperty("satellite-water-fill", "visibility", "none");
        map.setLayoutProperty("satellite-water-outline", "visibility", "none");
      }
    }
  }, [satellite, layers.satellite]);

  // Update Interactive DOM Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // 1. Incidents Layer
    if (layers.incidents) {
      incidents.forEach((inc) => {
        const el = document.createElement("div");
        el.className = "group cursor-pointer";
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-orange-500 opacity-40"></span>
            <div class="relative w-8 h-8 rounded-full bg-orange-600 border-2 border-white shadow-xl flex items-center justify-center text-white font-black text-xs">
              ${inc.report_count}
            </div>
            <div class="absolute -bottom-5 bg-surface-card border border-surface-border text-[10px] font-mono px-1.5 py-0.2 rounded text-orange-300 whitespace-nowrap shadow-md">
              ${inc.consensus_depth_band.replace("DEPTH_", "").replace("_", " ")}
            </div>
          </div>
        `;

        const popupHTML = `
          <div class="p-3 max-w-xs font-sans text-gray-200">
            <div class="flex items-center gap-1.5 text-xs text-orange-400 font-bold mb-1">
              <span>⚠️ INCIDENT #${inc.incident_number}</span>
              <span class="text-[10px] bg-orange-500/20 px-1 rounded">${inc.confidence} CONFIDENCE</span>
            </div>
            <div class="font-bold text-sm text-white mb-1.5">${inc.title}</div>
            <div class="space-y-1 text-xs text-gray-300">
              <div><b>ความลึก:</b> ${inc.consensus_depth_band.replace("DEPTH_", "").replace("_", " ")}</div>
              <div><b>การสัญจร:</b> ${inc.consensus_passability}</div>
              <div><b>รายงานแล้ว:</b> ${inc.report_count} รายงาน (ล่าสุด ${inc.last_report_age_min} นาทีที่แล้ว)</div>
              ${inc.admin_notes ? `<div class="text-[11px] text-gray-400 italic mt-1 border-t border-gray-700 pt-1">Note: ${inc.admin_notes}</div>` : ""}
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(popupHTML);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([inc.longitude, inc.latitude])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("click", () => {
          if (onSelectIncident) onSelectIncident(inc);
        });

        markersRef.current.push(marker);
      });
    }

    // 2. Canal Water Stations Layer
    if (layers.waterStations) {
      waterStations.forEach((stn) => {
        const el = document.createElement("div");
        el.className = "cursor-pointer";
        el.innerHTML = `
          <div class="flex flex-col items-center">
            <div class="w-7 h-7 rounded-lg bg-cyan-600 border border-cyan-300 shadow-lg flex items-center justify-center text-white text-xs font-bold">
              🌊
            </div>
            <div class="mt-0.5 bg-surface-card border border-cyan-500/30 text-[9px] font-mono px-1 rounded text-cyan-300 whitespace-nowrap">
              ${stn.current_level_m_msl?.toFixed(2) || "0.80"}m
            </div>
          </div>
        `;

        const popupHTML = `
          <div class="p-3 max-w-xs font-sans text-gray-200">
            <div class="text-xs text-cyan-400 font-bold mb-1">🌊 CANAL GAUGE (BMA DDS)</div>
            <div class="font-bold text-sm text-white mb-1">${stn.name}</div>
            <div class="space-y-1 text-xs text-gray-300">
              <div><b>ระดับน้ำปัจจุบัน:</b> ${stn.current_level_m_msl?.toFixed(2)} ม.รทก.</div>
              <div><b>แนวโน้ม (Trend):</b> <span class="text-amber-400 font-bold">${stn.trend || "RISING"}</span></div>
              <div><b>เกณฑ์วิกฤต:</b> ${stn.critical_threshold_meters?.toFixed(2) || "1.20"} ม.รทก.</div>
              <div class="text-[10px] text-gray-400 mt-1">อัปเดตเมื่อ ${stn.data_age_min || 4} นาทีที่แล้ว</div>
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(popupHTML);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([stn.longitude, stn.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // 3. Shelters & Emergency Points Layer
    if (layers.shelters) {
      shelters.forEach((sh) => {
        const el = document.createElement("div");
        el.className = "cursor-pointer";
        el.innerHTML = `
          <div class="flex flex-col items-center">
            <div class="w-7 h-7 rounded-full bg-emerald-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs">
              🏥
            </div>
            <div class="mt-0.5 bg-surface-card border border-emerald-500/30 text-[9px] font-mono px-1 rounded text-emerald-300 whitespace-nowrap">
              ${sh.name.substring(0, 16)}...
            </div>
          </div>
        `;

        const popupHTML = `
          <div class="p-3 max-w-xs font-sans text-gray-200">
            <div class="text-xs text-emerald-400 font-bold mb-1">🏥 EMERGENCY SHELTER / AID</div>
            <div class="font-bold text-sm text-white mb-1">${sh.name}</div>
            <div class="space-y-1 text-xs text-gray-300">
              <div><b>ประเภท:</b> ${sh.point_type}</div>
              ${sh.capacity ? `<div><b>ความจุ:</b> ${sh.current_occupancy}/${sh.capacity} คน</div>` : ""}
              <div><b>เบอร์ติดต่อ:</b> ${sh.contact_number || "02-329-8000"}</div>
              <div><b>เวลาทำการ:</b> ${sh.operating_hours || "24 ชั่วโมง"}</div>
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(popupHTML);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([sh.longitude, sh.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }
  }, [incidents, waterStations, shelters, layers, onSelectIncident]);

  return (
    <div className={`relative w-full h-full ${className || ""}`}>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
};
