"use client";

import React, { useState } from "react";
import {
  MapPin,
  Home,
  Crosshair,
  Navigation,
  Compass,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  X,
  AlertCircle,
  Building,
  Target
} from "lucide-react";
import clsx from "clsx";
import { LocationTarget } from "../../lib/types";

interface LocationContextBarProps {
  currentLocation: LocationTarget | null;
  selectedMonitoringLocation: LocationTarget;
  homeLocation: LocationTarget | null;
  savedLocations: LocationTarget[];
  distanceToTargetKm: number | null;
  gpsLoading: boolean;
  gpsError: string | null;
  onRequestCurrentLocation: () => void;
  onFlyToCurrentLocation?: () => void;
  onSelectMonitoringLocation: (loc: LocationTarget) => void;
  onSetHomeLocation: (loc: LocationTarget) => void;
  onAddWatchLocation: (name: string, lat: number, lng: number, desc?: string) => void;
  onRemoveWatchLocation: (id: string) => void;
  className?: string;
}

export const LocationContextBar: React.FC<LocationContextBarProps> = ({
  currentLocation,
  selectedMonitoringLocation,
  homeLocation,
  savedLocations,
  distanceToTargetKm,
  gpsLoading,
  gpsError,
  onRequestCurrentLocation,
  onFlyToCurrentLocation,
  onSelectMonitoringLocation,
  onSetHomeLocation,
  onAddWatchLocation,
  onRemoveWatchLocation,
  className
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocLat, setNewLocLat] = useState("");
  const [newLocLng, setNewLocLng] = useState("");
  const [newLocDesc, setNewLocDesc] = useState("");
  const [addMode, setAddMode] = useState(false);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(newLocLat);
    const lng = parseFloat(newLocLng);
    if (!newLocName.trim() || isNaN(lat) || isNaN(lng)) return;

    onAddWatchLocation(newLocName.trim(), lat, lng, newLocDesc.trim() || undefined);
    setNewLocName("");
    setNewLocLat("");
    setNewLocLng("");
    setNewLocDesc("");
    setAddMode(false);
  };

  return (
    <>
      <div
        className={clsx(
          "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-2.5 sm:p-3 transition-all",
          className
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* LEFT: WHERE AM I? (CURRENT DEVICE POSITION) */}
          <div className="flex items-center gap-2.5 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 pb-2 md:pb-0 md:pr-4 shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 shrink-0">
              <Crosshair className={clsx("w-4 h-4", gpsLoading && "animate-spin")} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Where Am I? (ตำแหน่งอุปกรณ์)
                </span>
                {currentLocation ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {currentLocation ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onFlyToCurrentLocation}
                      title="Fly map to your actual device location"
                      className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                      <span>{currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}</span>
                      {currentLocation.accuracy !== undefined && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                          (±{currentLocation.accuracy}m)
                        </span>
                      )}
                    </button>
                    {onFlyToCurrentLocation && (
                      <button
                        type="button"
                        onClick={onFlyToCurrentLocation}
                        className="text-[11px] font-sans font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                        title="Center map on your location"
                      >
                        <Navigation className="w-3 h-3 rotate-45" />
                        <span>Center</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onRequestCurrentLocation}
                    disabled={gpsLoading}
                    className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{gpsLoading ? "Detecting GPS..." : "📍 Detect Device Location"}</span>
                  </button>
                )}
                {gpsError && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono" title={gpsError}>
                    (Location unavailable)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* CENTER: WHERE DO I CARE ABOUT? (MONITORED TARGET CONTEXT) */}
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 shrink-0">
                {selectedMonitoringLocation.isHome ? (
                  <Home className="w-4 h-4" />
                ) : (
                  <Target className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Monitoring (พื้นที่เฝ้าระวัง)
                  </span>
                  {selectedMonitoringLocation.isHome && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      ⌂ HOME
                    </span>
                  )}
                  {distanceToTargetKm !== null && (
                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                      · {distanceToTargetKm} km from device
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono flex items-center gap-1.5 mt-0.5">
                  <span className="truncate max-w-[200px] sm:max-w-[280px]">
                    {selectedMonitoringLocation.name}
                  </span>
                </div>
              </div>
            </div>

            {/* QUICK PRESET PILLS & SWITCHER BUTTON */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {homeLocation && (
                <button
                  type="button"
                  onClick={() => onSelectMonitoringLocation(homeLocation)}
                  className={clsx(
                    "px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all flex items-center gap-1 whitespace-nowrap border",
                    selectedMonitoringLocation.id === homeLocation.id
                      ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400"
                  )}
                >
                  <Home className="w-3 h-3" />
                  <span>Home</span>
                </button>
              )}

              {/* KMITL Campus Pill */}
              {savedLocations
                .filter((loc) => !loc.isHome)
                .slice(0, 3)
                .map((loc) => {
                  const isSelected = selectedMonitoringLocation.id === loc.id;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => onSelectMonitoringLocation(loc)}
                      className={clsx(
                        "px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all whitespace-nowrap border",
                        isSelected
                          ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                      )}
                    >
                      {loc.name.split(" ")[0]}
                    </button>
                  );
                })}

              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="px-2 py-1 rounded-lg text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <span>Change / Add</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LOCATION CONTEXT MODAL (Section 5, 6, 11) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            {/* MODAL HEADER */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                  Location Context Management
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Separating Device Location from Flood Monitoring Target
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setAddMode(false);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL CONTENT */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* CURRENT DEVICE CONTEXT SUMMARY */}
              <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-3.5 flex items-start gap-3">
                <Crosshair className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-bold font-mono text-blue-900 dark:text-blue-200">
                    WHERE AM I? (Device Position)
                  </div>
                  <div className="text-xs text-blue-800/80 dark:text-blue-300 font-mono mt-0.5">
                    {currentLocation ? (
                      <span>
                        Latitude {currentLocation.lat.toFixed(4)}, Longitude {currentLocation.lng.toFixed(4)}{" "}
                        (GPS Active)
                      </span>
                    ) : (
                      <span>Not detected yet or permission not requested.</span>
                    )}
                  </div>
                  {!currentLocation && (
                    <button
                      type="button"
                      onClick={onRequestCurrentLocation}
                      disabled={gpsLoading}
                      className="mt-2 px-3 py-1 rounded-xl text-xs font-mono font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors inline-flex items-center gap-1.5"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>{gpsLoading ? "Detecting..." : "Detect Current GPS"}</span>
                    </button>
                  )}
                  {currentLocation && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectMonitoringLocation(currentLocation);
                        setModalOpen(false);
                      }}
                      className="mt-2 text-xs font-mono text-blue-600 dark:text-blue-400 underline hover:text-blue-800"
                    >
                      Monitor my current location instead
                    </button>
                  )}
                </div>
              </div>

              {/* SAVED & WATCH LOCATIONS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                    Monitored Places (พื้นที่เฝ้าระวังที่บันทึกไว้)
                  </span>
                  <button
                    type="button"
                    onClick={() => setAddMode(!addMode)}
                    className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{addMode ? "Cancel" : "Add Place"}</span>
                  </button>
                </div>

                {/* ADD LOCATION FORM */}
                {addMode && (
                  <form
                    onSubmit={handleAddSubmit}
                    className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 space-y-2.5"
                  >
                    <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                      Add Custom Watch Location
                    </div>
                    <input
                      type="text"
                      placeholder="Location Name (e.g. My Dorm, Office, Family Home)"
                      value={newLocName}
                      onChange={(e) => setNewLocName(e.target.value)}
                      required
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="any"
                        placeholder="Latitude (e.g. 13.7298)"
                        value={newLocLat}
                        onChange={(e) => setNewLocLat(e.target.value)}
                        required
                        className="text-xs font-mono px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="Longitude (e.g. 100.7782)"
                        value={newLocLng}
                        onChange={(e) => setNewLocLng(e.target.value)}
                        required
                        className="text-xs font-mono px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Notes / Description (Optional)"
                      value={newLocDesc}
                      onChange={(e) => setNewLocDesc(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex items-center justify-between pt-1">
                      {currentLocation && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewLocLat(currentLocation.lat.toFixed(5));
                            setNewLocLng(currentLocation.lng.toFixed(5));
                            if (!newLocName) setNewLocName("Device GPS Location");
                          }}
                          className="text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Use GPS Coordinates
                        </button>
                      )}
                      <button
                        type="submit"
                        className="ml-auto px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-mono font-bold shadow-sm"
                      >
                        Save Place
                      </button>
                    </div>
                  </form>
                )}

                {/* LIST OF SAVED PLACES */}
                <div className="space-y-1.5">
                  {savedLocations.map((loc) => {
                    const isSelected = selectedMonitoringLocation.id === loc.id;
                    const isHome = homeLocation?.id === loc.id || loc.isHome;

                    return (
                      <div
                        key={loc.id}
                        className={clsx(
                          "flex items-center justify-between p-3 rounded-2xl border transition-all select-none",
                          isSelected
                            ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80 shadow-sm"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                        )}
                      >
                        <div
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => {
                            onSelectMonitoringLocation(loc);
                            setModalOpen(false);
                          }}
                        >
                          <div
                            className={clsx(
                              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
                              isHome
                                ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            )}
                          >
                            {isHome ? <Home className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                                {loc.name}
                              </span>
                              {isHome && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300">
                                  HOME
                                </span>
                              )}
                              {isSelected && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-300">
                                  CURRENT TARGET
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                              {loc.description || `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`}
                            </div>
                          </div>
                        </div>

                        {/* ACTION BUTTONS */}
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {!isHome && (
                            <button
                              type="button"
                              onClick={() => onSetHomeLocation(loc)}
                              title="Set as Home"
                              className="px-2 py-1 rounded-lg text-[10px] font-mono text-slate-600 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200 dark:border-slate-700 transition-colors"
                            >
                              Set Home
                            </button>
                          )}
                          {!isSelected && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectMonitoringLocation(loc);
                                setModalOpen(false);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
                            >
                              Monitor
                            </button>
                          )}
                          {/* Allow removing custom watch locations (keep presets safe) */}
                          {loc.id.startsWith("LOC_") && !loc.id.startsWith("LOC_KMITL") && !loc.id.startsWith("LOC_CHALONG") && !loc.id.startsWith("LOC_ECC") && !loc.id.startsWith("LOC_HUA") && !loc.id.startsWith("LOC_ARL") && (
                            <button
                              type="button"
                              onClick={() => onRemoveWatchLocation(loc.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                              title="Remove location"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>Preferences saved automatically in browser.</span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-bold text-slate-800 dark:text-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
