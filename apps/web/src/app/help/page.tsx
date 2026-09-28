"use client";

import React, { useState, useEffect } from "react";
import { LifeBuoy, MapPin, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { api } from "../../lib/api";

export default function HelpPage() {
  const [lat, setLat] = useState<number>(13.7298);
  const [lng, setLng] = useState<number>(100.7782);
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
        },
        null,
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
      alert("Error submitting emergency request. Please call KMITL Emergency: 02-329-8000 directly.");
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

      <div className="bg-surface-card border border-red-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-orange-500 to-red-600" />

        {!submittedTicket ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-600/20 text-red-400 border border-red-500/40 flex items-center justify-center">
                <LifeBuoy className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  EMERGENCY FLOOD ASSISTANCE (SOS)
                </h1>
                <p className="text-xs text-gray-400">
                  ส่งคำขอความช่วยเหลือฉุกเฉินไปยังศูนย์ความปลอดภัยและทีมกู้ภัย สจล.
                </p>
              </div>
            </div>

            {/* Emergency Type Selection */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                ประเภทความช่วยเหลือเร่งด่วน (Emergency Type)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { value: "TRAPPED", label: "ติดค้างในอาคาร/หอพัก" },
                  { value: "EVACUATION", label: "ต้องการอพยพด่วน" },
                  { value: "MEDICINE", label: "ยา / ผู้ป่วยฉุกเฉิน" },
                  { value: "FOOD_WATER", label: "อาหารและน้ำดื่ม" },
                  { value: "VULNERABLE_PERSON", label: "เด็ก / ผู้สูงอายุ / ผู้พิการ" },
                  { value: "OTHER", label: "ความช่วยเหลืออื่น ๆ" },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    onClick={() => setHelpType(item.value)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                      helpType === item.value
                        ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30"
                        : "bg-surface border-surface-border text-gray-300 hover:bg-surface/80"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* People Count & Vulnerable Groups */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">
                  จำนวนผู้ประสบภัย (คน)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(parseInt(e.target.value) || 1)}
                  className="w-full bg-surface border border-surface-border rounded-xl p-3 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">
                  กลุ่มเปราะบาง (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={vulnerable}
                  onChange={(e) => setVulnerable(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-xl p-3 text-xs text-white"
                  placeholder="เช่น ผู้สูงอายุ 1 ท่าน, สัตว์เลี้ยง 2 ตัว"
                />
              </div>
            </div>

            {/* Contact details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">
                  ชื่อผู้ติดต่อ
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-xl p-3 text-xs text-white"
                  placeholder="ชื่อ-นามสกุล"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">
                  เบอร์โทรศัพท์ที่ติดต่อได้
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-xl p-3 text-xs text-white"
                  placeholder="08X-XXX-XXXX"
                  required
                />
              </div>
            </div>

            {/* Detailed Description */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">
                สถานที่ระบุจุดเด่น / รายละเอียดเพิ่มเติม
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-surface border border-surface-border rounded-xl p-3 text-xs text-white placeholder-gray-500"
                placeholder="ระบุชื่อหอพัก ซอย เลขห้อง หรือสภาพแวดล้อมเพื่อช่วยให้ทีมกู้ภัยเข้าถึงได้เร็วขึ้น..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm tracking-wider uppercase shadow-xl shadow-red-600/40 transition-all"
            >
              {submitting ? "DISPATCHING SOS..." : "SEND EMERGENCY SOS REQUEST"}
            </button>
          </form>
        ) : (
          /* SOS SUBMITTED CONFIRMATION */
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-600/20 text-red-400 border border-red-500/40 flex items-center justify-center mx-auto animate-pulse">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white">SOS DISPATCHED</h2>
            <div className="text-xs font-mono text-red-400 font-bold">
              TICKET #{submittedTicket.ticket_number} (PRIORITY: {submittedTicket.priority})
            </div>
            <p className="text-xs text-gray-300 max-w-md mx-auto">
              คำขอของคุณถูกบันทึกและส่งต่อไปยังศูนย์ประสานงานฉุกเฉิน สจล. เรียบร้อยแล้ว ทีมงานกำลังจัดสรรกำลังกู้ภัยและจะติดต่อกลับทางเบอร์โทรศัพท์ที่แจ้งไว้.
            </p>

            <div className="bg-surface p-4 rounded-xl border border-surface-border text-xs text-left max-w-sm mx-auto space-y-1 font-mono">
              <div><b>Requester:</b> {submittedTicket.requester_name}</div>
              <div><b>Contact:</b> {submittedTicket.contact_phone}</div>
              <div><b>People Count:</b> {submittedTicket.people_count}</div>
              <div><b>Status:</b> OPEN / DISPATCHING</div>
            </div>

            <div className="pt-2 text-xs text-amber-400 font-medium">
              หากเป็นเหตุฉุกเฉินถึงชีวิต โทรตรงศูนย์ความปลอดภัย สจล.: 02-329-8000 (ต่อ 3100)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
