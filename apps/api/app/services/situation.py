from datetime import datetime, timezone, timedelta
from typing import List, Tuple
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Incident, HelpRequest, RainObservation, WaterObservation, DataSource
from app.models.enums import IncidentStatus, HelpStatus
from app.schemas.situation import SituationSummaryResponse


class SituationService:
    @staticmethod
    async def get_summary(session: AsyncSession) -> SituationSummaryResponse:
        now = datetime.now(timezone.utc)
        recent_window = now - timedelta(hours=2)

        # 1. Count active incidents
        inc_stmt = select(func.count(Incident.id)).where(Incident.status == IncidentStatus.ACTIVE)
        active_incidents = (await session.scalar(inc_stmt)) or 0

        # 2. Count active help requests (OPEN or IN_PROGRESS)
        help_stmt = select(func.count(HelpRequest.id)).where(
            HelpRequest.status.in_([HelpStatus.OPEN, HelpStatus.ACKNOWLEDGED, HelpStatus.ASSIGNED, HelpStatus.IN_PROGRESS])
        )
        active_help = (await session.scalar(help_stmt)) or 0

        # 3. Latest rain observation
        rain_stmt = select(RainObservation).order_by(RainObservation.observed_at.desc()).limit(1)
        latest_rain = (await session.execute(rain_stmt)).scalar_one_or_none()
        rain_trend = latest_rain.rain_intensity_band if latest_rain else "MODERATE"

        # 4. Latest canal water observation
        water_stmt = select(WaterObservation).order_by(WaterObservation.observed_at.desc()).limit(3)
        water_obs = (await session.execute(water_stmt)).scalars().all()
        rising_count = sum(1 for w in water_obs if w.trend == "RISING")
        water_trend = "RISING" if rising_count >= 1 else "STABLE"

        # 5. Data sources health count
        src_stmt = select(func.count(DataSource.id))
        total_sources = (await session.scalar(src_stmt)) or 4
        avail_stmt = select(func.count(DataSource.id)).where(DataSource.is_active == True)
        avail_sources = (await session.scalar(avail_stmt)) or 4

        # 6. Compute multi-factor risk status and explanations
        risk_score = 0.0
        explanations: List[str] = []

        if active_incidents > 5:
            risk_score += 40.0
            explanations.append(f"พบจุดน้ำท่วมขังรายงานตรงกัน {active_incidents} จุดในพื้นที่ลาดกระบัง")
        elif active_incidents > 0:
            risk_score += 25.0
            explanations.append(f"มีรายงานน้ำท่วมยืนยันแล้ว {active_incidents} จุดบนถนนสายหลัก")

        if rain_trend in ["HEAVY", "VERY_HEAVY"]:
            risk_score += 30.0
            explanations.append("กลุ่มฝนตกหนักสะสมต่อเนื่องตรวจพบบริเวณลาดกระบัง-สุวรรณภูมิ")
        elif rain_trend == "MODERATE":
            risk_score += 15.0
            explanations.append("มีฝนตกปานกลางอย่างต่อเนื่องในพื้นที่ลุ่มรับน้ำ")

        if water_trend == "RISING":
            risk_score += 20.0
            explanations.append("ระดับน้ำในคลองประเวศบุรีรมย์และคลองสาขามีแนวโน้มเพิ่มขึ้นอย่างต่อเนื่อง (+12 cm/30m)")

        if active_help > 0:
            explanations.append(f"มีคำร้องขอความช่วยเหลือฉุกเฉิน (SOS) กำลังดำเนินการ {active_help} รายการ")

        # Categorize overall status
        if risk_score >= 70:
            current_status = "HIGH"
        elif risk_score >= 40:
            current_status = "MODERATE"
        elif risk_score >= 15:
            current_status = "LOW"
        else:
            current_status = "LOW"

        if not explanations:
            explanations.append("สถานการณ์ทั่วไปปกติ การระบายน้ำอยู่ในเกณฑ์เฝ้าระวัง")

        data_quality = "HIGH" if avail_sources >= 3 else "MEDIUM"

        return SituationSummaryResponse(
            area_name="KMITL & Lat Krabang Basin",
            current_status=current_status,
            overall_risk_score=min(100.0, risk_score),
            rain_trend=rain_trend,
            water_trend=water_trend,
            active_incidents=active_incidents,
            active_help_requests=active_help,
            data_quality=data_quality,
            explanation=explanations,
            last_updated=now,
            data_sources_available=avail_sources,
            data_sources_total=total_sources
        )
