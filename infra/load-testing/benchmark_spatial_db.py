import math
import random
import time
import json
import statistics
from datetime import datetime, timezone


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


class SpatialIndexGrid:
    """
    High-performance 2D spatial grid index simulating PostGIS GIST spatial index.
    Partitions 100,000 records into grid cells of ~500m resolution.
    """
    def __init__(self, cell_size_deg=0.005):
        self.cell_size = cell_size_deg
        self.grid = {}
        self.records = []

    def _cell_key(self, lat, lng):
        return (int(lat / self.cell_size), int(lng / self.cell_size))

    def insert(self, record_id, lat, lng, payload):
        rec = {"id": record_id, "lat": lat, "lng": lng, "data": payload}
        self.records.append(rec)
        key = self._cell_key(lat, lng)
        if key not in self.grid:
            self.grid[key] = []
        self.grid[key].append(rec)

    def query_bbox(self, min_lng, min_lat, max_lng, max_lat):
        results = []
        min_cell_x = int(min_lat / self.cell_size)
        max_cell_x = int(max_lat / self.cell_size)
        min_cell_y = int(min_lng / self.cell_size)
        max_cell_y = int(max_lng / self.cell_size)

        for cx in range(min_cell_x, max_cell_x + 1):
            for cy in range(min_cell_y, max_cell_y + 1):
                cell = self.grid.get((cx, cy))
                if cell:
                    for item in cell:
                        if min_lat <= item["lat"] <= max_lat and min_lng <= item["lng"] <= max_lng:
                            results.append(item)
        return results

    def query_dwithin(self, center_lat, center_lng, radius_m):
        # Bounding box candidate filtering followed by exact spherical distance
        deg_radius = radius_m / 111000.0
        candidates = self.query_bbox(
            center_lng - deg_radius,
            center_lat - deg_radius,
            center_lng + deg_radius,
            center_lat + deg_radius
        )
        return [c for c in candidates if haversine_m(center_lat, center_lng, c["lat"], c["lng"]) <= radius_m]


def benchmark_spatial_scale(record_count=100000):
    print(f"\n=======================================================")
    print(f"BENCHMARKING SPATIAL DATABASE SCALE: {record_count:,} RECORDS")
    print(f"=======================================================")

    t0_gen = time.perf_counter()
    index = SpatialIndexGrid()

    # Center around Lat Krabang (13.7298, 100.7782)
    base_lat, base_lng = 13.7298, 100.7782

    depth_bands = ["10_TO_20CM", "20_TO_40CM", "40_TO_60CM", "ABOVE_60CM"]
    passability = ["PASSABLE", "DIFFICULT", "IMPASSABLE"]

    print(f"Generating and indexing {record_count:,} spatial records...")
    random.seed(42)
    for i in range(record_count):
        # Gaussian distribution around KMITL + Lat Krabang district
        lat = random.gauss(base_lat, 0.04)
        lng = random.gauss(base_lng, 0.05)
        index.insert(
            record_id=f"RPT-{i:06d}",
            lat=lat,
            lng=lng,
            payload={
                "depth": random.choice(depth_bands),
                "passability": random.choice(passability),
                "timestamp": time.time() - random.randint(60, 86400 * 7)
            }
        )

    t_indexed = time.perf_counter()
    print(f"Indexing complete in {t_indexed - t0_gen:.2f}s ({(record_count / (t_indexed - t0_gen)):,.0f} records/sec)")

    # 1. Bounding Box Queries (Simulating Map Viewport requests: 1,000 queries)
    print("\nRunning 1,000 Map Viewport Bounding Box queries...")
    bbox_times = []
    bbox_counts = []
    for _ in range(1000):
        c_lat = random.uniform(base_lat - 0.03, base_lat + 0.03)
        c_lng = random.uniform(base_lng - 0.04, base_lng + 0.04)
        t_q0 = time.perf_counter()
        matches = index.query_bbox(c_lng - 0.015, c_lat - 0.015, c_lng + 0.015, c_lat + 0.015)
        t_q1 = time.perf_counter()
        bbox_times.append((t_q1 - t_q0) * 1000.0)
        bbox_counts.append(len(matches))

    # 2. ST_DWithin Queries (Simulating Nearby Incident & SOS Proximity: 1,000 queries)
    print("Running 1,000 ST_DWithin (500m radius) proximity queries...")
    dwithin_times = []
    dwithin_counts = []
    for _ in range(1000):
        c_lat = random.uniform(base_lat - 0.03, base_lat + 0.03)
        c_lng = random.uniform(base_lng - 0.04, base_lng + 0.04)
        t_q0 = time.perf_counter()
        matches = index.query_dwithin(c_lat, c_lng, radius_m=500.0)
        t_q1 = time.perf_counter()
        dwithin_times.append((t_q1 - t_q0) * 1000.0)
        dwithin_counts.append(len(matches))

    def stats(series):
        s = sorted(series)
        return {
            "p50_ms": round(statistics.median(s), 2),
            "p95_ms": round(s[int(len(s) * 0.95)], 2),
            "p99_ms": round(s[int(len(s) * 0.99)], 2),
            "max_ms": round(max(s), 2),
            "min_ms": round(min(s), 2)
        }

    results = {
        "dataset_size_records": record_count,
        "indexing_throughput_records_sec": round(record_count / (t_indexed - t0_gen), 1),
        "viewport_bbox_1000_queries": {
            "latency": stats(bbox_times),
            "avg_matches_per_query": round(statistics.mean(bbox_counts), 1),
            "throughput_queries_sec": round(1000.0 / sum(bbox_times) * 1000.0, 1)
        },
        "dwithin_500m_1000_queries": {
            "latency": stats(dwithin_times),
            "avg_matches_per_query": round(statistics.mean(dwithin_counts), 1),
            "throughput_queries_sec": round(1000.0 / sum(dwithin_times) * 1000.0, 1)
        }
    }

    with open("infra/load-testing/spatial_scale_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n--- SPATIAL QUERY BENCHMARK RESULTS (100k Records) ---")
    print(f"Viewport Bbox Query:   p50 = {results['viewport_bbox_1000_queries']['latency']['p50_ms']} ms | p95 = {results['viewport_bbox_1000_queries']['latency']['p95_ms']} ms | Throughput = {results['viewport_bbox_1000_queries']['throughput_queries_sec']:,} QPS")
    print(f"ST_DWithin 500m Query: p50 = {results['dwithin_500m_1000_queries']['latency']['p50_ms']} ms | p95 = {results['dwithin_500m_1000_queries']['latency']['p95_ms']} ms | Throughput = {results['dwithin_500m_1000_queries']['throughput_queries_sec']:,} QPS")


if __name__ == "__main__":
    benchmark_spatial_scale(100000)
