"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ShieldAlert,
  PhoneCall,
  MapPin,
  Clock,
  Database,
  Users,
  Compass,
  FileText,
  CheckCircle2,
  ExternalLink,
  Info
} from "lucide-react";

export default function LimitationsPage() {
  return (
    <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* HEADER BANNER */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-amber-800 dark:text-amber-300 font-bold mb-1">
              Safety & Operational Transparency — Phase 26 Limited Beta
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              System Limitations & Operational Boundaries
            </h1>
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
              ข้อจำกัด ขอบเขตทางภูมิศาสตร์ และนโยบายความถูกต้องของข้อมูล (Data Truth Policy) สำหรับระบบ KMITL Flood Intelligence ในระยะทดสอบจำกัด (Limited Beta).
            </p>
          </div>
        </div>
      </div>

      {/* EMERGENCY PROTOCOL NOTICE */}
      <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
          <h2 className="text-base sm:text-lg font-bold text-red-900 dark:text-red-200 uppercase tracking-wider">
            1. NOT A REPLACEMENT FOR NATIONAL EMERGENCY DISPATCH
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-red-900/90 dark:text-red-200/90 leading-relaxed">
          KMITL Flood Intelligence เป็นแพลตฟอร์มซอฟต์แวร์สนับสนุนข้อมูลการตัดสินใจ (Decision Support Software) <strong>ไม่ใช่</strong>ศูนย์รับแจ้งเหตุฉุกเฉินแห่งชาติตามกฎหมาย และ<strong>ไม่มีอำนาจสั่งการกำลังพลหรือรถกู้ภัยโดยตรง</strong> หากมีสถานการณ์คุกคามต่อชีวิตและทรัพย์สินเร่งด่วน ให้ติดต่อหน่วยงานราชการโดยตรงทันที:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 font-mono">
          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-xl p-3 text-center shadow-sm">
            <div className="text-xl font-black text-red-600">199</div>
            <div className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-0.5">ดับเพลิงและกู้ภัย</div>
            <div className="text-[10px] text-slate-500 font-sans">บรรเทาสาธารณภัย</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-xl p-3 text-center shadow-sm">
            <div className="text-xl font-black text-red-600">1669</div>
            <div className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-0.5">การแพทย์ฉุกเฉิน</div>
            <div className="text-[10px] text-slate-500 font-sans">ผู้ป่วยวิกฤต/บาดเจ็บ</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-xl p-3 text-center shadow-sm">
            <div className="text-xl font-black text-red-600">1784</div>
            <div className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-0.5">สายด่วน ปภ.</div>
            <div className="text-[10px] text-slate-500 font-sans">ภัยพิบัติแห่งชาติ</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center shadow-sm">
            <div className="text-lg font-black text-slate-900 dark:text-white">02-329-8000</div>
            <div className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-0.5">ศูนย์ความปลอดภัย สจล.</div>
            <div className="text-[10px] text-slate-500 font-sans">ต่อ 3100 ตลอด 24 ชม.</div>
          </div>
        </div>
      </div>

      {/* CORE BOUNDARIES MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Geographic Geofence Policy */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">2. ขอบเขตพื้นที่บริการ (Beta Geofence)</h2>
              <div className="text-xs text-slate-500 font-mono">Zone A & Zone B Boundaries</div>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            ระบบทำงานภายใต้กรอบ Geofence เพื่อรักษาความถูกต้องของข้อมูล ไม่ขยายไปยังพื้นที่ที่ไม่มีการตรวจสอบ:
          </p>
          <div className="space-y-3 font-mono text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 font-bold mb-1">
                <span>ZONE A: KMITL Campus & Perimeter</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">FULL BETA</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-sans text-xs">
                พื้นที่สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบังและถนนโดยรอบ (ฉลองกรุง, หลวงแพ่ง) มีความหนาแน่นของการสังเกตการณ์สูงสุด.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-cyan-700 dark:text-cyan-400 font-bold mb-1">
                <span>ZONE B: Lat Krabang Key Corridors</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200">LIMITED BETA</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-sans text-xs">
                เส้นทางหลักเชื่อมต่อเขตลาดกระบัง (ลาดกระบัง, ร่มเกล้า, กิ่งแก้ว) ข้อมูลขึ้นอยู่กับความหนาแน่นของรายงานประชาชน.
              </p>
            </div>
          </div>
        </div>

        {/* Shelter Occupancy & Ground Truth */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">3. นโยบายข้อมูลจุดพักพิง (Shelters)</h2>
              <div className="text-xs text-slate-500 font-mono">Honest Occupancy Verification Policy</div>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            เพื่อความปลอดภัยของผู้ประสบภัย ระบบยึดถือนโยบายความจริงของข้อมูลอย่างเข้มงวด:
          </p>
          <ul className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
            <li className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-white">ไม่มีการประดิษฐ์ตัวเลขยอดคนพักพิง (No Fake Occupancy):</strong> จุดพักพิงใดที่ไม่มีเจ้าหน้าที่ประจำจุดยืนยันยอด จะระบุสถานะเป็น <code>OCCUPANCY_NOT_VERIFIED</code> เสมอ ไม่มีการแสดงตัวเลขสุ่มหรือประมาณการลอย ๆ.
              </div>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-white">การตรวจสอบก่อนเดินทาง:</strong> แนะนำให้โทรศัพท์ติดต่อหมายเลขประสานงานของจุดพักพิงก่อนเดินทางเพื่อยืนยันความพร้อมของสิ่งอำนวยความสะดวก.
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
        <div>KMITL Flood Intelligence — Release 26.0 (Phase 26 Limited Beta)</div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-blue-700 dark:text-blue-400 hover:underline">Situation Summary</Link>
          <Link href="/help" className="text-red-600 hover:underline font-bold">Emergency Assistance</Link>
          <Link href="/data" className="text-slate-700 dark:text-slate-300 hover:underline">Data Provenance</Link>
        </div>
      </div>
    </div>
  );
}
