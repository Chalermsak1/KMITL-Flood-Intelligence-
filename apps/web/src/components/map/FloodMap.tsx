"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LayerState } from "./LayerControl";
import {
  Incident,
  FloodReport,
  WaterStation,
  AssistancePoint,
  SatelliteObservation,
  SelectedFeature,
  RoadCollectionResponse,
  RoadProperties,
  DrainageCollectionResponse,
  DrainageFeature
} from "../../lib/types";

export type MapDisplayMode = "FLOOD_CONDITION" | "WATER_MOVEMENT";

const getBaseMapStyle = (highContrast: boolean): string | maplibregl.StyleSpecification => {
  // Authoritative CARTO Vector GL basemaps (EPSG:4326/EPSG:3857 OpenStreetMap vector tiles)
  // Ensures sub-pixel GIS accuracy and eliminates raster pixel stretching/shifting.
  return highContrast
    ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
};


interface FloodMapProps {
  layers: LayerState;
  roads?: RoadCollectionResponse | null;
  drainage?: DrainageCollectionResponse | null;
  incidents: Incident[];
  reports: FloodReport[];
  waterStations: WaterStation[];
  shelters: AssistancePoint[];
  satellite?: SatelliteObservation | null;
  onSelectIncident?: (incident: Incident) => void;
  onSelectFeature?: (feature: SelectedFeature) => void;
  onSelectRoad?: (road: RoadProperties) => void;
  centerTarget?: { lat: number; lng: number; zoom?: number } | null;
  currentLocation?: { lat: number; lng: number; name?: string; accuracy?: number; timestamp?: number } | null;
  monitoredLocation?: { lat: number; lng: number; name: string; isHome?: boolean } | null;
  highContrast?: boolean;
  className?: string;
  mapMode?: MapDisplayMode;
  activeTraceRoad?: RoadProperties | null;
  onRequestCurrentLocation?: () => void;
  gpsLoading?: boolean;
}

// Distance along polyline interpolation helper for directional water flow particles
function interpolateAlongPath(coords: [number, number][], fraction: number): [number, number] {
  if (!coords || coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];
  if (fraction <= 0) return coords[0];
  if (fraction >= 1) return coords[coords.length - 1];

  let totalDist = 0;
  const dists: number[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const dx = coords[i + 1][0] - coords[i][0];
    const dy = coords[i + 1][1] - coords[i][1];
    const d = Math.sqrt(dx * dx + dy * dy);
    dists.push(d);
    totalDist += d;
  }
  if (totalDist === 0) return coords[0];

  const targetDist = fraction * totalDist;
  let accumulated = 0;
  for (let i = 0; i < dists.length; i++) {
    if (accumulated + dists[i] >= targetDist) {
      const segFraction = (targetDist - accumulated) / (dists[i] || 0.00001);
      const lng = coords[i][0] + segFraction * (coords[i + 1][0] - coords[i][0]);
      const lat = coords[i][1] + segFraction * (coords[i + 1][1] - coords[i][1]);
      return [lng, lat];
    }
    accumulated += dists[i];
  }
  return coords[coords.length - 1];
}

export const FloodMap: React.FC<FloodMapProps> = ({
  layers,
  roads,
  drainage,
  incidents,
  reports,
  waterStations,
  shelters,
  satellite,
  onSelectIncident,
  onSelectFeature,
  onSelectRoad,
  centerTarget,
  currentLocation,
  monitoredLocation,
  highContrast = false,
  className,
  mapMode = "FLOOD_CONDITION",
  activeTraceRoad = null,
  onRequestCurrentLocation,
  gpsLoading = false
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const drainageMarkersRef = useRef<maplibregl.Marker[]>([]);
  const currentLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const monitoredLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [webGlSupported, setWebGlSupported] = useState(true);

  // Keep callback refs stable to prevent unmounting and re-creating the WebGL context
  const onSelectRoadRef = useRef(onSelectRoad);
  onSelectRoadRef.current = onSelectRoad;
  const onSelectFeatureRef = useRef(onSelectFeature);
  onSelectFeatureRef.current = onSelectFeature;
  const onSelectIncidentRef = useRef(onSelectIncident);
  onSelectIncidentRef.current = onSelectIncident;

  // Default coordinate center: KMITL Campus, Lat Krabang
  const defaultLng = 100.7782;
  const defaultLat = 13.7298;

  // Initialize MapLibre
  useEffect(() => {
    const isSupported = (() => {
      try {
        if (typeof (maplibregl as any).supported === "function") {
          return (maplibregl as any).supported({ failIfMajorPerformanceCaveat: false });
        }
        const canvas = document.createElement("canvas");
        return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
      } catch {
        return false;
      }
    })();


    if (!isSupported) {
      setWebGlSupported(false);
      return;
    }

    if (!mapContainer.current || mapRef.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainer.current,
        style: getBaseMapStyle(highContrast),
        center: [defaultLng, defaultLat],
        zoom: 14,
        pitch: 0,
        attributionControl: false
      });
    } catch (err) {
      console.warn("MapLibre initialization failed:", err);
      setWebGlSupported(false);
      return;
    }


    map.on("error", (e) => {
      console.warn("MapLibre event error:", e);
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      setIsMapLoaded(true);
      map.resize();
      setTimeout(() => map.resize(), 100);
      setTimeout(() => map.resize(), 500);

      // 1. Satellite SAR Water Source & Layers
      map.addSource("satellite-water", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      map.addLayer({
        id: "satellite-water-fill",
        type: "fill",
        source: "satellite-water",
        layout: { visibility: "visible" },
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": 0.35
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

      // 2. Drainage Network Source & Layers (Section 15)
      map.addSource("drainage-network", {
        type: "geojson",
        data: drainage || { type: "FeatureCollection", features: [] }
      });

      map.addLayer({
        id: "drainage-canals-casing",
        type: "line",
        source: "drainage-network",
        filter: ["==", "$type", "LineString"],
        layout: { visibility: layers.drainage ? "visible" : "none" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 6,
          "line-opacity": 0.9
        }
      });

      map.addLayer({
        id: "drainage-canals",
        type: "line",
        source: "drainage-network",
        filter: ["==", "$type", "LineString"],
        layout: {
          visibility: layers.drainage ? "visible" : "none",
          "line-cap": "round",
          "line-join": "round"
        },
        paint: {
          "line-color": "#0284c7",
          "line-width": 4,
          "line-opacity": 0.9
        }
      });

      map.addLayer({
        id: "drainage-canals-label",
        type: "symbol",
        source: "drainage-network",
        filter: ["==", "$type", "LineString"],
        layout: {
          visibility: layers.drainage ? "visible" : "none",
          "symbol-placement": "line",
          "text-field": ["get", "name"],
          "text-size": 10,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-offset": [0, 1]
        },
        paint: {
          "text-color": "#0369a1",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2
        }
      });

      // 3. Roads Network Source & Layers (Section 7, 8, 9, 10, 13, 14, 20)
      map.addSource("roads-network", {
        type: "geojson",
        data: roads || { type: "FeatureCollection", features: [] }
      });

      // Casing for contrast
      map.addLayer({
        id: "roads-casing",
        type: "line",
        source: "roads-network",
        layout: { visibility: layers.floodStatus ? "visible" : "none" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 8,
          "line-opacity": 0.9
        }
      });

      // Main Road Flood Condition Line (Section 20 colors)
      map.addLayer({
        id: "roads-line",
        type: "line",
        source: "roads-network",
        layout: {
          visibility: layers.floodStatus ? "visible" : "none",
          "line-cap": "round",
          "line-join": "round"
        },
        paint: {
          "line-color": [
            "match",
            ["get", "status"],
            "BLOCKED", "#991b1b",
            "SEVERELY_FLOODED", "#ef4444",
            "FLOODED", "#f97316",
            "WATER_PRESENT", "#eab308",
            "NO_EVIDENCE", "#94a3b8",
            "#64748b"
          ],
          "line-width": 5.5
        }
      });

      // Water Flow Layer (Section 13)
      map.addLayer({
        id: "roads-flow",
        type: "line",
        source: "roads-network",
        filter: ["==", ["get", "flow_status"], "ESTIMATED"],
        layout: {
          visibility: layers.waterFlow ? "visible" : "none",
          "line-cap": "round"
        },
        paint: {
          "line-color": "#06b6d4",
          "line-width": 3,
          "line-dasharray": [2, 2]
        }
      });

      // Directional Water Flow Arrows along roads (Section 12: Directional Indicators)
      map.addLayer({
        id: "roads-flow-arrows",
        type: "symbol",
        source: "roads-network",
        filter: ["in", ["get", "flow_status"], ["literal", ["ESTIMATED", "OBSERVED"]]],
        layout: {
          visibility: layers.waterFlow ? "visible" : "none",
          "symbol-placement": "line",
          "symbol-spacing": 75,
          "text-field": "▶",
          "text-size": 13,
          "text-keep-upright": false,
          "text-allow-overlap": true,
          "text-ignore-placement": true
        },
        paint: {
          "text-color": "#0284c7",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2
        }
      });

      // Water Depth Label Layer (Section 9)
      map.addLayer({
        id: "roads-depth-label",
        type: "symbol",
        source: "roads-network",
        filter: ["!=", ["get", "water_depth_display"], ""],
        layout: {
          visibility: layers.waterDepth ? "visible" : "none",
          "symbol-placement": "line-center",
          "text-field": ["get", "water_depth_display"],
          "text-size": 11,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-offset": [0, -1]
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2.5
        }
      });

      // Flood Trend Label Layer (Section 10)
      map.addLayer({
        id: "roads-trend-label",
        type: "symbol",
        source: "roads-network",
        filter: ["!=", ["get", "trend"], "UNKNOWN"],
        layout: {
          visibility: layers.floodTrend ? "visible" : "none",
          "symbol-placement": "line-center",
          "text-field": ["concat", "Trend: ", ["get", "trend"]],
          "text-size": 10,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-offset": [0, 1.2]
        },
        paint: {
          "text-color": "#6b21a8",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2
        }
      });

      // Hit area for easy tap/click on mobile and mouse
      map.addLayer({
        id: "roads-hit",
        type: "line",
        source: "roads-network",
        paint: {
          "line-width": 20,
          "line-opacity": 0.01
        }
      });

      // Click and hover interaction on road segments
      map.on("mouseenter", "roads-hit", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "roads-hit", () => {
        map.getCanvas().style.cursor = "";
      });

      const parseJsonProp = (val: any, fallback: any) => {
        if (val == null) return fallback;
        if (typeof val === "string") {
          try {
            return JSON.parse(val);
          } catch {
            return fallback;
          }
        }
        return val;
      };

      const handleRoadClick = (e: any) => {
        if (e.features && e.features.length > 0) {
          const rawProps = e.features[0].properties as any;
          const parsed: RoadProperties = {
            ...rawProps,
            source_inputs: parseJsonProp(rawProps.source_inputs, []),
            flow_path_steps: parseJsonProp(rawProps.flow_path_steps, []),
            flow_path_coordinates: parseJsonProp(rawProps.flow_path_coordinates, []),
            flow_explanation: parseJsonProp(rawProps.flow_explanation, null),
            elevation_m: Number(rawProps.elevation_m || 0),
            length_km: Number(rawProps.length_km || 0),
            corroborating_reports: Number(rawProps.corroborating_reports || 0),
            water_depth_cm: rawProps.water_depth_cm != null && rawProps.water_depth_cm !== "null" ? Number(rawProps.water_depth_cm) : null,
            change_1h_cm: rawProps.change_1h_cm != null && rawProps.change_1h_cm !== "null" ? Number(rawProps.change_1h_cm) : null,
            change_3h_cm: rawProps.change_3h_cm != null && rawProps.change_3h_cm !== "null" ? Number(rawProps.change_3h_cm) : null,
            change_24h_cm: rawProps.change_24h_cm != null && rawProps.change_24h_cm !== "null" ? Number(rawProps.change_24h_cm) : null
          };
          if (onSelectRoadRef.current) {
            onSelectRoadRef.current(parsed);
          }
        }
      };

      map.on("click", "roads-hit", handleRoadClick);
      map.on("click", "roads-line", handleRoadClick);

      // 4. Flow Trace Sources & Visual Layers (Sections 3, 4, 18)
      map.addSource("flow-trace-path", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      map.addSource("flow-trace-nodes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      map.addSource("flow-trace-particles", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      // Flow Trace Glow
      map.addLayer({
        id: "flow-trace-glow",
        type: "line",
        source: "flow-trace-path",
        layout: {
          "line-cap": "round",
          "line-join": "round"
        },
        paint: {
          "line-color": "#38bdf8",
          "line-width": 11,
          "line-blur": 6,
          "line-opacity": 0.75
        }
      });

      // Flow Trace Main Line
      map.addLayer({
        id: "flow-trace-line",
        type: "line",
        source: "flow-trace-path",
        layout: {
          "line-cap": "round",
          "line-join": "round"
        },
        paint: {
          "line-color": "#0284c7",
          "line-width": 5,
          "line-dasharray": [3, 1.5]
        }
      });

      // Static directional arrows for prefers-reduced-motion
      map.addLayer({
        id: "flow-trace-static-arrows",
        type: "symbol",
        source: "flow-trace-path",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 60,
          "text-field": "▶",
          "text-size": 13,
          "text-keep-upright": false,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          visibility: "none"
        },
        paint: {
          "text-color": "#0369a1",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2
        }
      });

      // Animated Water Movement Particles (directional flow: ────•────•────•────→)
      map.addLayer({
        id: "flow-trace-particles",
        type: "circle",
        source: "flow-trace-particles",
        paint: {
          "circle-radius": 7,
          "circle-color": "#0284c7",
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.95
        }
      });

      // Flow Step Nodes (Source, Low Point, Drainage, Canal)
      map.addLayer({
        id: "flow-trace-nodes-circle",
        type: "circle",
        source: "flow-trace-nodes",
        paint: {
          "circle-radius": [
            "match",
            ["get", "type"],
            "ORIGIN", 8.5,
            "CANAL", 8.5,
            "LOW_POINT", 7,
            "DRAINAGE", 7.5,
            5.5
          ],
          "circle-color": [
            "match",
            ["get", "type"],
            "ORIGIN", "#ea580c",
            "CANAL", "#0284c7",
            "LOW_POINT", "#eab308",
            "DRAINAGE", "#0d9488",
            "#64748b"
          ],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff"
        }
      });

      map.addLayer({
        id: "flow-trace-nodes-label",
        type: "symbol",
        source: "flow-trace-nodes",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-offset": [0, 1.4],
          "text-anchor": "top"
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2.5
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
    if (typeof window !== "undefined") {
      (window as any).__map = map;
    }

    return () => {
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const frame = animFrameRef.current;
      if (frame) cancelAnimationFrame(frame);
      map.remove();
      mapRef.current = null;
      setIsMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highContrast]);

  // Update Roads GeoJSON data whenever props change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !roads) return;
    const src = map.getSource("roads-network") as maplibregl.GeoJSONSource;
    if (src) {
      src.setData(roads);
    }
  }, [roads, isMapLoaded]);

  // Update Drainage GeoJSON data whenever props change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !drainage) return;
    const src = map.getSource("drainage-network") as maplibregl.GeoJSONSource;
    if (src) {
      src.setData(drainage);
    }
  }, [drainage, isMapLoaded]);

  // Update Layer Visibility dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    try {
      map.setLayoutProperty("roads-casing", "visibility", layers.floodStatus ? "visible" : "none");
      map.setLayoutProperty("roads-line", "visibility", layers.floodStatus ? "visible" : "none");
      map.setLayoutProperty("roads-flow", "visibility", layers.waterFlow ? "visible" : "none");
      map.setLayoutProperty("roads-flow-arrows", "visibility", layers.waterFlow ? "visible" : "none");
      map.setLayoutProperty("roads-depth-label", "visibility", layers.waterDepth ? "visible" : "none");
      map.setLayoutProperty("roads-trend-label", "visibility", layers.floodTrend ? "visible" : "none");
      map.setLayoutProperty("drainage-canals-casing", "visibility", layers.drainage ? "visible" : "none");
      map.setLayoutProperty("drainage-canals", "visibility", layers.drainage ? "visible" : "none");
      map.setLayoutProperty("drainage-canals-label", "visibility", layers.drainage ? "visible" : "none");
    } catch {
      // styles may still be initializing
    }
  }, [layers, isMapLoaded]);

  // Dim unrelated roads in WATER_MOVEMENT mode (Requirements 1, 2, 3)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !isMapLoaded) return;

    try {
      if (mapMode === "WATER_MOVEMENT") {
        if (activeTraceRoad) {
          // Dim all road segments except the selected trace road
          map.setPaintProperty("roads-line", "line-opacity", [
            "case",
            ["==", ["get", "road_segment_id"], activeTraceRoad.road_segment_id],
            1.0,
            0.18
          ]);
          map.setPaintProperty("roads-casing", "line-opacity", [
            "case",
            ["==", ["get", "road_segment_id"], activeTraceRoad.road_segment_id],
            0.9,
            0.12
          ]);
        } else {
          // In Water Movement mode without a selected trace, emphasize roads with estimated flow, dim others
          map.setPaintProperty("roads-line", "line-opacity", [
            "case",
            ["in", ["get", "flow_status"], ["literal", ["ESTIMATED", "OBSERVED"]]],
            1.0,
            0.25
          ]);
          map.setPaintProperty("roads-casing", "line-opacity", [
            "case",
            ["in", ["get", "flow_status"], ["literal", ["ESTIMATED", "OBSERVED"]]],
            0.85,
            0.15
          ]);
        }
      } else {
        // FLOOD_CONDITION mode: restore normal crisp road visibility
        map.setPaintProperty("roads-line", "line-opacity", 1.0);
        map.setPaintProperty("roads-casing", "line-opacity", 0.9);
      }
    } catch {
      // Paint properties might not be ready yet
    }
  }, [mapMode, activeTraceRoad, isMapLoaded]);

  // Handle Active Flow Trace and Particle Animation (Requirements 3, 4, 18)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !isMapLoaded) return;

    const pathSource = map.getSource("flow-trace-path") as maplibregl.GeoJSONSource;
    const nodesSource = map.getSource("flow-trace-nodes") as maplibregl.GeoJSONSource;
    const particlesSource = map.getSource("flow-trace-particles") as maplibregl.GeoJSONSource;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (!activeTraceRoad || !activeTraceRoad.flow_path_coordinates || activeTraceRoad.flow_path_coordinates.length < 2) {
      // If no single road is actively selected, but in WATER_MOVEMENT mode or waterFlow layer is active:
      // Show overall flow pathways for all road segments with ESTIMATED flow data
      if ((mapMode === "WATER_MOVEMENT" || layers.waterFlow) && roads?.features) {
        const flowFeatures: any[] = [];
        const flowNodes: any[] = [];
        roads.features.forEach((f) => {
          const props = f.properties;
          if (props.flow_status === "ESTIMATED" || props.flow_status === "OBSERVED") {
            const rawCoords = props.flow_path_coordinates || f.geometry.coordinates;
            const parsedCoords = typeof rawCoords === "string" ? JSON.parse(rawCoords) : rawCoords;
            if (Array.isArray(parsedCoords) && parsedCoords.length >= 2) {
              flowFeatures.push({
                type: "Feature",
                geometry: { type: "LineString", coordinates: parsedCoords },
                properties: { road_id: props.road_segment_id, flow_status: props.flow_status }
              });
            }
            if (props.flow_path_steps) {
              const steps = typeof props.flow_path_steps === "string" ? JSON.parse(props.flow_path_steps) : props.flow_path_steps;
              if (Array.isArray(steps)) {
                steps.forEach((st: any) => {
                  if (st.coordinates && Array.isArray(st.coordinates) && st.coordinates.length === 2) {
                    flowNodes.push({
                      type: "Feature",
                      geometry: { type: "Point", coordinates: st.coordinates },
                      properties: { name: st.name, type: st.type, status: st.status }
                    });
                  }
                });
              }
            }
          }
        });

        if (flowFeatures.length > 0) {
          if (pathSource) pathSource.setData({ type: "FeatureCollection", features: flowFeatures });
          if (nodesSource) nodesSource.setData({ type: "FeatureCollection", features: flowNodes });
          if (particlesSource) particlesSource.setData({ type: "FeatureCollection", features: [] });
          try {
            map.setLayoutProperty("flow-trace-static-arrows", "visibility", "visible");
          } catch {}
          return;
        }
      }

      // Clear flow trace
      if (pathSource) pathSource.setData({ type: "FeatureCollection", features: [] });
      if (nodesSource) nodesSource.setData({ type: "FeatureCollection", features: [] });
      if (particlesSource) particlesSource.setData({ type: "FeatureCollection", features: [] });
      try {
        map.setLayoutProperty("flow-trace-static-arrows", "visibility", "none");
      } catch {}
      return;
    }

    const coords = activeTraceRoad.flow_path_coordinates as [number, number][];

    // 1. Set Path
    if (pathSource) {
      pathSource.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: coords
            },
            properties: {
              road_id: activeTraceRoad.road_segment_id,
              status: activeTraceRoad.status,
              flow_status: activeTraceRoad.flow_status
            }
          }
        ]
      });
    }

    // 2. Set Step Nodes (Origin -> Low Point -> Drainage -> Canal)
    if (nodesSource && activeTraceRoad.flow_path_steps) {
      const nodeFeatures = activeTraceRoad.flow_path_steps
        .filter((step) => step.coordinates && step.coordinates.length === 2)
        .map((step, idx) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: step.coordinates as [number, number]
          },
          properties: {
            name: step.name,
            type: step.type,
            step_order: idx + 1,
            status: step.status
          }
        }));

      nodesSource.setData({
        type: "FeatureCollection",
        features: nodeFeatures
      });
    }

    // 3. Auto-fit bounds to the flow trace path (Requirement 3 & 14)
    let minLng = coords[0][0], maxLng = coords[0][0], minLat = coords[0][1], maxLat = coords[0][1];
    coords.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
    const padLng = Math.max((maxLng - minLng) * 0.18, 0.004);
    const padLat = Math.max((maxLat - minLat) * 0.18, 0.004);
    map.fitBounds(
      [
        [minLng - padLng, minLat - padLat],
        [maxLng + padLng, maxLat + padLat]
      ],
      {
        padding: { top: 90, bottom: 240, left: 60, right: 60 },
        maxZoom: 16.5,
        duration: 1200
      }
    );

    // 4. Visual Language & Motion (Requirement 4 & 18)
    if (prefersReducedMotion) {
      // Fallback: Static directional arrows along the path
      try {
        map.setLayoutProperty("flow-trace-static-arrows", "visibility", "visible");
      } catch {}
      if (particlesSource) particlesSource.setData({ type: "FeatureCollection", features: [] });
    } else {
      // Animated directional particles along the flow path: ────•────•────•────→
      try {
        map.setLayoutProperty("flow-trace-static-arrows", "visibility", "none");
      } catch {}

      const durationMs = 2800;
      const animateParticles = () => {
        const now = Date.now();
        const progress = (now % durationMs) / durationMs;
        // Generate 3 flowing particle points spaced evenly along the flow path
        const particleOffsets = [0, 0.33, 0.67];
        const particlePoints = particleOffsets.map((offset) => {
          const frac = (progress + offset) % 1.0;
          return interpolateAlongPath(coords, frac);
        });

        if (particlesSource) {
          particlesSource.setData({
            type: "FeatureCollection",
            features: particlePoints.map((pt, i) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: pt
              },
              properties: { id: i }
            }))
          });
        }

        animFrameRef.current = requestAnimationFrame(animateParticles);
      };

      animFrameRef.current = requestAnimationFrame(animateParticles);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [activeTraceRoad, mapMode, layers.waterFlow, roads, isMapLoaded]);

  // Smooth pan to target coordinate when requested
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !centerTarget) return;
    console.log(`MAP CENTER: lng=${centerTarget.lng} lat=${centerTarget.lat} zoom=${centerTarget.zoom || 15.5}`);
    map.flyTo({
      center: [centerTarget.lng, centerTarget.lat],
      zoom: centerTarget.zoom || 15.5,
      essential: true,
      duration: 1000
    });
  }, [centerTarget]);

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

  // Update Drainage Station Markers (Pumps and Retention Basins)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    drainageMarkersRef.current.forEach((m) => m.remove());
    drainageMarkersRef.current = [];

    if (layers.drainage && drainage?.features) {
      drainage.features.forEach((feat) => {
        if (feat.geometry.type === "Point") {
          const isPump = feat.properties.drainage_type === "PUMP_STATION";
          const el = document.createElement("div");
          el.className = "cursor-pointer select-none group";
          el.innerHTML = `
            <div class="flex flex-col items-center">
              <div class="w-7 h-7 rounded-lg ${isPump ? "bg-blue-700" : "bg-teal-700"} border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold">
                ${isPump ? "⚙️" : "🏞️"}
              </div>
              <div class="mt-0.5 bg-white border border-slate-300 text-[9px] font-mono font-bold px-1 rounded text-slate-800 whitespace-nowrap shadow-sm">
                ${feat.properties.name.substring(0, 14)}...
              </div>
            </div>
          `;

          const featurePayload: SelectedFeature = {
            type: "DRAINAGE",
            title: feat.properties.name,
            source: feat.properties.monitored_by,
            timestamp: new Date().toISOString(),
            status: feat.properties.current_status,
            confidence: "HIGH",
            measurements: {
              "Type": feat.properties.drainage_type,
              "Capacity": feat.properties.capacity_note || "Maintained",
              "Operating Status": feat.properties.current_status,
              "Authority": feat.properties.monitored_by
            },
            provenance: {
              mode: "LIVE",
              attribution: feat.properties.monitored_by,
              notes: "Geographic drainage infrastructure in Lat Krabang basin."
            },
            raw: feat
          };

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(feat.geometry.coordinates)
            .addTo(map);

          el.addEventListener("click", () => {
            if (onSelectFeature) onSelectFeature(featurePayload);
          });

          drainageMarkersRef.current.push(marker);
        }
      });
    }
  }, [isMapLoaded, drainage, layers.drainage, onSelectFeature]);

  // Update Current Device GPS Marker (Independent from Monitored Location)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.remove();
      currentLocationMarkerRef.current = null;
    }

    if (currentLocation) {
      const accuracyStr = currentLocation.accuracy ? ` (±${Math.round(currentLocation.accuracy)}m)` : "";
      const el = document.createElement("div");
      el.className = "cursor-pointer select-none group";
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-500 opacity-60"></span>
          <div class="relative w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center">
            <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
          </div>
          <div class="absolute -bottom-6 bg-slate-900 text-white border border-slate-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-lg">
            ● My Location${accuracyStr}
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(`
        <div class="p-2 text-xs font-mono">
          <div class="font-bold text-blue-700">● Device Current Location (ตำแหน่งจริงของคุณ)</div>
          <div class="text-slate-800 font-bold mt-1">${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}</div>
          ${currentLocation.accuracy ? `<div class="text-[10px] text-slate-600 mt-0.5 font-medium">GPS Accuracy: ±${Math.round(currentLocation.accuracy)} meters</div>` : ""}
          ${currentLocation.timestamp ? `<div class="text-[10px] text-slate-400 mt-0.5">Recorded: ${new Date(currentLocation.timestamp).toLocaleTimeString()}</div>` : ""}
          <div class="text-[10px] text-slate-400 mt-1 border-t border-slate-200 pt-1">Real device GPS position. Independent from monitored area.</div>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .setPopup(popup)
        .addTo(map);

      currentLocationMarkerRef.current = marker;
    }
  }, [currentLocation, isMapLoaded]);

  // Update Monitored Location Target Marker (Home / Watch Location)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    if (monitoredLocationMarkerRef.current) {
      monitoredLocationMarkerRef.current.remove();
      monitoredLocationMarkerRef.current = null;
    }

    if (monitoredLocation) {
      const isHome = monitoredLocation.isHome;
      const el = document.createElement("div");
      el.className = "cursor-pointer select-none group";
      el.innerHTML = `
        <div class="relative flex flex-col items-center">
          <div class="w-8 h-8 rounded-xl ${isHome ? "bg-amber-500" : "bg-indigo-600"} border-2 border-white shadow-2xl flex items-center justify-center text-white text-sm font-bold">
            ${isHome ? "⌂" : "🎯"}
          </div>
          <div class="mt-1 bg-white dark:bg-slate-900 border-2 ${isHome ? "border-amber-400 text-amber-900 dark:text-amber-200" : "border-indigo-400 text-indigo-900 dark:text-indigo-200"} text-[10px] font-mono font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-md">
            ${isHome ? "⌂ Home: " : "🎯 "}${monitoredLocation.name.substring(0, 18)}
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(`
        <div class="p-2 text-xs font-mono">
          <div class="font-bold ${isHome ? "text-amber-700" : "text-indigo-700"}">
            ${isHome ? "⌂ Monitored Home Location" : "🎯 Monitored Target Location"}
          </div>
          <div class="font-bold text-slate-800 text-sm mt-0.5">${monitoredLocation.name}</div>
          <div class="text-slate-500 mt-0.5">${monitoredLocation.lat.toFixed(5)}, ${monitoredLocation.lng.toFixed(5)}</div>
          <div class="text-[10px] text-slate-400 mt-1">Flood analysis and alerts are focused on this monitored area.</div>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([monitoredLocation.lng, monitoredLocation.lat])
        .setPopup(popup)
        .addTo(map);

      monitoredLocationMarkerRef.current = marker;
    }
  }, [monitoredLocation, isMapLoaded]);

  // Update Interactive DOM Markers (Incidents, Reports, WaterStations, Shelters)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // 1. Incidents Layer (Clustered Hotspots)
    if (layers.incidents && incidents) {
      incidents.forEach((inc) => {
        const el = document.createElement("div");
        el.className = "group cursor-pointer select-none";
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-orange-500 opacity-40"></span>
            <div class="relative w-8 h-8 rounded-full bg-orange-600 border-2 border-white shadow-lg flex items-center justify-center text-white font-extrabold text-xs">
              ${inc.report_count}
            </div>
            <div class="absolute -bottom-5 bg-white border border-slate-300 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded text-orange-800 whitespace-nowrap shadow-sm">
              ${inc.consensus_depth_band.replace("DEPTH_", "").replace(/_/g, " ")}
            </div>
          </div>
        `;

        const featurePayload: SelectedFeature = {
          type: "INCIDENT",
          title: inc.title || `Incident Cluster #${inc.incident_number}`,
          source: `DBSCAN Corroboration (${inc.report_count} citizen reports)`,
          timestamp: inc.last_reported_at || inc.first_reported_at,
          status: inc.status || "ACTIVE",
          confidence: inc.confidence,
          measurements: {
            "Consensus Depth": inc.consensus_depth_band.replace("DEPTH_", "").replace(/_/g, " "),
            "Passability": inc.consensus_passability,
            "Corroborating Reports": inc.report_count,
            "Age": `${inc.last_report_age_min} min ago`
          },
          provenance: {
            mode: "LIVE",
            attribution: "KMITL Spatio-temporal Clustering Engine",
            notes: "Synthesized from corroborating citizen reports in Lat Krabang corridor."
          },
          raw: inc
        };

        const popupHTML = `
          <div class="p-3 max-w-xs font-sans text-slate-800 dark:text-slate-200">
            <div class="flex items-center justify-between gap-1.5 text-xs text-orange-600 font-bold mb-1">
              <span>⚠️ INCIDENT #${inc.incident_number}</span>
              <span class="text-[10px] px-1 py-0.2 rounded bg-orange-100 text-orange-800 border border-orange-200 font-mono">${inc.confidence}</span>
            </div>
            <div class="font-bold text-sm text-slate-900 dark:text-white mb-1.5">${inc.title}</div>
            <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div><b>ความลึก:</b> ${inc.consensus_depth_band.replace("DEPTH_", "").replace(/_/g, " ")}</div>
              <div><b>การสัญจร:</b> ${inc.consensus_passability}</div>
              <div><b>รายงาน:</b> ${inc.report_count} รายงานที่สอดคล้องกัน</div>
              <div class="text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                ล่าสุดเมื่อ ${inc.last_report_age_min} นาทีที่แล้ว • คลิกเพื่อดูรายละเอียดเพิ่มเติม
              </div>
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
          if (onSelectFeature) onSelectFeature(featurePayload);
        });

        markersRef.current.push(marker);
      });
    }

    // 2. Canal Water Stations Layer
    if (layers.waterStations && waterStations) {
      waterStations.forEach((stn) => {
        const el = document.createElement("div");
        el.className = "cursor-pointer select-none";
        el.innerHTML = `
          <div class="flex flex-col items-center">
            <div class="w-7 h-7 rounded-lg bg-cyan-700 border border-cyan-400 shadow-md flex items-center justify-center text-white text-xs font-bold">
              🌊
            </div>
            <div class="mt-0.5 bg-white border border-slate-300 text-[9px] font-mono font-bold px-1 rounded text-cyan-800 whitespace-nowrap shadow-sm">
              ${stn.current_level_m_msl?.toFixed(2) || "0.80"}m
            </div>
          </div>
        `;

        const featurePayload: SelectedFeature = {
          type: "WATER_STATION",
          title: stn.name,
          source: "BMA Department of Drainage & Sewerage (DDS)",
          timestamp: stn.last_observed_at || new Date().toISOString(),
          status: stn.trend || "MONITORING",
          confidence: "HIGH",
          measurements: {
            "Water Stage": `${stn.current_level_m_msl?.toFixed(2) || "0.80"} m MSL`,
            "Critical Threshold": `${stn.critical_threshold_meters?.toFixed(2) || "1.20"} m MSL`,
            "Warning Threshold": `${stn.warning_threshold_meters?.toFixed(2) || "1.00"} m MSL`,
            "Trend": stn.trend || "STABLE"
          },
          provenance: {
            mode: "PENDING_ACCESS",
            attribution: "BMA DDS Open Data Feed",
            notes: "Canal telemetric sensor station in Eastern Bangkok canal network."
          },
          raw: stn
        };

        const popupHTML = `
          <div class="p-3 max-w-xs font-sans text-slate-800 dark:text-slate-200">
            <div class="text-xs text-cyan-700 dark:text-cyan-400 font-bold mb-1">🌊 CANAL GAUGE (BMA DDS)</div>
            <div class="font-bold text-sm text-slate-900 dark:text-white mb-1">${stn.name}</div>
            <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div><b>ระดับน้ำ:</b> ${stn.current_level_m_msl?.toFixed(2)} ม.รทก.</div>
              <div><b>แนวโน้ม:</b> <span class="text-amber-700 font-bold">${stn.trend || "RISING"}</span></div>
              <div><b>เกณฑ์วิกฤต:</b> ${stn.critical_threshold_meters?.toFixed(2) || "1.20"} ม.รทก.</div>
              <div class="text-[10px] text-slate-400 mt-1">อัปเดตเมื่อ ${stn.data_age_min || 4} นาทีที่แล้ว</div>
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(popupHTML);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([stn.longitude, stn.latitude])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("click", () => {
          if (onSelectFeature) onSelectFeature(featurePayload);
        });

        markersRef.current.push(marker);
      });
    }

    // 3. Shelters & Emergency Points Layer
    if (layers.shelters && shelters) {
      shelters.forEach((sh) => {
        const el = document.createElement("div");
        el.className = "cursor-pointer select-none";
        el.innerHTML = `
          <div class="flex flex-col items-center">
            <div class="w-7 h-7 rounded-full bg-emerald-700 border-2 border-white shadow-md flex items-center justify-center text-white text-xs">
              🏥
            </div>
            <div class="mt-0.5 bg-white border border-slate-300 text-[9px] font-mono font-bold px-1 rounded text-emerald-800 whitespace-nowrap shadow-sm">
              ${sh.name.substring(0, 16)}...
            </div>
          </div>
        `;

        const featurePayload: SelectedFeature = {
          type: "SHELTER",
          title: sh.name,
          source: "KMITL Emergency Operations & Disaster Relief",
          timestamp: sh.last_verified_at || new Date().toISOString(),
          status: sh.is_verified ? "VERIFIED_OPERATIONAL" : "OCCUPANCY_NOT_VERIFIED",
          confidence: sh.is_verified ? "HIGH" : "MEDIUM",
          measurements: {
            "Facility Type": sh.point_type,
            "Occupancy Status": sh.capacity ? `${sh.current_occupancy} / ${sh.capacity} persons (Manual EOC Log)` : "OCCUPANCY NOT VERIFIED",
            "Emergency Phone": sh.contact_number || "02-329-8000",
            "Operating Hours": sh.operating_hours || "24 Hours"
          },
          provenance: {
            mode: "LIVE",
            attribution: "KMITL EOC & Civil Protection Directory",
            notes: "Designated civil protection shelter and aid relief station."
          },
          raw: sh
        };

        const popupHTML = `
          <div class="p-3 max-w-xs font-sans text-slate-800 dark:text-slate-200">
            <div class="text-xs text-emerald-700 dark:text-emerald-400 font-bold mb-1">🏥 EMERGENCY SHELTER / AID</div>
            <div class="font-bold text-sm text-slate-900 dark:text-white mb-1">${sh.name}</div>
            <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div><b>ประเภท:</b> ${sh.point_type}</div>
              <div><b>สถานะความจุ:</b> ${sh.capacity ? `${sh.current_occupancy}/${sh.capacity} (OCCUPANCY NOT VERIFIED VIA SENSORS)` : "ไม่ระบุ"}</div>
              <div><b>ติดต่อ:</b> ${sh.contact_number || "02-329-8000"}</div>
              <div><b>เวลา:</b> ${sh.operating_hours || "24 ชั่วโมง"}</div>
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(popupHTML);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([sh.longitude, sh.latitude])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("click", () => {
          if (onSelectFeature) onSelectFeature(featurePayload);
        });

        markersRef.current.push(marker);
      });
    }

    // 4. Citizen Reports Layer
    if (layers.reports && reports) {
      reports.forEach((rep) => {
        const el = document.createElement("div");
        el.className = "cursor-pointer group select-none";
        const depthBg = rep.water_depth_band?.includes("ABOVE_60") || rep.water_depth_band?.includes("40_TO_60")
          ? "bg-red-600"
          : rep.water_depth_band?.includes("20_TO_40")
          ? "bg-amber-600"
          : "bg-blue-600";

        el.innerHTML = `
          <div class="relative flex flex-col items-center">
            <div class="w-6 h-6 rounded-full ${depthBg} border-2 border-white shadow-md flex items-center justify-center text-white text-[11px] font-bold">
              💧
            </div>
            <div class="mt-0.5 bg-white border border-slate-300 text-[9px] font-mono font-bold px-1 rounded text-slate-800 whitespace-nowrap shadow-sm">
              ${rep.water_depth_band?.replace("DEPTH_", "").replace(/_/g, " ") || "น้ำท่วม"}
            </div>
          </div>
        `;

        const featurePayload: SelectedFeature = {
          type: "CITIZEN_REPORT",
          title: rep.description || "Citizen Flood Report",
          source: "CITIZEN REPORT (Unverified individual observation)",
          timestamp: rep.observed_at,
          status: rep.verification_status || "PENDING_CLUSTER_CORROBORATION",
          confidence: rep.confidence,
          measurements: {
            "Reported Depth": rep.water_depth_band?.replace("DEPTH_", "").replace(/_/g, " ") || "Unknown",
            "Passability": rep.vehicle_passability || "Unknown",
            "Transport Type": rep.transport_type || "Unknown",
            "Observed Age": `${rep.data_age_min || 0} min ago`
          },
          provenance: {
            mode: "LIVE",
            attribution: "Crowdsourced Field Observation",
            notes: "Raw citizen report. Clustered with nearby reports by DBSCAN algorithm."
          },
          raw: rep
        };

        const popupHTML = `
          <div class="p-3 max-w-xs font-sans text-slate-800 dark:text-slate-200">
            <div class="text-xs text-blue-700 dark:text-blue-400 font-bold mb-1">📢 CITIZEN REPORT</div>
            <div class="font-bold text-sm text-slate-900 dark:text-white mb-1">${rep.description || "รายงานน้ำท่วมขัง"}</div>
            <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div><b>ระดับน้ำ:</b> ${rep.water_depth_band?.replace("DEPTH_", "").replace(/_/g, " ") || "-"}</div>
              <div><b>การสัญจร:</b> ${rep.vehicle_passability || "-"}</div>
              <div><b>พาหนะ:</b> ${rep.transport_type || "-"}</div>
              <div class="text-[10px] text-slate-400 mt-1">เวลา: ${new Date(rep.observed_at).toLocaleTimeString()}</div>
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(popupHTML);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([rep.longitude, rep.latitude])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("click", () => {
          if (onSelectFeature) onSelectFeature(featurePayload);
        });

        markersRef.current.push(marker);
      });
    }
  }, [isMapLoaded, incidents, reports, waterStations, shelters, layers, onSelectIncident, onSelectFeature]);

  if (!webGlSupported) {
    return (
      <div className={`relative w-full h-full min-h-[450px] flex flex-col items-center justify-center bg-slate-50 p-6 text-center ${className || ""}`}>
        <div className="max-w-md bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <div className="text-3xl mb-3">🗺️</div>
          <h3 className="text-base font-bold text-slate-900 mb-2">แผนที่สถานการณ์น้ำท่วม (WebGL Fallback Mode)</h3>
          <p className="text-xs text-slate-600 mb-4">
            เบราว์เซอร์ไม่สามารถแสดงผลการเร่งความเร็วกราฟิก 3D แผนที่ได้ ระบบจึงแสดงรายการเหตุการณ์สำคัญแบบย่อด้านล่าง:
          </p>
          <div className="text-left space-y-2 max-h-60 overflow-y-auto pr-1">
            {incidents.map((inc) => (
              <div key={inc.id} className="p-2.5 rounded-lg bg-orange-50 border border-orange-200 text-xs text-slate-800">
                <div className="font-bold text-orange-800">⚠️ #{inc.incident_number}: {inc.title}</div>
                <div className="text-slate-600 text-[11px] mt-1">ระดับน้ำ: {inc.consensus_depth_band} | การสัญจร: {inc.consensus_passability}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden ${className || ""}`}>
      <div
        ref={mapContainer}
        className="absolute inset-0 w-full h-full"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Floating My Location Button (Requirement 6) */}
      {onRequestCurrentLocation && (
        <div className="absolute top-28 right-2.5 z-10">
          <button
            type="button"
            onClick={onRequestCurrentLocation}
            disabled={gpsLoading}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="My Location — Center map on current GPS location (ตำแหน่งปัจจุบันของฉัน)"
            aria-label="My Location"
          >
            {gpsLoading ? (
              <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="7" />
                <line x1="12" y1="1" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="1" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="23" y2="12" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
