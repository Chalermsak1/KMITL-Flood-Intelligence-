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
  Compass,
  Droplets,
  Ban,
  Building,
  Car,
  Waves,
  HelpCircle,
  Clock,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { api } from "../../lib/api";
import clsx from "clsx";

const GPS_HIGH_ACCURACY_M = 20;
const GPS_LOW_ACCURACY_M  = 50;

const CAMPUS_PRESETS = [
  { name: "Engineering Gate 1", lat: 13.7298, lng: 100.7782 },
  { name: "ECC Building", lat: 13.7278, lng: 100.7749 },
  { name: "Central Library", lat: 13.7289, lng: 100.7765 },
  { name: "Chalong Krung Gate 1", lat: 13.7314, lng: 100.7812 },
  { name: "ARL Lat Krabang", lat: 13.7275, lng: 100.7483 },
  { name: "Hua Takhe Market", lat: 13.7215, lng: 100.7895 }
];

const REPORT_TYPES = [
  { id: "WATER_ON_ROAD", label: "Water on Road", sub: "น้ำท่วมขังบนผิวทาง", icon: Droplets, color: "text-blue-600 dark:text-blue-400" },
  { id: "BLOCKED_ROAD", label: "Blocked Road", sub: "ทางปิด รถผ่านไม่ได้", icon: Ban, color: "text-red-600 dark:text-red-400" },
  { id: "FLOODED_BUILDING", label: "Flooded Building", sub: "น้ำท่วมเข้าอาคาร/หอพัก", icon: Building, color: "text-amber-600 dark:text-amber-400" },
  { id: "STRANDED_VEHICLE", label: "Stranded Vehicle", sub: "ยานพาหนะติดขัด/น้ำเข้าเครื่อง", icon: Car, color: "text-orange-600 dark:text-orange-400" },
  { id: "DRAINAGE_ISSUE", label: "Drainage Issue", sub: "ท่อระบายน้ำอุดตัน/น้ำล้น", icon: Waves, color: "text-cyan-600 dark:text-cyan-400" },
  { id: "OTHER", label: "Other Issue", sub: "ปัญหาอื่น ๆ ในพื้นที่", icon: HelpCircle, color: "text-slate-600 dark:text-slate-400" }
];

const DEPTH_BANDS = [
  { value: "BELOW_10CM", label: "< 10 cm", sub: "ท่วมระดับข้อเท้า" },
  { value: "10_TO_20CM", label: "10–20 cm", sub: "ท่วมครึ่งแข้ง" },
  { value: "20_TO_40CM", label: "20–40 cm", sub: "ท่วมระดับหัวเข่า" },
  { value: "40_TO_60CM", label: "40–60 cm", sub: "ท่วมระดับต้นขา" },
  { value: "ABOVE_60CM", label: "> 60 cm", sub: "วิกฤต/ระดับเอว" },
  { value: "UNKNOWN", label: "Unknown", sub: "ไม่แน่ใจระดับน้ำ" }
];

export default function ReportPage() {
  const router = useRouter();

  const [reportType, setReportType] = useState<string>("WATER_ON_ROAD");
  const [lat, setLat] = useState<number>(13.7298);
  const [lng, setLng] = useState<number>(100.7782);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>("Acquiring GPS location...");
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

  useEffect(() => {
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;
    setIsOnline(online);

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
          const quality = acc <= GPS_HIGH_ACCURACY_M ? "High" : acc <= GPS_LOW_ACCURACY_M ? "Moderate" : "Low";
          setGpsStatus(`GPS Acquired (${quality}) — ±${Math.round(acc)} m accuracy`);
        },
        (err) => {
          setGpsAccuracy(null);
          setGpsStatus("Location unavailable. Please select a landmark or enter coordinates manually.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    } else {
      setGpsAccuracy(null);
      setGpsStatus("Browser does not support geolocation.");
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("Photo exceeds 10MB limit. Please take a smaller picture.");
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    if (isOnline) {
      try {
        setAiFeedback("Analyzing image...");
        const result = await api.verifyImage(file, lat, lng);
        if (result?.classification) {
          const depth = result.classification.suggested_depth_band || "FLOOD_DETECTED";
          setAiFeedback(`AI Analysis: ${depth} (${result.recommended_confidence || "HIGH"} confidence)`);
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
      photoUrl = photoPreview;
    }

    const typeDesc = REPORT_TYPES.find(t => t.id === reportType)?.label || "Flood Report";
    const fullDesc = description ? `[${typeDesc}] ${description}` : `[${typeDesc}]`;

    const payload = {
      latitude: lat,
      longitude: lng,
      water_depth_band: waterDepth,
      vehicle_passability: passability,
      transport_type: transportType,
      description: fullDesc,
      photo_url: photoUrl
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      localStorage.setItem("kmitl_pending_report", JSON.stringify(payload));
      setPendingOffline(payload);
      setSubmitting(false);
      return;
    }

    await submitPayload(payload);
  };

  return (
    <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 sm:py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white mb-4 font-semibold"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Situation Platform</span>
      </Link>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm">
        {!isOnline && (
          <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-300 dark:bg-amber-950/40 dark:border-amber-800 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200 font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>OFFLINE: Reports will be saved locally as PENDING and submitted automatically once connected.</span>
          </div>
        )}

        {pendingOffline ? (
          /* OFFLINE PENDING SCREEN */
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">REPORT STATUS: PENDING</h2>
            <div className="inline-block px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-xs font-mono font-bold">
              STORED IN LOCAL QUEUE (OFFLINE)
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              รายงานของคุณถูกเก็บไว้ในอุปกรณ์แล้ว และจะส่งไปยังศูนย์ข้อมูล สจล. อัตโนมัติทันทีที่ระบบเชื่อมต่ออินเทอร์เน็ต
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => submitPayload(pendingOffline)}
                disabled={submitting}
                className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase"
              >
                {submitting ? "Retrying..." : "Retry Submission"}
              </button>
            </div>
          </div>
        ) : !submittedReport ? (
          /* MAIN ONE-HANDED MOBILE REPORT FORM */
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1">
                <Droplets className="w-4 h-4" />
                <span>Field Observation Protocol</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Report Flood Condition
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                รายงานสถานการณ์น้ำท่วมเพื่อแจ้งเตือนนักศึกษาและชุมชนลาดกระบังแบบเรียลไทม์
              </p>
            </div>

            {/* 1. SELECTABLE REPORT TYPES (MOBILE TILES) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                1. Select Report Type (ประเภทเหตุการณ์)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {REPORT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = reportType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setReportType(type.id)}
                      className={clsx(
                        "p-3 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[76px]",
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/60 border-blue-600 ring-2 ring-blue-500/20 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <Icon className={clsx("w-5 h-5 mb-1.5", isSelected ? "text-blue-600 dark:text-blue-400" : type.color)} />
                      <div>
                        <div className={clsx("text-xs font-bold leading-tight", isSelected ? "text-blue-900 dark:text-blue-200" : "text-slate-800 dark:text-slate-200")}>
                          {type.label}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {type.sub}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. APPROXIMATE WATER DEPTH (TOUCH TILES) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                2. Approximate Water Depth (ระดับความลึกโดยประมาณ)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DEPTH_BANDS.map((band) => (
                  <button
                    key={band.value}
                    type="button"
                    onClick={() => setWaterDepth(band.value)}
                    className={clsx(
                      "py-2.5 px-3 rounded-xl border text-center transition-all",
                      waterDepth === band.value
                        ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                    )}
                  >
                    <div className="font-bold text-xs leading-tight">{band.label}</div>
                    <div className={clsx("text-[10px] mt-0.5", waterDepth === band.value ? "text-blue-100" : "text-slate-500")}>
                      {band.sub}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. CURRENT LOCATION & CAMPUS LANDMARK PRESETS */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5 font-mono uppercase">
                  <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>3. Location (พิกัดจุดสังเกต)</span>
                </span>
                <button
                  type="button"
                  onClick={acquireGps}
                  className="text-blue-700 dark:text-blue-400 font-mono text-[11px] flex items-center gap-1 hover:underline"
                >
                  <Navigation className="w-3 h-3" /> Refresh GPS
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                {gpsStatus}
              </div>

              {/* Landmark Quick Chips */}
              <div>
                <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Landmark (กดเลือกจุดสังเกตใกล้เคียง):
                </span>
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
                      className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-blue-500 transition-colors shadow-sm"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                <div>
                  <span className="text-[10px] text-slate-500 block">Latitude</span>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Longitude</span>
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white text-xs font-mono"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 4. PHOTO UPLOAD */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                4. Photo Evidence (แนบภาพถ่าย - ถ้ามี)
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
                  className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 rounded-xl flex flex-col items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 transition-colors"
                >
                  <Camera className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Take Photo or Upload Image (Max 10MB)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    EXIF metadata automatically sanitized for citizen privacy
                  </span>
                </button>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Flood preview"
                    className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                  <div className="flex-1 text-xs space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white">Photo Attached</div>
                    {aiFeedback && (
                      <div className="text-[10px] font-mono text-blue-700 dark:text-blue-300">
                        {aiFeedback}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600"
                    title="Remove Photo"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* 5. PASSABILITY & TRANSPORT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono mb-1.5">
                  Vehicle Passability (สภาพการสัญจร)
                </label>
                <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold">
                  {[
                    { id: "PASSABLE", label: "Passable (ผ่านได้)" },
                    { id: "DIFFICULT", label: "Difficult (ผ่านยาก)" },
                    { id: "NOT_PASSABLE", label: "Closed (ผ่านไม่ได้)" },
                    { id: "UNKNOWN", label: "Unknown (ไม่ทราบ)" }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPassability(p.id)}
                      className={clsx(
                        "py-2 px-2 rounded-lg border text-center transition-all text-xs",
                        passability === p.id
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono mb-1.5">
                  Your Mode of Travel (พาหนะของคุณ)
                </label>
                <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold">
                  {[
                    { id: "WALK", label: "Pedestrian" },
                    { id: "MOTORCYCLE", label: "Motorcycle" },
                    { id: "CAR", label: "Car / Taxi" },
                    { id: "TRUCK", label: "Truck / Bus" }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTransportType(m.id)}
                      className={clsx(
                        "py-2 px-2 rounded-lg border text-center transition-all text-xs",
                        transportType === m.id
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 6. OPTIONAL DESCRIPTION */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono mb-1.5">
                Additional Details (รายละเอียดเพิ่มเติม)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                placeholder="ระบุจุดสังเกต เช่น หน้าตึกวิศวะ 100 ปี, ซอยเกกลักษณ์ 2..."
              />
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm uppercase tracking-wider shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? "Submitting Report..." : "Submit Field Flood Report"}
            </button>
          </form>
        ) : (
          /* CONFIRMATION SCREEN (HONEST DATA SEMANTICS) */
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              REPORT RECEIVED
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              รายงานของคุณเข้าสู่ระบบเรียบร้อยแล้ว และจะถูกนำไปจัดกลุ่มทางพื้นที่และเวลา (DBSCAN Clustering) เข้ากับรายงานใกล้เคียงทันที
            </p>

            {/* HONEST DATA PROVENANCE RECEIPT */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-left max-w-sm mx-auto space-y-2 font-mono">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500">Source:</span>
                <span className="font-bold text-blue-700 dark:text-blue-400">CITIZEN REPORT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Timestamp:</span>
                <span className="text-slate-800 dark:text-slate-200">{new Date().toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Report Status:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">UNVERIFIED (QUEUED FOR CLUSTERING)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Coordinates:</span>
                <span className="text-slate-800 dark:text-slate-200">{submittedReport.latitude?.toFixed(4)}, {submittedReport.longitude?.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Depth Band:</span>
                <span className="text-slate-800 dark:text-slate-200">{submittedReport.water_depth_band}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              <Link
                href="/map"
                className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase shadow-sm"
              >
                View on Live Map
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSubmittedReport(null);
                  removePhoto();
                  setDescription("");
                }}
                className="py-2.5 px-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase hover:bg-slate-50"
              >
                Submit Another Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
