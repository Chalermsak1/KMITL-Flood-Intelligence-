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
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-1">
              Safety & Operational Transparency — Phase 26 Limited Beta
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              SYSTEM LIMITATIONS & OPERATIONAL BOUNDARIES
            </h1>
            <p className="text-sm text-gray-300 mt-2 leading-relaxed">
              ข้อจำกัด ขอบเขตทางภูมิศาสตร์ และนโยบายความถูกต้องของข้อมูล (Data Truth Policy)
              สำหรับระบบ KMITL Flood Intelligence ในระยะทดสอบจำกัด (Limited Beta).
            </p>
          </div>
        </div>
      </div>

      {/* EMERGENCY PROTOCOL NOTICE */}
      <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-red-400" />
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">
            1. NOT A REPLACEMENT FOR NATIONAL EMERGENCY DISPATCH
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-gray-200 leading-relaxed">
          KMITL Flood Intelligence เป็นแพลตฟอร์มซอฟต์แวร์สนับสนุนข้อมูลการตัดสินใจ (Decision Support Software) <strong>ไม่ใช่</strong>ศูนย์รับแจ้งเหตุฉุกเฉินแห่งชาติตามกฎหมาย และ<strong>ไม่มีอำนาจสั่งการกำลังพลหรือรถกู้ภัยโดยตรง</strong> หากมีสถานการณ์คุกคามต่อชีวิตและทรัพย์สินเร่งด่วน ให้ติดต่อหน่วยงานราชการโดยตรงทันที:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="bg-surface/80 border border-red-500/30 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-red-400 font-mono">199</div>
            <div className="text-xs text-white font-medium">ดับเพลิงและกู้ภัย (BMA Fire & Rescue)</div>
            <div className="text-[10px] text-gray-400">อุบัติภัยและอพยพเร่งด่วน</div>
          </div>
          <div className="bg-surface/80 border border-red-500/30 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-red-400 font-mono">1669</div>
            <div className="text-xs text-white font-medium">การแพทย์ฉุกเฉิน (EMS)</div>
            <div className="text-[10px] text-gray-400">ผู้ป่วยวิกฤติ บาดเจ็บฉุกเฉิน</div>
          </div>
          <div className="bg-surface/80 border border-red-500/30 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-red-400 font-mono">1784</div>
            <div className="text-xs text-white font-medium">สายด่วน ปภ. (DDPM)</div>
            <div className="text-[10px] text-gray-400">ภัยพิบัติสาธารณะ กรมป้องกันฯ</div>
          </div>
          <div className="bg-surface/80 border border-red-500/30 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-amber-400 font-mono">02-329-8000</div>
            <div className="text-xs text-white font-medium">ศูนย์รักษาความปลอดภัย สจล.</div>
            <div className="text-[10px] text-gray-400">ต่อ 3100 หรือ 3200 ตลอด 24 ชม.</div>
          </div>
        </div>
      </div>

      {/* CORE BOUNDARIES MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Geographic Geofence Policy */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">2. ขอบเขตพื้นที่บริการ (Beta Geofence)</h2>
              <div className="text-xs text-gray-400 font-mono">Zone A & Zone B Boundaries</div>
            </div>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            ระบบทำงานภายใต้กรอบ Geofence เพื่อรักษาความถูกต้องของข้อมูล ไม่ขยายไปยังพื้นที่ที่ไม่มีการตรวจสอบ:
          </p>
          <div className="space-y-3 font-mono text-xs">
            <div className="bg-surface p-3.5 rounded-xl border border-surface-border">
              <div className="flex items-center justify-between text-blue-400 font-bold mb-1">
                <span>ZONE A: KMITL Campus & Perimeter</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20">FULL BETA</span>
              </div>
              <p className="text-gray-400 font-sans text-xs">
                พื้นที่สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบังและถนนโดยรอบ (ฉลองกรุง, หลวงแพ่ง) มีความหนาแน่นของการสังเกตการณ์สูงสุด.
              </p>
            </div>
            <div className="bg-surface p-3.5 rounded-xl border border-surface-border">
              <div className="flex items-center justify-between text-cyan-400 font-bold mb-1">
                <span>ZONE B: Lat Krabang Key Corridors</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20">LIMITED BETA</span>
              </div>
              <p className="text-gray-400 font-sans text-xs">
                เส้นทางหลักเชื่อมต่อเขตลาดกระบัง (ลาดกระบัง, ร่มเกล้า, กิ่งแก้ว) ข้อมูลขึ้นอยู่กับความหนาแน่นของรายงานประชาชน.
              </p>
            </div>
            <div className="bg-surface p-3.5 rounded-xl border border-amber-500/30 text-amber-300">
              <div className="font-bold mb-1">OUTSIDE BETA POLICY:</div>
              <p className="font-sans text-xs text-gray-300">
                พื้นที่นอกเหนือจาก Zone A และ Zone B จะแสดงคำเตือนว่า <em>"Coverage is limited"</em> ข้อมูลน้ำท่วมหรือการคำนวณเส้นทางหลบเลี่ยงไม่ได้รับการรับประกันความแม่นยำ.
              </p>
            </div>
          </div>
        </div>

        {/* Shelter Occupancy & Ground Truth */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">3. นโยบายข้อมูลจุดพักพิง (Shelters)</h2>
              <div className="text-xs text-gray-400 font-mono">No Fabricated Occupancy Policy</div>
            </div>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            เพื่อความปลอดภัยของผู้ประสบภัย ระบบยึดถือนโยบายความจริงของข้อมูลอย่างเข้มงวด:
          </p>
          <ul className="space-y-3 text-xs text-gray-300">
            <li className="flex items-start gap-2 bg-surface p-3 rounded-xl border border-surface-border">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">ไม่มีการประดิษฐ์ตัวเลขยอดคนพักพิง (No Fake Occupancy):</strong> จุดพักพิงใดที่ไม่มีเจ้าหน้าที่ประจำจุดยืนยันยอด จะระบุสถานะเป็น <code>OCCUPANCY_NOT_VERIFIED</code> เสมอ จะไม่มีการแสดงตัวเลขสุ่มหรือประมาณการลอย ๆ.
              </div>
            </li>
            <li className="flex items-start gap-2 bg-surface p-3 rounded-xl border border-surface-border">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">การตรวจสอบก่อนเดินทาง:</strong> แนะนำให้โทรศัพท์ติดต่อหมายเลขประสานงานของจุดพักพิงก่อนเดินทางเพื่อยืนยันความพร้อมของสิ่งอำนวยความสะดวก.
              </div>
            </li>
            <li className="flex items-start gap-2 bg-surface p-3 rounded-xl border border-surface-border">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">การอัปเดตผ่าน EOC:</strong> ตัวเลขความจุและยอดผู้พักพิงจะเปลี่ยนแปลงได้เฉพาะเมื่อเจ้าหน้าที่ศูนย์ EOC หรือผู้ดูแลจุดที่ได้รับมอบหมายบันทึกข้อมูลเข้าระบบเท่านั้น.
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* SENSOR & SATELLITE FRESHNESS LIMITATIONS */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">4. ความถี่และความสดของข้อมูล (Freshness & Sources)</h2>
            <div className="text-xs text-gray-400 font-mono">External Feeds & Sensor Cadence</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-surface p-4 rounded-xl border border-surface-border space-y-2">
            <div className="text-xs font-mono text-purple-400 font-bold uppercase">Satellite Radar (Copernicus)</div>
            <p className="text-xs text-gray-300">
              ดาวเทียมเรดาร์ Sentinel-1 / OPERA บินผ่านพื้นที่ลาดกระบังทุก <strong>6 - 12 วัน</strong> ดังนั้นภาพถ่ายดาวเทียมจึงเป็นการสะท้อนภาพประวัติศาสตร์ ไม่ใช่ภาพสด Real-Time ระดับนาที.
            </p>
            <div className="text-[10px] font-mono text-gray-500">Latency: 12-24h post-pass processing</div>
          </div>

          <div className="bg-surface p-4 rounded-xl border border-surface-border space-y-2">
            <div className="text-xs font-mono text-blue-400 font-bold uppercase">Official Telemetry (TMD / BMA)</div>
            <p className="text-xs text-gray-300">
              API จากหน่วยงานภายนอกอยู่ในสถานะ <strong>PENDING_ACCESS</strong> ข้อมูลพยากรณ์อากาศและสถานีวัดน้ำที่แสดงในระบบเป็นการจำลองจากโมเดล scenario ที่ได้รับการรับรองความถูกต้อง.
            </p>
            <div className="text-[10px] font-mono text-gray-500">Mode: CALIBRATED_SIMULATION</div>
          </div>

          <div className="bg-surface p-4 rounded-xl border border-surface-border space-y-2">
            <div className="text-xs font-mono text-emerald-400 font-bold uppercase">Citizen Reports (First-Party)</div>
            <p className="text-xs text-gray-300">
              รายงานประชาชนเป็นข้อมูล <strong>LIVE</strong> แต่มีความเสี่ยงจาก human error หรือภาพถ่ายเก่า ระบบใช้ DBSCAN spatio-temporal clustering และ pHash deduplication ในการคัดกรอง.
            </p>
            <div className="text-[10px] font-mono text-gray-500">Freshness window: 15-120 min</div>
          </div>
        </div>
      </div>

      {/* SAFE NAVIGATION & ROUTING DISCLAIMER */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">5. ข้อควรระวังในการนำทางหลบน้ำท่วม (Routing Advisory)</h2>
            <div className="text-xs text-gray-400 font-mono">Dynamic Obstacle Avoidance Routing</div>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
          ระบบคำนวณเส้นทางจะหลีกเลี่ยงจุดที่มีรายงานน้ำท่วมระดับลึก แต่สภาพพื้นผิวถนน การระบายน้ำฉับพลัน หรือฝาท่อระบายน้ำที่ชำรุดอาจเปลี่ยนแปลงได้รวดเร็ว ผู้ขับขี่ต้องประเมินสถานการณ์จริงด้วยสายตาเสมอ <strong>ห้ามขับรถลุยน้ำที่เชี่ยวกรากหรือมีความลึกเกินกว่าระดับกึ่งกลางล้อรถ</strong> ไม่ว่าจะได้รับคำแนะนำเส้นทางใดจากระบบ.
        </p>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-surface-border text-xs text-gray-400">
        <div>
          KMITL Flood Intelligence — Release 26.0 (Phase 26 Limited Beta)
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-primary-400 hover:text-white transition-colors">
            Situation Summary
          </Link>
          <Link href="/help" className="text-red-400 hover:text-red-300 transition-colors">
            Emergency Assistance
          </Link>
          <Link href="/data" className="text-gray-300 hover:text-white transition-colors">
            Data Provenance
          </Link>
        </div>
      </div>
    </div>
  );
}
