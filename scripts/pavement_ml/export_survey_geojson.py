#!/usr/bin/env python3
"""
Export romdas_sections joined to road_network.geojson geometry.

Produces public/data/romdas_survey_sections.geojson — a FeatureCollection
where each feature is a road link with real ROMDAS IRI survey data as
properties. Used by the frontend to render actual survey condition overlay
(distinct from HDM-4 model predictions).

Usage:
  python export_survey_geojson.py
"""

import json, sqlite3
from pathlib import Path
from datetime import datetime

BASE    = Path(__file__).resolve().parents[2]
DB_PATH = str(BASE / 'traffic_platform.db')
GEOJSON_IN  = BASE / 'public' / 'road_network.geojson'
GEOJSON_OUT = BASE / 'public' / 'data' / 'romdas_survey_sections.geojson'


IRI_COLOR = {
    'Good':      '#22c55e',   # green
    'Fair':      '#eab308',   # yellow
    'Poor':      '#f97316',   # orange
    'Very Poor': '#ef4444',   # red
}


def main():
    # Load road network geometry indexed by link_id
    with open(GEOJSON_IN, encoding='utf-8') as f:
        network = json.load(f)

    geom_index = {}
    for feat in network['features']:
        lid = feat['properties'].get('link_id', '')
        if lid:
            geom_index[lid] = feat['geometry']

    # Load all romdas_sections from DB
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("""
        SELECT link_id, road_name, region, section_start_m, section_end_m,
               section_length_km, survey_year, mean_iri, sd_iri, pct_above_9,
               max_rut_mm, mean_rut_mm, condition_class, vci, surface_type
        FROM   romdas_sections
        WHERE  link_id GLOB '*_Link*'
        ORDER  BY link_id, survey_year
    """).fetchall()
    conn.close()

    cols = ['link_id','road_name','region','section_start_m','section_end_m',
            'section_length_km','survey_year','mean_iri','sd_iri','pct_above_9',
            'max_rut_mm','mean_rut_mm','condition_class','vci','surface_type']

    features = []
    matched  = 0
    unmatched = []

    for row in rows:
        r    = dict(zip(cols, row))
        lid  = r['link_id']
        geom = geom_index.get(lid)

        if geom is None:
            unmatched.append(lid)
            continue

        matched += 1
        cond  = r['condition_class'] or 'Good'
        color = IRI_COLOR.get(cond, '#94a3b8')

        features.append({
            'type': 'Feature',
            'geometry': geom,
            'properties': {
                'link_id':           lid,
                'road_name':         r['road_name'],
                'region':            r['region'],
                'survey_year':       r['survey_year'],
                'mean_iri':          round(float(r['mean_iri']), 2) if r['mean_iri'] else None,
                'sd_iri':            round(float(r['sd_iri']), 2)  if r['sd_iri']   else None,
                'pct_above_9':       r['pct_above_9'],
                'max_rut_mm':        round(float(r['max_rut_mm']), 1) if r['max_rut_mm'] else None,
                'condition_class':   cond,
                'vci':               r['vci'],
                'surface_type':      r['surface_type'],
                'section_length_km': round(float(r['section_length_km']), 2) if r['section_length_km'] else None,
                'color':             color,
                'data_source':       f'ROMDAS survey {r["survey_year"]}',
            }
        })

    fc = {
        'type': 'FeatureCollection',
        'metadata': {
            'generated_at':  datetime.now().isoformat()[:19],
            'total_sections': len(rows),
            'matched_to_geometry': matched,
            'survey_years': sorted({r[6] for r in rows}),
        },
        'features': features,
    }

    GEOJSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(GEOJSON_OUT, 'w', encoding='utf-8') as f:
        json.dump(fc, f, separators=(',', ':'))

    size_kb = GEOJSON_OUT.stat().st_size / 1024
    print(f'Exported {matched} sections -> {GEOJSON_OUT} ({size_kb:.0f} KB)')
    if unmatched:
        print(f'  Unmatched link_ids ({len(unmatched)}): {unmatched[:5]}...')

    # Condition summary
    from collections import Counter
    cond_count = Counter(r[12] for r in rows if r[12])
    yr_count   = Counter(r[6]  for r in rows)
    print(f'  By year:      {dict(yr_count)}')
    print(f'  By condition: {dict(cond_count)}')


if __name__ == '__main__':
    main()
