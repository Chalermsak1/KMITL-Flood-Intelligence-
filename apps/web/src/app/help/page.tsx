"use client";

import React, { useState, useEffect } from "react";
import {
  LifeBuoy,
  Phone,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Users,
  HeartPulse,
  Building,
  ShieldAlert,
  Clock,
  Navigation
} from "lucide-react";
import Link from "next/link";
import { api } from "../../lib/api";
import clsx from "clsx";

const EMERGENCY_HOTLINES = [
  {
    number: "199",
    name: "Fire & Rescue (กู้ภัย / บรรเทาสาธารณภัย)",
    desc: "เรือกู้ภัย เครื่องสูบน้ำ และการอพยพผู้ประสบภัย",
    badge: "24 HOURS",
    color: "bg-red-600 hover:bg-red-700 text-white"
  },
  {
    number: "1669",
    name: "Emergency Medical (กู้ชีพฉุกเฉิน 1669)",
    desc: "ผู้ป่วยวิกฤต บาดเจ็บสาหัส และการส่งต่อโรงพยาบาล",
    badge: "MEDICAL TRIAGE",
    color: "bg-red-600 hover:bg-red-700 text-white"
  },
  {
    number: "023298000",
    display: "02-329-8000",
    name: "KMITL Safety Center (ศูนย์ความปลอดภัย สจล.)",
    desc: "ศูนย์ประสานงานเหตุฉุกเฉินภายในมหาวิทยาลัย สจล. ลาดกระบัง",
    badge: "CAMPUS DIRECT",
    color: "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900"
  }
];

export default function HelpPage() {
  const [lat, setLat] = useState<number>(13.7298);
  const [lng, setLng] = useState<number>(100.7782);
  const [gpsStatus, setGpsStatus] = useState<string>("Detecting GPS...");
  const [helpType, setHelpType] = useState<string>("EVACUATION");
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [peopleCount, setPeopleCount] = useState<number>(1);
  const [vulnerable, setVulnerable] = useState<string>("");
  const [waterLevel, setWaterLevel] = useState<string>("ท่วมถึงหน้าอก / รถสัญจรไม่ได้");
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedTicket, setSubmittedTicket] = useState<any>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setGpsStatus(`GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        () => {
          setGpsStatus("Default: Central KMITL Campus");
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.postHelpRequest({
        latitude: lat,
        longitude: lng,
        help_type: helpType,
        requester_name: name || undefined,
        contact_phone: phone || undefined,
        people_count: peopleCount,
        vulnerable_details: vulnerable || undefined,
        current_water_level: waterLevel || undefined,
        description: description || undefined
      });
      setSubmittedTicket(res.data);
    } catch {
      alert("Error submitting request. Please call emergency hotline 199 or 02-329-8000 directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 sm:py-8 space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Situation Platform</span>
      </Link>

      {/* ─── SECTION 1: DIRECT EMERGENCY VOICE CALL (PROMINENT) ──────────────── */}
      <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-800 rounded-2xl p-5 sm:p-7 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white shrink-0">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-red-900 dark:text-red-200 uppercase tracking-tight">
              1. Direct Emergency Voice Call (โทรฉุกเฉินด่วน)
            </h2>
            <p className="text-xs text-red-700 dark:text-red-300">
              หากมีเหตุฉุกเฉินถึงแก่ชีวิตหรือต้องการกู้ชีพเร่งด่วน กรุณาโทรติดต่อสายด่วนทางการทันที:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {EMERGENCY_HOTLINES.map((item) => (
            <a
              key={item.number}
              href={`tel:${item.number}`}
              className={clsx(
                "p-4 rounded-xl flex flex-col justify-between transition-transform hover:scale-[1.02] shadow-sm",
                item.color
              )}
            >
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-white/20 uppercase tracking-wider">
                  {item.badge}
                </span>
                <div className="text-2xl font-black font-mono tracking-tight mt-1">
                  {item.display || item.number}
                </div>
                <div className="text-xs font-bold leading-tight">{item.name}</div>
              </div>
              <div className="text-[10px] opacity-80 mt-2 font-medium">
                {item.desc}
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ─── SECTION 2: DIGITAL ASSISTANCE REQUEST (LABELLED PILOT / TEST) ────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 space-y-6 shadow-sm">
        {/* PILOT TEST MANDATORY NOTICE */}
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-mono font-bold uppercase tracking-wider flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px]">
                FEATURE STATUS: PILOT / TEST
              </span>
              <span>Online Assistance Form</span>
            </div>
            <p className="leading-relaxed">
              ระบบบันทึกคำขอความช่วยเหลือออนไลน์นี้เป็น <strong>ระบบทดสอบนำร่อง (PILOT / TEST)</strong> เพื่อประเมินความต้องการช่วยเหลือในพื้นที่ <strong>ไม่ได้รับประกันการเข้าช่วยเหลือทันที (Does NOT guarantee rescue dispatch)</strong>. หากท่านอยู่ในภาวะวิกฤต โปรดโทร 199 หรือ 1669 โดยตรง.
            </p>
          </div>
        </div>

        {!submittedTicket ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                2. Digital Assistance Request Form (แบบฟอร์มขอความช่วยเหลือ)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                กรอกข้อมูลเพื่อให้ศูนย์ประสานงาน สจล. และจิตอาสาได้รับทราบตำแหน่งและระดับความช่วยเหลือ
              </p>
            </div>

            {/* Assistance Type */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono mb-2">
                ประเภทความช่วยเหลือที่ต้องการ
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { value: "TRAPPED", label: "ติดค้างในอาคาร/หอพัก", icon: Building },
                  { value: "EVACUATION", label: "ต้องการอพยพออกนอกพื้นที่", icon: Navigation },
                  { value: "MEDICINE", label: "ยาประจำตัว / ผู้ป่วย", icon: HeartPulse },
                  { value: "FOOD_WATER", label: "อาหารและน้ำดื่มประทังชีพ", icon: LifeBuoy },
                  { value: "VULNERABLE_PERSON", label: "เด็ก / ผู้สูงอายุ / ผู้พิการ", icon: Users },
                  { value: "OTHER", label: "ความช่วยเหลืออื่น ๆ", icon: AlertCircle }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = helpType === item.value;
                  return (
                    <button
                      type="button"
                      key={item.value}
                      onClick={() => setHelpType(item.value)}
                      className={clsx(
                        "p-3 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[64px]",
                        isSelected
                          ? "bg-red-50 dark:bg-red-950/60 border-red-600 text-red-900 dark:text-red-200 font-bold shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      )}
                    >
                      <Icon className={clsx("w-4 h-4 mb-1", isSelected ? "text-red-600" : "text-slate-500")} />
                      <span className="text-xs leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* People Count & Vulnerable Groups */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono mb-1.5">
                  จำนวนผู้ประสบภัย (คน)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono mb-1.5">
                  กลุ่มเปราะบาง (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={vulnerable}
                  onChange={(e) => setVulnerable(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                  placeholder="เช่น ผู้สูงอายุ 1 ท่าน, เด็กเล็ก 2 คน"
                />
              </div>
            </div>

            {/* Contact details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono mb-1.5">
                  ชื่อผู้แจ้ง / ผู้ติดต่อ
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                  placeholder="ชื่อ-นามสกุล"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono mb-1.5">
                  เบอร์โทรศัพท์ที่ติดต่อได้
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono"
                  placeholder="08X-XXX-XXXX"
                  required
                />
              </div>
            </div>

            {/* Location Description */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono mb-1.5">
                สถานที่เกิดเหตุ / จุดสังเกตที่เข้าถึง
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
                placeholder="ระบุชื่อหอพัก ซอย เลขที่ห้อง ชั้นที่อยู่ หรือจุดสังเกตเพื่อช่วยให้ทีมกู้ภัยระบุพิกัดได้..."
                required
              />
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 mt-1">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>{gpsStatus}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm uppercase tracking-wider shadow-sm transition-all disabled:opacity-50"
            >
              {submitting ? "Transmitting Ticket..." : "Submit Digital Assistance Request"}
            </button>
          </form>
        ) : (
          /* RECEIPT SCREEN */
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              ASSISTANCE TICKET RECORDED
            </h2>
            <div className="text-xs font-mono font-bold text-red-700 dark:text-red-400">
              TICKET #{submittedTicket.ticket_number} (STATUS: PILOT_LOGGED)
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              คำขอของคุณถูกบันทึกในระบบศูนย์ประสานงาน สจล. เรียบร้อยแล้ว หากระดับน้ำวิกฤตหรืออาการป่วยฉุกเฉิน โปรดโทร 199 หรือ 1669 ทันที.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-left max-w-sm mx-auto space-y-1.5 font-mono">
              <div><b>Requester:</b> {submittedTicket.requester_name}</div>
              <div><b>Contact Phone:</b> {submittedTicket.contact_phone}</div>
              <div><b>People Count:</b> {submittedTicket.people_count}</div>
              <div><b>Dispatch System:</b> PILOT_TEST (NO GUARANTEED DISPATCH)</div>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => setSubmittedTicket(null)}
                className="py-2.5 px-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase hover:bg-slate-50"
              >
                Submit Another Request
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
