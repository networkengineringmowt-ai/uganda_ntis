"""
compute_overloading.py
Calculates per-link overloading risk index, regional ESAL aggregations, and
exports public/data/overloading_summary.json for the Uganda Roads Platform.

Methodology:
  - ESAL factors from SATCC/TRH4 (standard axle = 80 kN / 8.16 t)
  - Typical overloading: HGV +25%, Bus +10% (AFCAP/PIARC Uganda studies)
  - Overloaded ESAL = legal_ESAL × (1 + overload_pct)^4  [4th power law]
  - Risk index = min(100, (hgv_daily / REF_HGV) × 100 × vulnerability_multipliers)
  - Categories: Critical >70, High 50–70, Medium 30–50, Low <30

Run from the traffic-spatial-worktree root:
    python3 scripts/compute_overloading.py
"""

import json
import math
import os
from datetime import datetime, timezone
from statistics import mean, median

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEOJSON_IN  = os.path.join(BASE_DIR, 'public', 'data', 'traffic_predictions.geojson')
SURFACE_IN  = os.path.join(BASE_DIR, 'public', 'data', 'road_surface.json')
OUTPUT_JSON = os.path.join(BASE_DIR, 'public', 'data', 'overloading_summary.json')

# ── Uganda legal axle load limits (UNRA / East Africa Axle Load Regime) ────────
LEGAL_LIMITS = {
    'single_axle_t':   10,
    'tandem_axle_t':   16,
    'tridem_axle_t':   24,
    'gross_vehicle_t': 48,   # 54 t for 5-axle trucks
}

# ── ESAL factors at legal weight (SATCC/TRH4, standard axle = 80 kN) ──────────
# motorcycle=0, car=0.0002, lgv=0.01, hgv=2.4, bus=1.6
ESAL_FACTORS = {
    'motorcycle': 0.0,
    'car':        0.0002,
    'lgv':        0.01,
    'hgv':        2.4,
    'bus':        1.6,
}

# Typical overloading % in Uganda (AFCAP field surveys)
TYPICAL_OVERLOAD = {
    'hgv': 0.25,   # +25%
    'bus': 0.10,   # +10%
}

# Overloaded ESAL = legal_ESAL × (1 + overload_pct)^4
OVERLOADED_ESAL = {
    'hgv': ESAL_FACTORS['hgv'] * (1 + TYPICAL_OVERLOAD['hgv']) ** 4,  # ≈ 5.86
    'bus': ESAL_FACTORS['bus'] * (1 + TYPICAL_OVERLOAD['bus']) ** 4,  # ≈ 2.34
    'lgv': ESAL_FACTORS['lgv'],
    'car': ESAL_FACTORS['car'],
    'motorcycle': 0.0,
}

# ── Vehicle composition within the heavy_vehicle_pct split ────────────────────
# Based on Uganda national traffic composition (TIS surveys):
# Heavy trucks (HGV) = 10% of AADT, Buses (all) = 17.7%, LGV = 11.8%
# Within heavy_vehicle_pct: trucks ≈ 36%, buses ≈ 64%
HGV_TRUCK_FRAC = 0.36   # fraction of heavy_vehicle_pct that is HGV trucks
HGV_BUS_FRAC   = 0.64   # fraction of heavy_vehicle_pct that is buses
LGV_FRAC       = 0.118  # LGV as fraction of total AADT (national average)
CAR_FRAC       = 0.248  # Cars/taxis as fraction of total AADT
MOTO_FRAC      = 0.295  # Motorcycles

# ── Risk scoring constants ─────────────────────────────────────────────────────
# Reference: total heavy vehicles/day (trucks + buses) that produces base score=100.
# REF=1000: ~5.8% Critical (59 links, freight corridors + Malaba/Kampala urban),
#            43.7% High (Class C road network with typical HGV traffic),
#            26.4% Medium, 24.1% Low.
# Calibrated against Uganda traffic data — Class C roads genuinely carry high
# ESAL loads relative to their design standard.
REF_HGV_DAILY = 1000.0   # total heavy vehicles/day → base risk index 100

LOW_CLASS    = {'C', 'D', 'U'}    # lower design standard road classes
RISK_BREAKS  = {'Critical': 70, 'High': 50, 'Medium': 30}


def risk_category(index: float) -> str:
    if index >= RISK_BREAKS['Critical']: return 'Critical'
    if index >= RISK_BREAKS['High']:     return 'High'
    if index >= RISK_BREAKS['Medium']:   return 'Medium'
    return 'Low'


def compute_link(props: dict, surface: str) -> dict:
    aadt     = props.get('aadt_predicted') or 0
    hvpct    = (props.get('heavy_vehicle_pct') or 13.0) / 100.0  # → 0-1
    rc       = props.get('road_class') or '?'
    region   = props.get('region') or 'Unknown'
    link_id  = props.get('link_id') or ''
    link_name = props.get('link_name') or link_id
    length_km = props.get('length_km') or 0

    # Daily vehicle counts by class
    hgv_daily  = aadt * hvpct * HGV_TRUCK_FRAC
    bus_daily  = aadt * hvpct * HGV_BUS_FRAC
    lgv_daily  = aadt * LGV_FRAC
    car_daily  = aadt * CAR_FRAC

    # Daily ESALs (assuming typical Uganda overloading rates)
    daily_esals = (
        hgv_daily  * OVERLOADED_ESAL['hgv'] +
        bus_daily  * OVERLOADED_ESAL['bus'] +
        lgv_daily  * OVERLOADED_ESAL['lgv'] +
        car_daily  * OVERLOADED_ESAL['car']
    )

    # Total heavy vehicles per day (trucks + buses combined) for risk base
    heavy_daily = aadt * hvpct   # all heavy vehicles: trucks + buses

    # Risk index: normalized heavy vehicles/day with structural vulnerability multipliers
    base = min(100.0, (heavy_daily / REF_HGV_DAILY) * 100.0)
    multiplier = 1.0
    if surface == 'unpaved':
        multiplier *= 1.3
    if rc in LOW_CLASS:
        multiplier *= 1.2

    risk_index = min(100.0, base * multiplier)

    return {
        'link_id':            link_id,
        'road_name':          link_name,
        'road_no':            props.get('road_no') or '',
        'region':             region,
        'road_class':         rc,
        'surface_type':       surface,
        'length_km':          round(length_km, 2),
        'aadt':               int(aadt),
        'hgv_pct':            round(hvpct * 100, 1),
        'hgv_count_daily':    round(hgv_daily, 1),
        'bus_count_daily':    round(bus_daily, 1),
        'estimated_daily_esals': round(daily_esals, 1),
        'overload_risk_index':   round(risk_index, 1),
        'risk_category':         risk_category(risk_index),
    }


def main():
    print(f"Reading traffic GeoJSON: {GEOJSON_IN}")
    with open(GEOJSON_IN, encoding='utf-8') as f:
        gj = json.load(f)
    features = gj.get('features', [])
    print(f"  {len(features)} features loaded")

    print(f"Reading surface map: {SURFACE_IN}")
    with open(SURFACE_IN, encoding='utf-8') as f:
        surf_map: dict = json.load(f)
    print(f"  {len(surf_map)} surface records loaded")

    # ── Compute per-link metrics ───────────────────────────────────────────────
    links = []
    for feat in features:
        props   = feat.get('properties', {})
        lid     = props.get('link_id', '')
        surface = surf_map.get(lid, 'unknown')
        links.append(compute_link(props, surface))

    total_links = len(links)

    # ── Network-wide ESAL mean (for pavement_damage_factor) ──────────────────
    all_esals = [l['estimated_daily_esals'] for l in links]
    mean_esals = mean(all_esals) if all_esals else 1.0

    for l in links:
        l['pavement_damage_factor'] = round(
            l['estimated_daily_esals'] / max(mean_esals, 0.001), 3
        )

    # ── Risk distribution ─────────────────────────────────────────────────────
    risk_dist: dict[str, int] = {'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0}
    for l in links:
        risk_dist[l['risk_category']] += 1

    print(f"\nRisk distribution ({total_links} links total):")
    for cat, cnt in risk_dist.items():
        print(f"  {cat:10s}: {cnt:4d} ({cnt/total_links*100:.1f}%)")

    # ── Regional aggregation ──────────────────────────────────────────────────
    regions: dict[str, list] = {}
    for l in links:
        r = l['region']
        regions.setdefault(r, []).append(l)

    overloading_by_region = []
    for region, rl in sorted(regions.items()):
        total_hgv   = sum(x['hgv_count_daily']        for x in rl)
        total_esals = sum(x['estimated_daily_esals']   for x in rl)
        avg_hgv_pct = mean(x['hgv_pct']               for x in rl)
        n_critical  = sum(1 for x in rl if x['risk_category'] == 'Critical')
        n_high      = sum(1 for x in rl if x['risk_category'] == 'High')
        avg_risk    = mean(x['overload_risk_index']    for x in rl)
        overloading_by_region.append({
            'region':           region,
            'year':             2025,
            'link_count':       len(rl),
            'total_hgv_daily':  round(total_hgv, 0),
            'total_esals_daily': round(total_esals, 0),
            'avg_hgv_pct':      round(avg_hgv_pct, 1),
            'critical_links':   n_critical,
            'high_risk_links':  n_high,
            'overload_risk_score': round(avg_risk, 1),
        })

    overloading_by_region.sort(key=lambda x: -x['total_esals_daily'])

    print("\nRegional ESAL summary:")
    for r in overloading_by_region:
        print(f"  {r['region']:16s}: {r['total_esals_daily']:8,.0f} ESALs/day  "
              f"risk={r['overload_risk_score']:.1f}  "
              f"critical={r['critical_links']}  high={r['high_risk_links']}")

    # ── Top 20 overloaded links ───────────────────────────────────────────────
    top20 = sorted(links, key=lambda x: -x['estimated_daily_esals'])[:20]

    # ── KPI totals ────────────────────────────────────────────────────────────
    network_total_esals   = sum(all_esals)
    network_avg_hgv_pct   = mean(l['hgv_pct'] for l in links)
    critical_count        = risk_dist['Critical']

    # Annual pavement damage index: sum(daily_esals * 365) across all links
    # expressed as millions of ESALs/year
    annual_esal_m = network_total_esals * 365 / 1_000_000

    # ── ESAL breakdown by vehicle class (network totals) ─────────────────────
    total_hgv_esals  = sum(l['hgv_count_daily']  * OVERLOADED_ESAL['hgv'] for l in links)
    total_bus_esals  = sum(l['bus_count_daily']  * OVERLOADED_ESAL['bus'] for l in links)
    total_lgv_esals  = sum(l['aadt'] * LGV_FRAC * OVERLOADED_ESAL['lgv'] for l in links)
    total_car_esals  = sum(l['aadt'] * CAR_FRAC * OVERLOADED_ESAL['car'] for l in links)
    total_moto_esals = 0.0

    esal_breakdown = {
        'HGV Trucks': round(total_hgv_esals),
        'Buses':      round(total_bus_esals),
        'LGV':        round(total_lgv_esals),
        'Cars':       round(total_car_esals),
        'Motorcycles': 0,
    }

    # ── Compact per-link map for the Leaflet risk map (all 1020 links) ────────
    link_risk_map: dict[str, dict] = {
        l['link_id']: {
            'rc':   l['risk_category'],      # 'Critical'|'High'|'Medium'|'Low'
            'idx':  l['overload_risk_index'],
            'hpct': l['hgv_pct'],
            'esal': l['estimated_daily_esals'],
        }
        for l in links
    }

    # ── Build output JSON ─────────────────────────────────────────────────────
    out = {
        'generated': datetime.now(timezone.utc).isoformat(),
        'methodology': (
            'ESAL factors: SATCC/TRH4 standard axle 80 kN. '
            'Overloaded ESAL = legal_ESAL × (1 + overload_pct)^4. '
            'Uganda typical overloading: HGV +25%, Bus +10% (AFCAP field surveys). '
            'Risk index = min(100, hgv_daily/2000 × 100) × surface/class multipliers. '
            'Multipliers: unpaved ×1.3, Class C ×1.2.'
        ),
        'legal_limits': LEGAL_LIMITS,
        'esal_factors': {
            k: {'legal': ESAL_FACTORS[k],
                'overloaded': round(OVERLOADED_ESAL.get(k, ESAL_FACTORS[k]), 3)}
            for k in ESAL_FACTORS
        },
        'typical_overload_pct': TYPICAL_OVERLOAD,
        'network_kpis': {
            'total_links':             total_links,
            'total_daily_esals':       round(network_total_esals),
            'annual_esal_millions':    round(annual_esal_m, 1),
            'avg_hgv_pct':             round(network_avg_hgv_pct, 1),
            'critical_links':          critical_count,
            'high_risk_links':         risk_dist['High'],
            'mean_esals_per_link':     round(mean_esals, 1),
        },
        'esal_breakdown_by_class': esal_breakdown,
        'risk_distribution':       risk_dist,
        'overloading_by_region':   overloading_by_region,
        'top_overloaded_links':    top20,
        'link_risk_map':           link_risk_map,
    }

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    print(f"\nOutput written: {OUTPUT_JSON}")
    print(f"  Total network daily ESALs: {network_total_esals:,.0f}")
    print(f"  Annual pavement damage index: {annual_esal_m:.1f} million ESALs/year")


if __name__ == '__main__':
    main()
