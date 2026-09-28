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
  highContrast?: boolean;
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
  highContrast = false,
  className
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [webGlSupported, setWebGlSupported] = useState(true);

  // Default coordinate center: KMITL Campus, Lat Krabang
  const defaultLng = 100.7782;
  const defaultLat = 13.7298;

  useEffect(() => {
    const hasWebGL = (() => {
      try {
        const canvas = document.createElement("canvas");
        return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
      } catch {
        return false;
      }
    })();

    if (!hasWebGL) {
      setWebGlSupported(false);
      return;
    }

    if (!mapContainer.current || mapRef.current) return;

    const tileStyleUrl = highContrast
      ? "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
      : "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png";

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              tileStyleUrl,
              "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
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
      zoom: 14,
      pitch: 0,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      setIsMapLoaded(true);
      map.resize();
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
          "fill-color": "#3b82f6",
          "fill-opacity": 0.4
        }
      });

      map.addLayer({
        id: "satellite-water-outline",
        type: "line",
        source: "satellite-water",
        layout: { visibility: "visible" },
        paint: {
          "line-color": "#2563eb",
          "line-width": 2,
          "line-dasharray": [2, 1]
        }
      });
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    const resizeTimer = setTimeout(() => {
      map.resize();
    }, 200);

    mapRef.current = map;

    return () => {
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setIsMapLoaded(false);
    };
  }, [highContrast]);

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

  // P2-01: High-contrast mode — boost satellite polygon opacity for daylight readability
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      map.setPaintProperty("satellite-water-fill", "fill-opacity", highContrast ? 0.75 : 0.35);
      map.setPaintProperty("satellite-water-outline", "line-width", highContrast ? 3 : 2);
      map.setPaintProperty("satellite-water-outline", "line-color", highContrast ? "#c4b5fd" : "#a78bfa");
    } catch {
      // layer may not exist yet if map style not loaded
    }
  }, [highContrast]);

  // Update Interactive DOM Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

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

    // 4. Citizen Reports Layer
    if (layers.reports && reports) {
      reports.forEach((rep) => {
        const el = document.createElement("div");
        el.className = "cursor-pointer group";
        const depthColor = rep.water_depth_band?.includes("ABOVE_60") || rep.water_depth_band?.includes("40_TO_60")
          ? "bg-red-500"
          : rep.water_depth_band?.includes("20_TO_40")
          ? "bg-amber-500"
          : "bg-blue-500";
        el.innerHTML = `
          <div class="relative flex flex-col items-center">
            <div class="w-6 h-6 rounded-full ${depthColor} border-2 border-white shadow-lg flex items-center justify-center text-white text-[11px] font-bold">
              💧
            </div>
            <div class="mt-0.5 bg-surface-card border border-surface-border text-[9px] font-mono px-1 rounded text-gray-200 whitespace-nowrap shadow">
              ${rep.water_depth_band?.replace("DEPTH_", "").replace(/_/g, " ") || "น้ำท่วม"}
            </div>
          </div>
        `;

        const popupHTML = `
          <div class="p-3 max-w-xs font-sans text-gray-200">
            <div class="text-xs text-blue-400 font-bold mb-1">📢 CITIZEN FLOOD REPORT</div>
            <div class="font-bold text-sm text-white mb-1">${rep.description || "รายงานน้ำท่วมขัง"}</div>
            <div class="space-y-1 text-xs text-gray-300">
              <div><b>ระดับน้ำ:</b> ${rep.water_depth_band?.replace("DEPTH_", "").replace(/_/g, " ") || "-"}</div>
              <div><b>การสัญจร:</b> ${rep.vehicle_passability || "-"}</div>
              <div><b>ยานพาหนะ:</b> ${rep.transport_type || "-"}</div>
              <div><b>ความน่าเชื่อถือ:</b> ${rep.confidence || "-"}</div>
              <div class="text-[10px] text-gray-400 mt-1">เวลาที่สังเกต: ${new Date(rep.observed_at).toLocaleTimeString()}</div>
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(popupHTML);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([rep.longitude, rep.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }
  }, [isMapLoaded, incidents, reports, waterStations, shelters, layers, onSelectIncident]);

  if (!webGlSupported) {
    return (
      <div className={`relative w-full h-full min-h-[500px] flex flex-col items-center justify-center bg-surface p-6 text-center ${className || ""}`}>
        <div className="max-w-md bg-surface-card border border-surface-border p-6 rounded-2xl shadow-2xl">
          <div className="text-3xl mb-3">🗺️</div>
          <h3 className="text-base font-bold text-white mb-2">แผนที่สถานการณ์น้ำท่วม (WebGL Not Supported)</h3>
          <p className="text-xs text-gray-400 mb-4">
            เบราว์เซอร์ของคุณยังไม่ได้เปิดใช้การเร่งความเร็วกราฟิก (Hardware WebGL) ระบบจึงแสดงข้อมูลสรุปสถานการณ์แบบรายการด้านล่าง
          </p>
          <div className="text-left space-y-2 max-h-60 overflow-y-auto pr-1">
            {incidents.map((inc) => (
              <div key={inc.id} className="p-2.5 rounded-lg bg-orange-950/40 border border-orange-500/30 text-xs">
                <div className="font-bold text-orange-400">⚠️ #{inc.incident_number}: {inc.title}</div>
                <div className="text-gray-300 text-[11px] mt-1">ระดับน้ำ: {inc.consensus_depth_band} | รถผ่าน: {inc.consensus_passability}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full min-h-[500px] ${className || ""}`}>
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
