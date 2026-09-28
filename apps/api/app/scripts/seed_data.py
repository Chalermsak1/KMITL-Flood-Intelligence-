import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from app.core.database import AsyncSessionLocal
from app.models.entities import DataSource, WaterStation, WaterObservation, AssistancePoint, FloodReport, Incident
from app.models.enums import WaterDepthBand, VehiclePassability, TransportType, ReportFreshness, ConfidenceLevel, IncidentStatus


async def seed():
    print("🌱 Seeding KMITL Flood Intelligence database...")
    async with AsyncSessionLocal() as session:
        now = datetime.now(timezone.utc)

        # 1. Seed Data Sources Registry
        sources = [
            DataSource(
                id="SRC_TMD_WEATHER",
                name="Thai Meteorological Department",
                source_type="TMD",
                endpoint_url="https://data.tmd.go.th/api/WeatherToday/V2/",
                update_frequency_minutes=15,
                reliability_score=0.90,
                attribution="Thai Meteorological Department (Open Data)",
                license="Open Government License Thailand",
                is_active=True
            ),
            DataSource(
                id="SRC_BMA_DDS",
                name="BMA Department of Drainage and Sewerage",
                source_type="BMA_WATER",
                endpoint_url="http://dds.bangkok.go.th/",
                update_frequency_minutes=15,
                reliability_score=0.88,
                attribution="Bangkok Metropolitan Administration (DDS)",
                license="Open Government License Thailand",
                is_active=True
            ),
            DataSource(
                id="SRC_TRAFFY_FONDUE",
                name="Traffy Fondue Platform",
                source_type="TRAFFY",
                endpoint_url="https://citydata.traffy.in.th/",
                update_frequency_minutes=60,
                reliability_score=0.75,
                attribution="Traffy Fondue Platform (NECTEC/BMA)",
                license="Open Data",
                is_active=True
            ),
            DataSource(
                id="SRC_COPERNICUS_S1",
                name="Copernicus Sentinel-1 SAR",
                source_type="SATELLITE",
                endpoint_url="https://catalogue.dataspace.copernicus.eu/stac",
                update_frequency_minutes=1440,
                reliability_score=0.95,
                attribution="European Space Agency (ESA) Copernicus",
                license="Copernicus Open Access Policy",
                is_active=True
            )
        ]
        for src in sources:
            await session.merge(src)

        # 2. Seed Water Stations (Lat Krabang Canal Network)
        stations = [
            WaterStation(
                id="BMA_STN_PRAWET_LOCK",
                name="ประตูระบายน้ำคลองประเวศบุรีรมย์ (ลาดกระบัง)",
                source_id="SRC_BMA_DDS",
                station_type="CANAL_GAUGE",
                location="SRID=4326;POINT(100.7850 13.7215)",
                warning_threshold_meters=0.80,
                critical_threshold_meters=1.20
            ),
            WaterStation(
                id="BMA_STN_LAM_PLA_THIO",
                name="สถานีวัดระดับน้ำคลองลำปลาทิว (นิคมลาดกระบัง)",
                source_id="SRC_BMA_DDS",
                station_type="CANAL_GAUGE",
                location="SRID=4326;POINT(100.7930 13.7480)",
                warning_threshold_meters=0.75,
                critical_threshold_meters=1.10
            ),
            WaterStation(
                id="BMA_STN_HUA_TAKHE",
                name="สถานีวัดระดับน้ำคลองหัวตะเข้ (ชุมชนตลาดเก่า)",
                source_id="SRC_BMA_DDS",
                station_type="CANAL_GAUGE",
                location="SRID=4326;POINT(100.7890 13.7230)",
                warning_threshold_meters=0.70,
                critical_threshold_meters=1.05
            )
        ]
        for stn in stations:
            await session.merge(stn)

        # 3. Seed Water Observations
        observations = [
            WaterObservation(
                station_id="BMA_STN_PRAWET_LOCK",
                water_level_m_msl=0.88,
                water_delta_10m=0.04,
                water_delta_30m=0.12,
                water_delta_60m=0.22,
                trend="RISING",
                observed_at=now - timedelta(minutes=4)
            ),
            WaterObservation(
                station_id="BMA_STN_LAM_PLA_THIO",
                water_level_m_msl=0.72,
                water_delta_10m=0.01,
                water_delta_30m=0.05,
                water_delta_60m=0.08,
                trend="RISING",
                observed_at=now - timedelta(minutes=6)
            ),
            WaterObservation(
                station_id="BMA_STN_HUA_TAKHE",
                water_level_m_msl=0.65,
                water_delta_10m=0.02,
                water_delta_30m=0.04,
                water_delta_60m=0.06,
                trend="STABLE",
                observed_at=now - timedelta(minutes=5)
            )
        ]
        for obs in observations:
            session.add(obs)

        # 4. Seed Assistance Points
        shelters = [
            AssistancePoint(
                name="ศูนย์พักพิงชั่วคราว หอประชุมเจ้าพระยาสุรวงษ์ไวยวัฒน์ (KMITL Auditorium)",
                point_type="SHELTER",
                location="SRID=4326;POINT(100.7755 13.7295)",
                capacity=350,
                current_occupancy=45,
                is_verified=True,
                contact_number="02-329-8000 ต่อ 3100",
                operating_hours="24 ชั่วโมง",
                last_verified_at=now
            ),
            AssistancePoint(
                name="จุดปฐมพยาบาลและศูนย์การแพทย์ คณะแพทยศาสตร์ สจล.",
                point_type="MEDICAL",
                location="SRID=4326;POINT(100.7812 13.7315)",
                capacity=80,
                current_occupancy=12,
                is_verified=True,
                contact_number="02-329-8100",
                operating_hours="24 ชั่วโมง",
                last_verified_at=now
            ),
            AssistancePoint(
                name="จุดรับส่งเรือฉุกเฉิน ท่าเรือคลองประเวศบุรีรมย์ (สะพานขาว สจล.)",
                point_type="BOAT_PICKUP",
                location="SRID=4326;POINT(100.7760 13.7268)",
                capacity=None,
                current_occupancy=0,
                is_verified=True,
                contact_number="081-999-8877",
                operating_hours="06:00 - 22:00",
                last_verified_at=now
            )
        ]
        for sh in shelters:
            session.add(sh)

        # 5. Seed Baseline Incidents & Reports
        incident_1 = Incident(
            title="น้ำท่วมขังผิวถนนฉลองกรุง (หน้าประตูใหญ่ สจล.)",
            centroid="SRID=4326;POINT(100.7782 13.7298)",
            report_count=8,
            consensus_depth_band=WaterDepthBand.DEPTH_20_TO_40CM,
            consensus_passability=VehiclePassability.DIFFICULT,
            confidence=ConfidenceLevel.HIGH,
            status=IncidentStatus.ACTIVE,
            first_reported_at=now - timedelta(minutes=45),
            last_reported_at=now - timedelta(minutes=3),
            admin_notes="มีเจ้าหน้าที่เทศกิจกำลังเร่งสูบระบายน้ำลงคลองประเวศฯ"
        )
        session.add(incident_1)
        await session.flush()

        reports = [
            FloodReport(
                location="SRID=4326;POINT(100.7780 13.7297)",
                water_depth_band=WaterDepthBand.DEPTH_20_TO_40CM,
                vehicle_passability=VehiclePassability.DIFFICULT,
                transport_type=TransportType.CAR,
                description="น้ำท่วมขังเลนซ้ายสูงเกือบครึ่งล้อรถเก๋ง มอเตอร์ไซค์ต้องวิ่งเลนขวา",
                confidence=ConfidenceLevel.HIGH,
                freshness=ReportFreshness.FRESH,
                observed_at=now - timedelta(minutes=3),
                expires_at=now + timedelta(hours=2),
                incident_id=incident_1.id
            ),
            FloodReport(
                location="SRID=4326;POINT(100.7785 13.7300)",
                water_depth_band=WaterDepthBand.DEPTH_20_TO_40CM,
                vehicle_passability=VehiclePassability.DIFFICULT,
                transport_type=TransportType.MOTORCYCLE,
                description="ขี่มอเตอร์ไซค์ระวังคลื่นน้ำซัด ท่วมสูงระดับแข้ง",
                confidence=ConfidenceLevel.HIGH,
                freshness=ReportFreshness.FRESH,
                observed_at=now - timedelta(minutes=7),
                expires_at=now + timedelta(hours=2),
                incident_id=incident_1.id
            )
        ]
        for rep in reports:
            session.add(rep)

        await session.commit()
        print("✅ Database successfully seeded with baseline data!")


if __name__ == "__main__":
    asyncio.run(seed())
