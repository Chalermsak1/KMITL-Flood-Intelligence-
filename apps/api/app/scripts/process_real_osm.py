import glob
import json
import xml.etree.ElementTree as ET
from typing import Dict, List, Tuple
from shapely.geometry import LineString, MultiLineString, Point, mapping
from shapely.ops import linemerge, unary_union

def extract_osm_data():
    import os
    raw_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "osm_raw")
    if not os.path.exists(raw_dir):
        raw_dir = "/app/app/data/osm_raw"
    files = sorted(glob.glob(os.path.join(raw_dir, "osm_cell*.xml")))
    print(f"Reading {len(files)} OSM XML files from {raw_dir}...")
    
    nodes: Dict[str, Tuple[float, float]] = {}
    highways: List[Dict] = []
    waterways: List[Dict] = []
    
    for f in files:
        tree = ET.parse(f)
        root = tree.getroot()
        for n in root.findall('node'):
            nid = n.get('id')
            nodes[nid] = (float(n.get('lon')), float(n.get('lat')))
        
        for w in root.findall('way'):
            wid = int(w.get('id'))
            tags = {tag.get('k'): tag.get('v') for tag in w.findall('tag')}
            nd_refs = [nd.get('ref') for nd in w.findall('nd')]
            coords = [nodes[ref] for ref in nd_refs if ref in nodes]
            if len(coords) < 2:
                continue
            
            if 'highway' in tags:
                highways.append({
                    'id': wid,
                    'name': tags.get('name') or tags.get('name:en') or tags.get('name:th'),
                    'highway_type': tags.get('highway'),
                    'coords': coords,
                    'tags': tags
                })
            elif 'waterway' in tags:
                waterways.append({
                    'id': wid,
                    'name': tags.get('name') or tags.get('name:en') or tags.get('name:th'),
                    'waterway_type': tags.get('waterway'),
                    'coords': coords,
                    'tags': tags
                })
                
    print(f"Extracted {len(nodes)} nodes, {len(highways)} highways, {len(waterways)} waterways.")
    return nodes, highways, waterways

if __name__ == '__main__':
    extract_osm_data()
