"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Camera, CheckCircle2, AlertCircle, ArrowLeft, Navigation } from "lucide-react";
import Link from "next/link";
import { api } from "../../lib/api";

export default function ReportPage() {
  const router = useRouter();

  const [lat, setLat] = useState<number>(13.7298);
  const [lng, setLng] = useState<number>(100.7782);
  const [gpsStatus, setGpsStatus] = useState<string>("Locating your GPS...");
  const [waterDepth, setWaterDepth] = useState<string>("20_TO_40CM");
  const [passability, setPassability] = useState<string>("DIFFICULT");
  const [transportType, setTransportType] = useState<string>("CAR");
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedReport, setSubmittedReport] = useState<any>(null);
  const [pendingOffline, setPendingOffline] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Request browser geolocation and manage network status
  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    const handleOnline = async () => {
      setIsOnline(true);
      const saved = localStorage.getItem("kmitl_pending_report");
      if (saved) {
        try {
          const payload = JSON.parse(saved);
          setSubmitting(true);
          const res = await api.postReport(payload);
          localStorage.removeItem("kmitl_pending_report");
          setPendingOffline(null);
          setSubmittedReport(res.data);
        } catch (e) {
          console.error("Retry submission failed:", e);
        } finally {
          setSubmitting(false);
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setGpsStatus(`GPS Acquired: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        () => {
          setGpsStatus("GPS Access Denied. Using KMITL Campus Center as default.");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setGpsStatus("Browser does not support Geolocation.");
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      latitude: lat,
      longitude: lng,
      water_depth_band: waterDepth,
      vehicle_passability: passability,
      transport_type: transportType,
      description: description || undefined
    };

    // If offline or disconnected, queue report as PENDING
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      localStorage.setItem("kmitl_pending_report", JSON.stringify(payload));
      setPendingOffline(payload);
      setSubmitting(false);
      return;
    }

    try {
      const res = await api.postReport(payload);
      localStorage.removeItem("kmitl_pending_report");
      setPendingOffline(null);
      setSubmittedReport(res.data);
    } catch (err) {
      // Network failure during submit: queue as PENDING
      localStorage.setItem("kmitl_pending_report", JSON.stringify(payload));
      setPendingOffline(payload);
    } finally {
      setSubmitting(false);
    }
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
              <div><b>Location:</b> {pendingOffline.latitude.toFixed(4)}, {pendingOffline.longitude.toFixed(4)}</div>
              <div><b>Depth Band:</b> {pendingOffline.water_depth_band}</div>
              <div><b>Local Queue Status:</b> WAITING FOR NETWORK ACK</div>
            </div>

            <div className="pt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    const res = await api.postReport(pendingOffline);
                    localStorage.removeItem("kmitl_pending_report");
                    setPendingOffline(null);
                    setSubmittedReport(res.data);
                  } catch (e) {
                    alert("Network still unreachable. Keeping report in PENDING queue.");
                  } finally {
                    setSubmitting(false);
                  }
                }}
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

            {/* 1. GPS LOCATION */}
            <div className="bg-surface/80 p-3.5 rounded-xl border border-surface-border space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-300">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary-400" />
                  <span>1. GPS Location (พิกัดจุดเกิดเหตุ)</span>
                </span>
                <span className="text-[11px] text-primary-400 font-mono flex items-center gap-1">
                  <Navigation className="w-3 h-3" /> Auto-GPS
                </span>
              </div>
              <div className="text-xs font-mono text-gray-400">{gpsStatus}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className="bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-white font-mono"
                  placeholder="Latitude"
                  required
                />
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                  className="bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-white font-mono"
                  placeholder="Longitude"
                  required
                />
              </div>
            </div>

            {/* 2. WATER DEPTH BANDS */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                2. Water Depth (ระดับความลึกของน้ำท่วม)
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

            {/* 3. VEHICLE PASSABILITY */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                3. Vehicle Passability (สภาพการสัญจรของรถ)
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

            {/* 4. TRANSPORT TYPE */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                4. Your Transport Mode (พาหนะของผู้แจ้ง)
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

            {/* 5. DESCRIPTION */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                5. Additional Description (รายละเอียดเพิ่มเติม - ถ้ามี)
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
              className="w-full py-3.5 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-primary-600/30 transition-all"
            >
              {submitting ? "SUBMITTING REPORT..." : "SUBMIT FLOOD REPORT"}
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
              <div><b>Location:</b> {submittedReport.latitude.toFixed(4)}, {submittedReport.longitude.toFixed(4)}</div>
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
                onClick={() => setSubmittedReport(null)}
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
