import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.cluster import DBSCAN
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.functions import ST_X, ST_Y, ST_AsGeoJSON

from app.models.entities import FloodReport, Incident
from app.models.enums import IncidentStatus, WaterDepthBand, VehiclePassability, ConfidenceLevel
from app.core.redis import publish_event


def haversine_distance(coord1: tuple, coord2: tuple) -> float:
    """Calculate distance in meters between two (lat, lng) points."""
    R = 6371000.0  # Earth radius in meters
    lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
    lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2.0)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


class SpatioTemporalClusteringService:
    def __init__(self, distance_threshold_meters: float = 150.0, time_window_minutes: float = 45.0):
        self.distance_threshold = distance_threshold_meters
        self.time_window_seconds = time_window_minutes * 60.0

    async def cluster_active_reports(self, session: AsyncSession) -> int:
        """
        Gathers recent unexpired reports, clusters them spatio-temporally,
        updates or creates Incident records, and publishes WebSocket notifications.
        """
        now = datetime.now(timezone.utc)
        cutoff_time = now - timedelta(hours=2)

        # Query recent active reports
        query = select(
            FloodReport.id,
            ST_Y(FloodReport.location).label("lat"),
            ST_X(FloodReport.location).label("lng"),
            FloodReport.water_depth_band,
            FloodReport.vehicle_passability,
            FloodReport.observed_at,
            FloodReport.incident_id
        ).where(
            FloodReport.observed_at >= cutoff_time
        )

        result = await session.execute(query)
        rows = result.all()

        if len(rows) < 2:
            return 0

        # Construct feature matrix for custom metric or distance matrix
        n = len(rows)
        dist_matrix = np.zeros((n, n))

        for i in range(n):
            for j in range(i, n):
                if i == j:
                    dist_matrix[i][j] = 0.0
                else:
                    # Spatial distance
                    s_dist = haversine_distance(
                        (rows[i].lat, rows[i].lng),
                        (rows[j].lat, rows[j].lng)
                    )
                    # Temporal distance
                    t_diff = abs((rows[i].observed_at - rows[j].observed_at).total_seconds())

                    # If spatial distance > threshold or temporal difference > time window, separate clusters
                    if s_dist <= self.distance_threshold and t_diff <= self.time_window_seconds:
                        combined_cost = s_dist
                    else:
                        combined_cost = 999999.0  # Far away

                    dist_matrix[i][j] = combined_cost
                    dist_matrix[j][i] = combined_cost

        # Execute DBSCAN with precomputed distance
        db = DBSCAN(eps=self.distance_threshold, min_samples=2, metric="precomputed")
        labels = db.fit_predict(dist_matrix)

        clusters_formed = 0
        unique_labels = set(labels)

        for label in unique_labels:
            if label == -1:
                continue  # Noise / unclustered single report

            cluster_indices = [idx for idx, l in enumerate(labels) if l == label]
            cluster_rows = [rows[idx] for idx in cluster_indices]

            # Compute centroid
            avg_lat = sum(r.lat for r in cluster_rows) / len(cluster_rows)
            avg_lng = sum(r.lng for r in cluster_rows) / len(cluster_rows)

            # Consensus water depth (most severe reported)
            depth_order = [
                WaterDepthBand.ABOVE_60CM,
                WaterDepthBand.DEPTH_40_TO_60CM,
                WaterDepthBand.DEPTH_20_TO_40CM,
                WaterDepthBand.DEPTH_10_TO_20CM,
                WaterDepthBand.BELOW_10CM,
                WaterDepthBand.UNKNOWN
            ]
            cluster_depths = [r.water_depth_band for r in cluster_rows]
            consensus_depth = WaterDepthBand.UNKNOWN
            for d in depth_order:
                if d in cluster_depths:
                    consensus_depth = d
                    break

            # Confidence based on report count
            confidence = ConfidenceLevel.HIGH if len(cluster_rows) >= 4 else ConfidenceLevel.MEDIUM

            # Check if any report already belongs to an incident
            existing_incident_id = next((r.incident_id for r in cluster_rows if r.incident_id), None)

            if existing_incident_id:
                # Update existing incident
                await session.execute(
                    update(Incident)
                    .where(Incident.id == existing_incident_id)
                    .values(
                        report_count=len(cluster_rows),
                        consensus_depth_band=consensus_depth,
                        confidence=confidence,
                        last_reported_at=max(r.observed_at for r in cluster_rows),
                        updated_at=now
                    )
                )
                incident_id = existing_incident_id
            else:
                # Create new Incident
                new_incident = Incident(
                    title=f"จุดน้ำท่วมขัง {consensus_depth.value} (รายงาน {len(cluster_rows)} ครั้ง)",
                    centroid=f"SRID=4326;POINT({avg_lng} {avg_lat})",
                    report_count=len(cluster_rows),
                    consensus_depth_band=consensus_depth,
                    consensus_passability=VehiclePassability.DIFFICULT,
                    confidence=confidence,
                    status=IncidentStatus.ACTIVE,
                    first_reported_at=min(r.observed_at for r in cluster_rows),
                    last_reported_at=max(r.observed_at for r in cluster_rows)
                )
                session.add(new_incident)
                await session.flush()
                incident_id = new_incident.id
                clusters_formed += 1

            # Associate reports with this incident
            report_ids = [r.id for r in cluster_rows]
            await session.execute(
                update(FloodReport)
                .where(FloodReport.id.in_(report_ids))
                .values(incident_id=incident_id)
            )

            # Broadcast update via WebSocket
            await publish_event("INCIDENT_UPDATED", {
                "incident_id": str(incident_id),
                "latitude": avg_lat,
                "longitude": avg_lng,
                "report_count": len(cluster_rows),
                "depth_band": consensus_depth.value,
                "confidence": confidence.value
            })

        await session.commit()
        return clusters_formed
