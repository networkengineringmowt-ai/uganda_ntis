#!/usr/bin/env python3
"""
Generate a ranked maintenance priority report from ML predictions.

Ranks all 1,017 road links by intervention urgency using a priority score
based on IRI, traffic (AADT/road class), intervention year, and road class.
Produces a cost-estimated 5-year maintenance programme.

Output: public/data/maintenance_programme.json

Usage:
  python generate_maintenance_report.py
"""

import json, sqlite3, math
from pathlib import Path
from datetime import datetime
from collections import defaultdict

BASE     = Path(__file__).resolve().parents[2]
DB_PATH  = str(BASE / 'traffic_platform.db')
PRED_IN  = str(BASE / 'public' / 'data' / 'romdas_predictions.json')
OUT_JSON = str(BASE / 'public' / 'data' / 'maintenance_programme.json')

# Uganda unit costs (USD per km) — approximate UNRA contract rates
UNIT_COST = {
    'None':                    500,
    'Routine Maintenance':   3_000,
    'Routine Grading':       1_500,
    'Reseal':               80_000,
    'Overlay':             200_000,
    'Rehabilitation':      500_000,
    'Reconstruction':    1_200_000,
    'Regravelling':         25_000,
    'Reconstruct (Gravel)': 150_000,
    'No Intervention':         500,
}

# Road class traffic weighting
CLASS_WEIGHT = {'M': 4.0, 'A': 3.0, 'B': 2.0, 'C': 1.0}


def priority_score(iri: float, road_class: str, int_year: int,
                   maint_detected: bool) -> float:
    """Higher score = higher priority for maintenance."""
    # IRI severity (exponential above 6.5)
    iri_score = min(100.0, iri ** 1.4)
    # Urgency: how soon intervention is needed
    years_left = max(0, int_year - 2024)
    urgency    = 100.0 * math.exp(-0.2 * years_left)
    # Traffic weight
    traffic_w  = CLASS_WEIGHT.get(road_class, 1.0)
    # Bonus if maintenance was already done (shows road is actively managed)
    maint_bonus = 0.9 if maint_detected else 1.0
    return round(iri_score * urgency * traffic_w * maint_bonus / 100.0, 2)


def main():
    # Load predictions
    with open(PRED_IN) as f:
        preds = json.load(f)

    # Load network metadata for road class and length
    conn = sqlite3.connect(DB_PATH)
    class_map = dict(conn.execute(
        "SELECT DISTINCT link_id, road_class FROM deterioration_curves WHERE link_id != ''"
    ).fetchall())
    # Use road_network.geojson for link lengths (not in deterioration_curves)
    geojson_path = BASE / 'public' / 'road_network.geojson'
    length_map = {}
    if geojson_path.exists():
        with open(geojson_path, encoding='utf-8') as gf:
            gj = json.load(gf)
        for feat in gj['features']:
            lid = feat['properties'].get('link_id', '')
            lkm = feat['properties'].get('length_km')
            if lid and lkm:
                length_map[lid] = float(lkm)
    conn.close()

    programme = []
    year_budget = defaultdict(float)
    type_count  = defaultdict(int)
    type_km     = defaultdict(float)
    total_cost  = 0.0

    for p in preds['link_predictions']:
        lid       = p['link_id']
        iri       = p['current_iri']
        int_type  = p['intervention_type']
        int_year  = p['intervention_year']
        detr      = p['deterioration_rate']
        cond      = p['condition_now']
        maint     = p.get('maintenance_detected', False)
        data_src  = p.get('data_source', 'hdm4_projected')

        road_class = class_map.get(lid, 'C')
        length_km  = length_map.get(lid, 10.0)   # default 10 km if unknown

        unit = UNIT_COST.get(int_type, 5000)
        cost = length_km * unit
        score = priority_score(iri, road_class, int_year, maint)

        # Budget by intervention year (cap at 2030)
        yr = min(int_year, 2030)
        year_budget[yr] += cost
        type_count[int_type] += 1
        type_km[int_type]    += length_km
        total_cost           += cost

        programme.append({
            'link_id':            lid,
            'road_name':          p['road_name'],
            'road_class':         road_class,
            'current_iri':        iri,
            'condition_now':      cond,
            'deterioration_rate': detr,
            'intervention_year':  int_year,
            'intervention_type':  int_type,
            'length_km':          round(length_km, 2),
            'estimated_cost_usd': int(cost),
            'priority_score':     score,
            'condition_3yr':      p.get('predicted_condition_3yr', ''),
            'data_source':        data_src,
            'maintenance_detected': maint,
        })

    # Sort by priority score descending
    programme.sort(key=lambda x: -x['priority_score'])

    # Add rank
    for i, p in enumerate(programme, 1):
        p['priority_rank'] = i

    # Year-by-year budget summary
    year_summary = {}
    for yr in sorted(year_budget.keys()):
        if yr >= 2024:
            year_summary[str(yr)] = {
                'budget_usd': int(year_budget[yr]),
                'budget_usd_millions': round(year_budget[yr] / 1e6, 1),
            }

    # Intervention type summary
    type_summary = {}
    for t in sorted(type_count.keys(), key=lambda x: -type_count[x]):
        type_summary[t] = {
            'count':          type_count[t],
            'total_km':       round(type_km[t], 1),
            'unit_cost_usd':  UNIT_COST.get(t, 0),
            'total_cost_usd': int(type_km[t] * UNIT_COST.get(t, 0)),
        }

    # Condition distribution
    cond_dist = defaultdict(int)
    for p in programme:
        cond_dist[p['condition_now']] += 1

    output = {
        'generated_at':   datetime.now().isoformat()[:19],
        'network_summary': {
            'total_links':           len(programme),
            'links_with_romdas_data': sum(1 for p in programme if p['data_source'] == 'romdas_measured'),
            'maintenance_events':    sum(1 for p in programme if p['maintenance_detected']),
            'condition_distribution': dict(cond_dist),
            'total_programme_cost_usd':      int(total_cost),
            'total_programme_cost_millions': round(total_cost / 1e6, 1),
        },
        'annual_budget':      year_summary,
        'intervention_types': type_summary,
        'top_priority_links': programme[:50],    # top 50 for summary view
        'all_links':          programme,
    }

    Path(OUT_JSON).parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, 'w') as f:
        json.dump(output, f, separators=(',', ':'))

    size_kb = Path(OUT_JSON).stat().st_size / 1024
    print('=== Maintenance Programme Report ===')
    print(f'  Links ranked   : {len(programme)}')
    print(f'  Total cost     : ${total_cost/1e6:.0f}M USD')
    print(f'  Condition dist : {dict(cond_dist)}')
    print()
    print('  By intervention type:')
    for t, info in type_summary.items():
        print(f'    {t:25s}: {info["count"]:4d} links  {info["total_km"]:6.0f} km  '
              f'${info["total_cost_usd"]/1e6:.0f}M')
    print()
    print('  Annual budget (USD M):')
    for yr, info in list(year_summary.items())[:7]:
        print(f'    {yr}: ${info["budget_usd_millions"]:.0f}M')
    print()
    print('  Top 5 priority links:')
    for p in programme[:5]:
        print(f'    [{p["priority_rank"]}] {p["link_id"]} ({p["road_name"][:35]}): '
              f'IRI={p["current_iri"]} -> {p["intervention_type"]} in {p["intervention_year"]}')
    print(f'\n  -> {OUT_JSON} ({size_kb:.0f} KB)')


if __name__ == '__main__':
    main()
