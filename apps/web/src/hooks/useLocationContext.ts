"use client";

import { useState, useEffect, useCallback } from "react";
import { LocationTarget, UserLocationState } from "../lib/types";

export const DEFAULT_WATCH_LOCATIONS: LocationTarget[] = [
  {
    id: "LOC_KMITL_MAIN",
    name: "KMITL Campus (Main Gate)",
    type: "WATCH_LOCATION",
    lat: 13.7298,
    lng: 100.7782,
    zoom: 16,
    description: "Faculty of Engineering & Chalong Krung Gate"
  },
  {
    id: "LOC_CHALONG_KRUNG",
    name: "Chalong Krung Gate 1",
    type: "WATCH_LOCATION",
    lat: 13.7314,
    lng: 100.7812,
    zoom: 16,
    description: "North Entrance & Dormitory Zone"
  },
  {
    id: "LOC_ECC",
    name: "ECC Building & Central Library",
    type: "WATCH_LOCATION",
    lat: 13.7278,
    lng: 100.7749,
    zoom: 16,
    description: "Computer Center & Inner Campus Loop"
  },
  {
    id: "LOC_HUA_TAKHE",
    name: "Hua Takhe Community & Market",
    type: "WATCH_LOCATION",
    lat: 13.7215,
    lng: 100.7895,
    zoom: 15,
    description: "Canal Waterfront & Prawet Burirom Outfall"
  },
  {
    id: "LOC_ARL",
    name: "ARL Lat Krabang Station",
    type: "WATCH_LOCATION",
    lat: 13.7275,
    lng: 100.7483,
    zoom: 15,
    description: "Airport Rail Link & Highway 7 Interchange"
  }
];

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function useLocationContext() {
  const [currentLocation, setCurrentLocation] = useState<LocationTarget | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [homeLocation, setHomeLocationState] = useState<LocationTarget | null>(null);
  const [savedLocations, setSavedLocations] = useState<LocationTarget[]>(DEFAULT_WATCH_LOCATIONS);
  const [selectedMonitoringLocation, setSelectedMonitoringLocationState] = useState<LocationTarget>(
    DEFAULT_WATCH_LOCATIONS[0]
  );
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from LocalStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedHome = localStorage.getItem("kmitl_home_location");
      const storedSaved = localStorage.getItem("kmitl_saved_locations");
      const storedMonitoring = localStorage.getItem("kmitl_monitoring_location");

      let resolvedHome: LocationTarget | null = null;
      if (storedHome) {
        resolvedHome = JSON.parse(storedHome);
        setHomeLocationState(resolvedHome);
      }

      let resolvedSaved = DEFAULT_WATCH_LOCATIONS;
      if (storedSaved) {
        const parsed = JSON.parse(storedSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          resolvedSaved = parsed;
          setSavedLocations(parsed);
        }
      }

      if (storedMonitoring) {
        setSelectedMonitoringLocationState(JSON.parse(storedMonitoring));
      } else if (resolvedHome) {
        // If user has a saved Home, default monitoring to Home (Section 14)
        setSelectedMonitoringLocationState(resolvedHome);
      } else {
        setSelectedMonitoringLocationState(resolvedSaved[0]);
      }
    } catch (e) {
      console.error("Failed to load saved location context:", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Set Monitoring Location explicitly
  const setMonitoringLocation = useCallback((loc: LocationTarget) => {
    setSelectedMonitoringLocationState(loc);
    try {
      localStorage.setItem("kmitl_monitoring_location", JSON.stringify(loc));
    } catch {}
  }, []);

  // Set Home Location explicitly
  const setHomeLocation = useCallback((loc: LocationTarget) => {
    const updatedHome: LocationTarget = {
      ...loc,
      type: "HOME_LOCATION",
      isHome: true
    };
    setHomeLocationState(updatedHome);
    try {
      localStorage.setItem("kmitl_home_location", JSON.stringify(updatedHome));
    } catch {}

    // Also update saved locations list to reflect Home
    setSavedLocations((prev) => {
      const filtered = prev.filter((p) => p.id !== updatedHome.id && !p.isHome);
      const nextList = [updatedHome, ...filtered];
      try {
        localStorage.setItem("kmitl_saved_locations", JSON.stringify(nextList));
      } catch {}
      return nextList;
    });
  }, []);

  // Add Watch Location
  const addWatchLocation = useCallback((name: string, lat: number, lng: number, description?: string) => {
    const newLoc: LocationTarget = {
      id: `LOC_${Date.now()}`,
      name,
      type: "WATCH_LOCATION",
      lat,
      lng,
      zoom: 16,
      description
    };
    setSavedLocations((prev) => {
      const nextList = [...prev, newLoc];
      try {
        localStorage.setItem("kmitl_saved_locations", JSON.stringify(nextList));
      } catch {}
      return nextList;
    });
    return newLoc;
  }, []);

  // Remove Watch Location
  const removeWatchLocation = useCallback((id: string) => {
    setSavedLocations((prev) => {
      const nextList = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem("kmitl_saved_locations", JSON.stringify(nextList));
      } catch {}
      return nextList;
    });
  }, []);

  const [permissionStatus, setPermissionStatus] = useState<"PROMPT" | "GRANTED" | "DENIED" | "UNAVAILABLE">("PROMPT");

  // Query initial permission status if supported
  useEffect(() => {
    if (typeof window === "undefined" || !("permissions" in navigator)) return;
    navigator.permissions.query({ name: "geolocation" as any }).then((status) => {
      if (status.state === "granted") setPermissionStatus("GRANTED");
      else if (status.state === "denied") setPermissionStatus("DENIED");
      else setPermissionStatus("PROMPT");

      status.onchange = () => {
        if (status.state === "granted") setPermissionStatus("GRANTED");
        else if (status.state === "denied") setPermissionStatus("DENIED");
        else setPermissionStatus("PROMPT");
      };
    }).catch(() => {
      setPermissionStatus("PROMPT");
    });
  }, []);

  // Explicit Request for Device GPS Location (Section 1, 6, 7 & 8)
  const requestCurrentLocation = useCallback((onSuccess?: (loc: LocationTarget) => void) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsError("Geolocation is not supported by your browser.");
      setPermissionStatus("UNAVAILABLE");
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const currentLoc: LocationTarget = {
          id: "LOC_CURRENT_GPS",
          name: "My Device Location",
          type: "CURRENT_LOCATION",
          lat: latitude,
          lng: longitude,
          zoom: 16,
          accuracy: Math.round(accuracy),
          timestamp: pos.timestamp,
          description: `Device GPS (Accuracy: ±${Math.round(accuracy)}m)`
        };
        console.log(`CURRENT GPS: lat=${latitude} lng=${longitude} accuracy=${accuracy}`);
        setCurrentLocation(currentLoc);
        setPermissionStatus("GRANTED");
        setGpsLoading(false);
        if (typeof onSuccess === "function") {
          onSuccess(currentLoc);
        }
      },
      (err) => {
        let msg = "Could not obtain device location.";
        if (err.code === 1) {
          msg = "Location permission was denied.";
          setPermissionStatus("DENIED");
        } else if (err.code === 2) {
          msg = "Position unavailable.";
          setPermissionStatus("UNAVAILABLE");
        } else if (err.code === 3) {
          msg = "Location request timed out.";
        }
        setGpsError(msg);
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }, []);

  // Calculate distance between current physical location and monitored target
  const distanceToTargetKm =
    currentLocation && selectedMonitoringLocation
      ? calculateDistanceKm(
          currentLocation.lat,
          currentLocation.lng,
          selectedMonitoringLocation.lat,
          selectedMonitoringLocation.lng
        )
      : null;

  const locationState: UserLocationState = {
    current_location: currentLocation,
    selected_monitoring_location: selectedMonitoringLocation,
    home_location: homeLocation,
    saved_locations: savedLocations,
    route_origin: currentLocation || selectedMonitoringLocation,
    route_destination: homeLocation || selectedMonitoringLocation
  };

  return {
    isInitialized,
    currentLocation,
    permissionStatus,
    gpsLoading,
    gpsError,
    homeLocation,
    savedLocations,
    selectedMonitoringLocation,
    distanceToTargetKm,
    locationState,
    requestCurrentLocation,
    setMonitoringLocation,
    setHomeLocation,
    addWatchLocation,
    removeWatchLocation
  };
}
