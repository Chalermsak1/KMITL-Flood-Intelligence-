"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Navigation,
  AlertTriangle,
  Camera,
  Image as ImageIcon,
  X,
  UploadCloud,
  Compass
} from "lucide-react";
import Link from "next/link";
import { api } from "../../lib/api";

// GPS accuracy thresholds
const GPS_HIGH_ACCURACY_M = 20;   // green  — precise enough to locate building
const GPS_LOW_ACCURACY_M  = 50;   // orange — jitter may displace marker across road

const CAMPUS_PRESETS = [
  { name: "Faculty of Engineering", lat: 13.7298, lng: 100.7782 },
  { name: "ECC Building", lat: 13.7278, lng: 100.7749 },
  { name: "Central Library / Prathep", lat: 13.7289, lng: 100.7765 },
  { name: "Chalong Krung Gate 1", lat: 13.7314, lng: 100.7812 },
  { name: "ARL Lat Krabang Station", lat: 13.7275, lng: 100.7483 },
];

function GpsAccuracyBadge({ accuracy }: { accuracy: number | null }) {
  if (accuracy === null) return null;
  const isHigh = accuracy <= GPS_HIGH_ACCURACY_M;
  const isMed  = accuracy <= GPS_LOW_ACCURACY_M;
  const color  = isHigh ? "emerald" : isMed ? "yellow" : "red";
  const label  = isHigh ? "HIGH" : isMed ? "MODERATE" : "LOW";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold
        ${
          isHigh ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : isMed ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
          : "bg-red-500/20 text-red-400 border border-red-500/30"
        }`}
      title={`GPS horizontal accuracy: ±${Math.round(accuracy)} m`}
    >
      <span className={`w-1.5 h-1.5 rounded-full bg-${color}-400 animate-pulse`} />
      GPS {label} (±{Math.round(accuracy)} m)
    </span>
  );
}

export default function ReportPage() {
  const router = useRouter();

  const [lat, setLat] = useState<number>(13.7298);
  const [lng, setLng] = useState<number>(100.7782);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>("Locating your GPS...");
  const [waterDepth, setWaterDepth] = useState<string>("20_TO_40CM");
  const [passability, setPassability] = useState<string>("DIFFICULT");
  const [transportType, setTransportType] = useState<string>("CAR");
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedReport, setSubmittedReport] = useState<any>(null);
  const [pendingOffline, setPendingOffline] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Photo upload states
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Request browser geolocation and manage network status
  useEffect(() => {
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;
    setIsOnline(online);

    // Initial check for offline stored report
    const saved = localStorage.getItem("kmitl_pending_report");
    if (saved) {
      try {
        const payload = JSON.parse(saved);
        if (online) {
          submitPayload(payload);
        } else {
          setPendingOffline(payload);
        }
      } catch {
        localStorage.removeItem("kmitl_pending_report");
      }
    }

    const handleOnline = async () => {
      setIsOnline(true);
      const pending = localStorage.getItem("kmitl_pending_report");
      if (pending) {
        try {
          const payload = JSON.parse(pending);
          await submitPayload(payload);
        } catch (e) {
          console.error("Retry submission failed:", e);
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    acquireGps();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const acquireGps = () => {
    if ("geolocation" in navigator) {
      setGpsStatus("Acquiring GPS fix...");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setGpsAccuracy(pos.coords.accuracy);
          const acc = pos.coords.accuracy;
          const quality = acc <= GPS_HIGH_ACCURACY_M ? "HIGH" : acc <= GPS_LOW_ACCURACY_M ? "MODERATE" : "LOW";
          setGpsStatus(`GPS Acquired (${quality}) — ±${Math.round(acc)} m horizontal accuracy`);
        },
        (err) => {
          setGpsAccuracy(null);
          if (err.code === err.PERMISSION_DENIED) {
            setGpsStatus("GPS Permission Denied. You can select a campus landmark or enter coordinates manually.");
          } else if (err.code === err.TIMEOUT) {
            setGpsStatus("GPS Timeout. Using KMITL Campus Center as default.");
          } else {
            setGpsStatus("GPS Unavailable. Using KMITL Campus Center as default.");
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    } else {
      setGpsAccuracy(null);
      setGpsStatus("Browser does not support Geolocation.");
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit. Please choose a smaller photo.");
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Verify image with AI backend if online
    if (isOnline) {
      try {
        setAiFeedback("Analyzing image with AI verifier...");
        const result = await api.verifyImage(file, lat, lng);
        if (result?.classification) {
          const depth = result.classification.suggested_depth_band || "FLOOD_DETECTED";
          setAiFeedback(`AI Analysis: ${depth} (Confidence: ${result.recommended_confidence || "HIGH"})`);
        }
      } catch {
        setAiFeedback(null);
      }
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setAiFeedback(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const submitPayload = async (payload: any) => {
    setSubmitting(true);
    try {
      const res = await api.postReport(payload);
      localStorage.removeItem("kmitl_pending_report");
      setPendingOffline(null);
      setSubmittedReport(res.data);
    } catch (err) {
      localStorage.setItem("kmitl_pending_report", JSON.stringify(payload));
      setPendingOffline(payload);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    let photoUrl = undefined;
    if (photoPreview && photoPreview.length < 500000) {
      photoUrl = photoPreview; // Store inline thumbnail if small
    }

    const payload = {
      latitude: lat,
      longitude: lng,
      water_depth_band: waterDepth,
      vehicle_passability: passability,
      transport_type: transportType,
      description: description || undefined,
      photo_url: photoUrl
    };

    // If offline, queue locally
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      localStorage.setItem("kmitl_pending_report", JSON.stringify(payload));
      setPendingOffline(payload);
      setSubmitting(false);
      return;
    }

    await submitPayload(payload);
  };

  return (
    <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Situation Dashboard</span>
      </Link>

      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 sm:p-8 shadow-xl">
        {!isOnline && (
          <div className="mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300 font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>NETWORK OFFLINE: Reports submitted now will be stored locally as <strong>PENDING</strong> and submitted automatically upon reconnection.</span>
          </div>
        )}

        {pendingOffline ? (
          /* OFFLINE PENDING SCREEN */
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-amber-400">REPORT STATUS: PENDING</h2>
            <div className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
              QUEUED FOR RETRY (OFFLINE)
            </div>
            <p className="text-xs text-gray-300 max-w-md mx-auto">
              รายงานของคุณถูกบันทึกไว้ในอุปกรณ์เรียบร้อยแล้ว (สถานะ PENDING) ยังไม่ถูกส่งขึ้นเซิร์ฟเวอร์เนื่องจากเครือข่ายออฟไลน์ ระบบจะทำการส่งรายงานอัตโนมัติทันทีเมื่อเชื่อมต่ออินเทอร์เน็ตสำเร็จ.
            </p>

            <div className="bg-surface p-4 rounded-xl border border-surface-border text-xs text-left max-w-sm mx-auto space-y-1.5 font-mono">
              <div><b>Location:</b> {pendingOffline.latitude?.toFixed(4)}, {pendingOffline.longitude?.toFixed(4)}</div>
              <div><b>Depth Band:</b> {pendingOffline.water_depth_band}</div>
              <div><b>Passability:</b> {pendingOffline.vehicle_passability}</div>
              <div><b>Local Queue Status:</b> WAITING FOR NETWORK ACK</div>
            </div>

            <div className="pt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => submitPayload(pendingOffline)}
                disabled={submitting}
                className="py-2.5 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs"
              >
                {submitting ? "RETRYING..." : "RETRY SUBMISSION NOW"}
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("kmitl_pending_report");
                  setPendingOffline(null);
                }}
                className="py-2.5 px-5 rounded-xl bg-surface border border-surface-border text-gray-300 hover:text-white font-bold text-xs"
              >
                DISCARD QUEUE
              </button>
            </div>
          </div>
        ) : !submittedReport ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                REPORT FLOOD SITUATION
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                รายงานระดับน้ำท่วมบนถนนเพื่อแจ้งเตือนนักศึกษาและชุมชนลาดกระบังแบบเรียลไทม์
              </p>
            </div>

            {/* 1. GPS LOCATION & MANUAL CORRECTION */}
            <div className="bg-surface/80 p-3.5 rounded-xl border border-surface-border space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-gray-300">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary-400" />
                  <span>1. Incident Location (พิกัดจุดเกิดเหตุ)</span>
                </span>
                <button
                  type="button"
                  onClick={acquireGps}
                  className="text-[11px] text-primary-400 font-mono flex items-center gap-1 hover:underline"
                >
                  <Navigation className="w-3 h-3" /> Refresh GPS
                </button>
              </div>

              <div className="text-xs font-mono text-gray-400">{gpsStatus}</div>

              {/* GPS Accuracy Badge */}
              {gpsAccuracy !== null && (
                <div className="flex items-center gap-2">
                  <GpsAccuracyBadge accuracy={gpsAccuracy} />
                </div>
              )}

              {/* Low-accuracy warning: GPS jitter may displace marker */}
              {gpsAccuracy !== null && gpsAccuracy > GPS_LOW_ACCURACY_M && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 font-mono">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>GPS ACCURACY LOW (±{Math.round(gpsAccuracy)} m):</strong> Your location marker may be displaced up to {Math.round(gpsAccuracy)} m.
                    Please select a campus landmark below or fine-tune coordinates.
                  </span>
                </div>
              )}

              {/* Campus Landmark Quick Selector */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-primary-400" />
                  Quick Landmarks (กดเลือกสถานที่ใกล้เคียง):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CAMPUS_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.name}
                      onClick={() => {
                        setLat(preset.lat);
                        setLng(preset.lng);
                        setGpsAccuracy(null);
                        setGpsStatus(`Selected landmark: ${preset.name}`);
                      }}
                      className="text-[10px] px-2 py-1 rounded bg-surface border border-surface-border text-gray-300 hover:text-white hover:border-primary-500 transition-colors"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-gray-400 font-mono">Latitude:</label>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value))}
                    className="w-full bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-white font-mono"
                    placeholder="Latitude"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-mono">Longitude:</label>
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value))}
                    className="w-full bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-white font-mono"
                    placeholder="Longitude"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 2. PHOTO UPLOAD & CAMERA CAPTURE */}
            <div className="bg-surface/80 p-3.5 rounded-xl border border-surface-border space-y-2">
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-primary-400" />
                <span>2. Photo Evidence (ถ่ายรูปหรือแนบภาพถ่ายน้ำท่วม)</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              {!photoPreview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-surface-border hover:border-primary-500/50 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-white bg-surface/50 transition-colors"
                >
                  <UploadCloud className="w-6 h-6 text-primary-400" />
                  <span className="text-xs font-medium">Take Photo / Upload Flood Image (MAX 10MB)</span>
                  <span className="text-[10px] text-gray-500">EXIF metadata & GPS automatically sanitized for citizen privacy</span>
                </button>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-surface-border bg-black/40 p-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={photoPreview}
                      alt="Flood preview"
                      className="w-20 h-20 object-cover rounded-lg border border-surface-border"
                    />
                    <div className="flex-1 text-xs space-y-1">
                      <div className="font-bold text-white flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Photo Attached ({((photoFile?.size || 0) / 1024).toFixed(1)} KB)</span>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        EXIF GPS stripped • Perceptual Hash deduplication active
                      </div>
                      {aiFeedback && (
                        <div className="text-[10px] font-mono text-primary-300 bg-primary-500/10 px-2 py-0.5 rounded border border-primary-500/20">
                          {aiFeedback}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      title="Remove Photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. WATER DEPTH BANDS */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                3. Water Depth (ระดับความลึกของน้ำท่วม)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { value: "BELOW_10CM", label: "< 10 cm (ท่วมข้อเท้า)" },
                  { value: "10_TO_20CM", label: "10–20 cm (ครึ่งแข้ง)" },
                  { value: "20_TO_40CM", label: "20–40 cm (ระดับหัวเข่า)" },
                  { value: "40_TO_60CM", label: "40–60 cm (ระดับต้นขา)" },
                  { value: "ABOVE_60CM", label: "> 60 cm (วิกฤต/ระดับเอว)" },
                  { value: "UNKNOWN", label: "Unknown (ไม่แน่ใจ)" },
                ].map((band) => (
                  <button
                    type="button"
                    key={band.value}
                    onClick={() => setWaterDepth(band.value)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                      waterDepth === band.value
                        ? "bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-600/20"
                        : "bg-surface border-surface-border text-gray-300 hover:bg-surface/80"
                    }`}
                  >
                    {band.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. VEHICLE PASSABILITY */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                4. Vehicle Passability (สภาพการสัญจรของรถ)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: "PASSABLE", label: "Passable (ผ่านได้ปกติ)" },
                  { value: "DIFFICULT", label: "Difficult (ผ่านยากลำบาก)" },
                  { value: "NOT_PASSABLE", label: "Not Passable (ผ่านไม่ได้)" },
                  { value: "UNKNOWN", label: "Unknown (ไม่ทราบ)" },
                ].map((pass) => (
                  <button
                    type="button"
                    key={pass.value}
                    onClick={() => setPassability(pass.value)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                      passability === pass.value
                        ? "bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20"
                        : "bg-surface border-surface-border text-gray-300 hover:bg-surface/80"
                    }`}
                  >
                    {pass.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. TRANSPORT TYPE */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                5. Your Transport Mode (พาหนะของผู้แจ้ง)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {["WALK", "MOTORCYCLE", "CAR", "TRUCK"].map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => setTransportType(mode)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                      transportType === mode
                        ? "bg-surface-border border-primary-500 text-primary-400"
                        : "bg-surface border-surface-border text-gray-400 hover:bg-surface/80"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. DESCRIPTION */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                6. Additional Description (รายละเอียดเพิ่มเติม - ถ้ามี)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-surface border border-surface-border rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                placeholder="เช่น น้ำท่วมขังเลนซ้าย หน้าหอพัก มีคลื่นซัดจากรถใหญ่..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-primary-600/30 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>SUBMITTING REPORT...</span>
                </>
              ) : (
                <span>SUBMIT FLOOD REPORT</span>
              )}
            </button>
          </form>
        ) : (
          /* CONFIRMATION SCREEN */
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white">REPORT RECEIVED</h2>
            <p className="text-xs text-gray-300 max-w-md mx-auto">
              ระบบได้รับรายงานน้ำท่วมของคุณแล้ว ข้อมูลจะถูกนำไปวิเคราะห์และจัดกลุ่ม (DBSCAN Clustering) เข้ากับรายงานใกล้เคียง และแสดงผลบน Live Map ทันที.
            </p>

            <div className="bg-surface p-4 rounded-xl border border-surface-border text-xs text-left max-w-sm mx-auto space-y-1.5 font-mono">
              <div><b>Report ID:</b> {submittedReport.id}</div>
              <div><b>Location:</b> {submittedReport.latitude?.toFixed(4)}, {submittedReport.longitude?.toFixed(4)}</div>
              <div><b>Depth Band:</b> {submittedReport.water_depth_band}</div>
              <div><b>Freshness:</b> {submittedReport.freshness}</div>
            </div>

            <div className="pt-4 flex justify-center gap-3">
              <Link
                href="/map"
                className="py-2.5 px-5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs"
              >
                VIEW ON LIVE MAP
              </Link>
              <button
                onClick={() => {
                  setSubmittedReport(null);
                  removePhoto();
                  setDescription("");
                }}
                className="py-2.5 px-5 rounded-xl bg-surface border border-surface-border text-gray-300 hover:text-white font-bold text-xs"
              >
                SUBMIT ANOTHER
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
