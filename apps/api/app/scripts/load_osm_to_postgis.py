import asyncio
import glob
import xml.etree.ElementTree as ET
from typing import Dict, List, Tuple
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

def parse_osm_highways():
    files = sorted(glob.glob('/app/app/data/osm_raw/osm_cell*.xml'))
    print(f"Reading {len(files)} OSM XML files for PostGIS ingestion...")
    
    nodes: Dict[str, Tuple[float, float]] = {}
    ways: List[Dict] = []
    seen_way_ids = set()

    for f in files:
        tree = ET.parse(f)
        root = tree.getroot()
        for n in root.findall('node'):
            nid = n.get('id')
            nodes[nid] = (float(n.get('lon')), float(n.get('lat')))
        
        for w in root.findall('way'):
            wid = int(w.get('id'))
            if wid in seen_way_ids:
                continue
            tags = {tag.get('k'): tag.get('v') for tag in w.findall('tag')}
            if 'highway' not in tags:
                continue
            
            nd_refs = [nd.get('ref') for nd in w.findall('nd')]
            coords = [nodes[ref] for ref in nd_refs if ref in nodes]
            if len(coords) < 2:
                continue
            
            seen_way_ids.add(wid)
            name = tags.get('name') or tags.get('name:en') or tags.get('name:th')
            htype = tags.get('highway', 'road')
            
            # Baseline elevation around Lat Krabang (1.6 - 2.5m MSL)
            elevation = 1.9
            if 'motorway' in htype:
                elevation = 2.4
            elif 'primary' in htype:
                elevation = 2.1
            elif 'secondary' in htype:
                elevation = 1.8
            elif 'service' in htype:
                elevation = 1.6
                
            ways.append({
                'id': wid,
                'name': name[:150] if name else None,
                'highway_type': htype[:50],
                'coords': coords,
                'elevation_m': elevation
            })
            
    print(f"Found {len(ways)} unique OSM highways to ingest.")
    return ways

async def load_roads_to_postgis():
    highways = parse_osm_highways()
    
    async with AsyncSessionLocal() as session:
        # Clear existing empty/old records
        await session.execute(text("TRUNCATE TABLE roads CASCADE;"))
        await session.commit()
        
        batch_size = 500
        total_inserted = 0
        
        for i in range(0, len(highways), batch_size):
            batch = highways[i:i + batch_size]
            values = []
            params = {}
            for idx, h in enumerate(batch):
                # Build WKT LineString: LINESTRING(lon lat, lon lat, ...)
                coord_str = ", ".join(f"{lon:.7f} {lat:.7f}" for lon, lat in h['coords'])
                wkt = f"SRID=4326;LINESTRING({coord_str})"
                
                param_id = f"id_{idx}"
                param_name = f"name_{idx}"
                param_type = f"type_{idx}"
                param_elev = f"elev_{idx}"
                param_geom = f"geom_{idx}"
                
                values.append(
                    f"(:{param_id}, :{param_name}, :{param_type}, ST_GeomFromEWKT(:{param_geom}), :{param_elev}, 'UNKNOWN', 'UNKNOWN')"
                )
                params[param_id] = h['id']
                params[param_name] = h['name']
                params[param_type] = h['highway_type']
                params[param_elev] = h['elevation_m']
                params[param_geom] = wkt
                
            query_str = f"""
                INSERT INTO roads (id, name, highway_type, geometry, elevation_m, current_flood_exposure, current_depth_band)
                VALUES {', '.join(values)}
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    highway_type = EXCLUDED.highway_type,
                    geometry = EXCLUDED.geometry,
                    elevation_m = EXCLUDED.elevation_m;
            """
            await session.execute(text(query_str), params)
            await session.commit()
            total_inserted += len(batch)
            print(f"Inserted {total_inserted}/{len(highways)} OSM roads into PostGIS...")

        # Verify PostGIS spatial index & SRID
        result = await session.execute(text("""
            SELECT count(*) as count, ST_SRID(geometry) as srid, GeometryType(geometry) as geom_type
            FROM roads
            GROUP BY ST_SRID(geometry), GeometryType(geometry);
        """))
        rows = result.all()
        print("\n=== PostGIS Verification Result ===")
        for r in rows:
            print(f"Total: {r.count} roads | SRID: {r.srid} | GeometryType: {r.geom_type}")

if __name__ == '__main__':
    asyncio.run(load_roads_to_postgis())
