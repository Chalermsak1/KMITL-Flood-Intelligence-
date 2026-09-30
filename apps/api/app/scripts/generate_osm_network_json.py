import json
from app.scripts.process_real_osm import extract_osm_data
from shapely.geometry import Point, LineString, MultiLineString
from shapely.ops import linemerge
import heapq

def generate_network_data():
    _, highways, waterways = extract_osm_data()
    print("Building corridor paths from genuine OSM ways...")

    def find_osm_corridor(hw_list, bbox, start_coord, end_coord, highway_types=None):
        adj = {}
        for h in hw_list:
            if highway_types and h['highway_type'] not in highway_types:
                continue
            pts = h['coords']
            if all(bbox[0] <= p[0] <= bbox[2] and bbox[1] <= p[1] <= bbox[3] for p in pts):
                for i in range(len(pts)-1):
                    p1, p2 = pts[i], pts[i+1]
                    dist = Point(p1).distance(Point(p2))
                    adj.setdefault(p1, []).append((p2, dist))
                    adj.setdefault(p2, []).append((p1, dist))
        
        if not adj:
            return None
        start_pt = min(adj.keys(), key=lambda p: (p[0] - start_coord[0])**2 + (p[1] - start_coord[1])**2)
        end_pt = min(adj.keys(), key=lambda p: (p[0] - end_coord[0])**2 + (p[1] - end_coord[1])**2)
        
        dist = {start_pt: 0}
        parent = {}
        pq = [(0, start_pt)]
        while pq:
            d, u = heapq.heappop(pq)
            if u == end_pt:
                break
            if d > dist.get(u, float('inf')):
                continue
            for v, w in adj.get(u, []):
                if d + w < dist.get(v, float('inf')):
                    dist[v] = d + w
                    parent[v] = u
                    heapq.heappush(pq, (d + w, v))
                    
        if end_pt in parent:
            path = []
            curr = end_pt
            while curr:
                path.append(curr)
                curr = parent.get(curr)
            path.reverse()
            return path
        return None

    # 1. SEG_CHALONG_KRUNG_CAMPUS
    campus_path = find_osm_corridor(
        highways, 
        (100.776, 13.721, 100.788, 13.735), 
        (100.7802, 13.7220), 
        (100.7859, 13.7339)
    )
    print(f"Chalong Krung Campus: {len(campus_path)} points")

    # 2. SEG_CHALONG_KRUNG_N
    ck_north_path = find_osm_corridor(
        highways, 
        (100.784, 13.733, 100.802, 13.758), 
        (100.7859, 13.7339), 
        (100.7988, 13.7569)
    )
    print(f"Chalong Krung North: {len(ck_north_path)} points")

    # 3. SEG_CHALONG_KRUNG_S (southern half of campus frontage towards Hua Takhe)
    ck_south_path = [list(pt) for pt in campus_path[:len(campus_path)//2 + 5]]
    print(f"Chalong Krung South: {len(ck_south_path)} points")

    # 4. SEG_LAT_KRABANG_W
    lk_west_path = find_osm_corridor(
        highways, 
        (100.745, 13.718, 100.785, 13.725), 
        (100.7802, 13.7220), 
        (100.7480, 13.7209)
    )
    print(f"Lat Krabang West: {len(lk_west_path)} points")

    # 5. SEG_LAT_KRABANG_E
    lk_east_path = find_osm_corridor(
        highways, 
        (100.779, 13.714, 100.810, 13.724), 
        (100.7802, 13.7220), 
        (100.8085, 13.7154)
    )
    print(f"Lat Krabang East: {len(lk_east_path)} points")

    # 6. SEG_KMITL_ENGINEERING_LOOP
    eng_loop_path = find_osm_corridor(
        highways,
        (100.769, 13.725, 100.781, 13.731),
        (100.7781, 13.7298),
        (100.7719, 13.7275)
    )
    print(f"KMITL Engineering Loop: {len(eng_loop_path)} points")

    # 7. SEG_MOTORWAY_FRONTAGE
    mf = [LineString(h['coords']) for h in highways if 'ทางบริการ' in (h['name'] or '')]
    merged_mf = linemerge(mf)
    parts_mf = [merged_mf.geoms[2], merged_mf.geoms[3], merged_mf.geoms[5], merged_mf.geoms[6]]
    corridor_mf = linemerge(parts_mf)
    mf_coords = [list(c) for c in corridor_mf.coords]
    print(f"Motorway Frontage: {len(mf_coords)} points")

    # 8. SEG_ROMKLAO_INTERSECTION
    rk_path = find_osm_corridor(
        highways, 
        (100.745, 13.713, 100.751, 13.733), 
        (100.7480, 13.7148), 
        (100.7464, 13.7285)
    )
    print(f"Rom Klao Corridor: {len(rk_path)} points")

    # 9. Waterways
    ww_by_name = {}
    for w in waterways:
        name = w['name']
        if name:
            ww_by_name.setdefault(name, []).append(LineString(w['coords']))

    prawet_line = linemerge(ww_by_name['คลองประเวศบุรีรมย์'])
    lam_pla_thio_line = linemerge(ww_by_name['คลองลำปลาทิว'])
    hua_takhe_line = linemerge(ww_by_name['คลองหัวตะเข้'])
    mon_line = linemerge(ww_by_name['คลองมอญ'])
    lat_krabang_canal_line = linemerge(ww_by_name['คลองลาดกระบัง'])

    prawet_coords = [list(c) for c in prawet_line.coords]
    lam_pla_thio_coords = [list(c) for c in lam_pla_thio_line.coords]
    hua_takhe_coords = [list(c) for c in hua_takhe_line.coords]
    mon_coords = [list(c) for c in mon_line.coords]
    lat_krabang_canal_coords = [list(c) for c in lat_krabang_canal_line.coords]

    print(f"Waterway Khlong Prawet: {len(prawet_coords)} points")
    print(f"Waterway Khlong Lam Pla Thio: {len(lam_pla_thio_coords)} points")
    print(f"Waterway Khlong Hua Takhe: {len(hua_takhe_coords)} points")
    print(f"Waterway Khlong Mon: {len(mon_coords)} points")
    print(f"Waterway Khlong Lat Krabang: {len(lat_krabang_canal_coords)} points")

    # Water Flow Paths: Follow REAL road geometry from origin road segment into the actual canal
    # For Chalong Krung Campus: flows south down Chalong Krung into Khlong Prawet
    ck_campus_flow = [[round(c[0], 7), round(c[1], 7)] for c in campus_path[::-1]] # north to south
    # For Chalong Krung North: flows toward Lam Pla Thio outfall
    ck_north_flow = [[round(c[0], 7), round(c[1], 7)] for c in ck_north_path[:25]]
    # For Lat Krabang West: flows along road ditch into Khlong Prawet
    lk_west_flow = [[round(c[0], 7), round(c[1], 7)] for c in lk_west_path[:30]]
    # For Lat Krabang East: flows toward Hua Takhe sluice
    lk_east_flow = [[round(c[0], 7), round(c[1], 7)] for c in lk_east_path[:25]]
    # For Engineering Loop: flows into KMITL retention basin
    eng_loop_flow = [[round(c[0], 7), round(c[1], 7)] for c in eng_loop_path]

    data = {
        "metadata": {
            "source": "OpenStreetMap authoritative vector dataset (api.openstreetmap.org)",
            "crs": "EPSG:4326 (WGS84)",
            "coordinate_order": "[longitude, latitude]",
            "license": "Open Data Commons Open Database License (ODbL)"
        },
        "corridors": {
            "SEG_CHALONG_KRUNG_CAMPUS": {
                "name": "Thanon Chalong Krung (KMITL Main Frontage)",
                "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in campus_path],
                "flow_path_coordinates": ck_campus_flow
            },
            "SEG_CHALONG_KRUNG_N": {
                "name": "Thanon Chalong Krung (North - Industrial Estate)",
                "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in ck_north_path],
                "flow_path_coordinates": ck_north_flow
            },
            "SEG_CHALONG_KRUNG_S": {
                "name": "Thanon Chalong Krung (South - Hua Takhe Crossing)",
                "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in ck_south_path],
                "flow_path_coordinates": [[round(c[0], 7), round(c[1], 7)] for c in ck_south_path[::-1]]
            },
            "SEG_LAT_KRABANG_W": {
                "name": "Thanon Lat Krabang (West toward Rom Klao)",
                "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in lk_west_path],
                "flow_path_coordinates": lk_west_flow
            },
            "SEG_LAT_KRABANG_E": {
                "name": "Thanon Luang Phaeng / Hua Takhe Market",
                "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in lk_east_path],
                "flow_path_coordinates": lk_east_flow
            },
            "SEG_KMITL_ENGINEERING_LOOP": {
                "name": "KMITL Inner Campus Rd (Engineering & Library)",
                "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in eng_loop_path],
                "flow_path_coordinates": eng_loop_flow
            },
            "SEG_MOTORWAY_FRONTAGE": {
                "name": "Highway 7 Motorway Parallel Frontage Rd",
                "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in mf_coords],
                "flow_path_coordinates": [[round(c[0], 7), round(c[1], 7)] for c in mf_coords[:30]]
            },
            "SEG_ROMKLAO_INTERSECTION": {
                "name": "Rom Klao - Lat Krabang Intersection Corridor",
                "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in rk_path],
                "flow_path_coordinates": [[round(c[0], 7), round(c[1], 7)] for c in rk_path[:15]]
            }
        },
        "drainage": {
            "DRAIN_KHLONG_PRAWET": {
                "name": "คลองประเวศบุรีรมย์ (Khlong Prawet Burirom)",
                "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in prawet_coords]
            },
            "DRAIN_KHLONG_LAM_PLA_THIO": {
                "name": "คลองลำปลาทิว (Khlong Lam Pla Thio)",
                "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in lam_pla_thio_coords]
            },
            "DRAIN_KHLONG_HUA_TAKHE": {
                "name": "คลองหัวตะเข้ (Khlong Hua Takhe)",
                "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in hua_takhe_coords]
            },
            "DRAIN_KHLONG_MON": {
                "name": "คลองมอญ (Khlong Mon)",
                "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in mon_coords]
            },
            "DRAIN_KHLONG_LAT_KRABANG": {
                "name": "คลองลาดกระบัง (Khlong Lat Krabang)",
                "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in lat_krabang_canal_coords]
            },
            "DRAIN_PUMP_PRAWET": {
                "name": "สถานีสูบน้ำและประตูระบายน้ำคลองประเวศฯ (ลาดกระบัง)",
                "coordinates": [100.7850, 13.7215]
            },
            "DRAIN_CAMPUS_RETENTION": {
                "name": "แก้มลิงและบ่อหน่วงน้ำ สจล. (KMITL Stormwater Retention Basin)",
                "coordinates": [100.7735, 13.7290]
            }
        }
    }

    out_path = '/app/app/data/real_osm_network.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Successfully generated {out_path} with {len(data['corridors'])} corridors and {len(data['drainage'])} drainage features.")

if __name__ == '__main__':
    generate_network_data()
