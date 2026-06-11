"""export_bundle — generate public/data/bundle.json for the RoadAtlas dashboard.

Builds the static DashboardBundle (see src/hooks/useDashboardBundle.ts) from
the canonical G: Drive data files in public/data. Every section is optional
in the hook, so this emits whatever can be derived from the available files.
Run from the uganda-roads folder:  python scripts/export_bundle.py
"""
import json, os, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'public', 'data')

def load(name):
    try:
        with open(os.path.join(DATA, name), encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None

now = datetime.datetime.now().isoformat(timespec='seconds')
bundle = {'dashboardManifest': {'generatedAt': now}}

links = load('network_links.json') or []
cond  = load('link_condition_lookup.json') or {}
stats = load('network_stats.json') or {}
bridges = load('bridges2026.geojson') or load('bridges2025.geojson') or {'features': []}
traffic = load('traffic_summary.json') or {}

# ── Region intelligence: km-weighted VCI + project counts per region ──────────
def link_vci(link_id):
    rec = cond.get(link_id) if isinstance(cond, dict) else None
    if isinstance(rec, dict):
        for k in ('vci', 'vci_2023', 'latest_vci'):
            v = rec.get(k)
            if isinstance(v, (int, float)):
                return v
    return None

regions = {}
for l in links:
    r = l.get('maintenance_region') or 'Unknown'
    g = regions.setdefault(r, {'km': 0.0, 'vci_km': 0.0, 'vci_w': 0.0, 'projects': 0})
    km = l.get('length_km') or 0
    g['km'] += km
    v = link_vci(l.get('link_id'))
    if v is not None and km:
        g['vci_km'] += v * km
        g['vci_w'] += km
    if l.get('ndpiv_1') or l.get('oprc'):
        g['projects'] += 1

region_intel = []
for r, g in sorted(regions.items()):
    if r == 'Unknown':
        continue
    vci = round(g['vci_km'] / g['vci_w'], 1) if g['vci_w'] else None
    stress = round(100 - vci, 1) if vci is not None else None
    region_intel.append({
        'region': r,
        'weightedAverageVci': vci,
        'projects': g['projects'],
        'stressScore': stress,
    })
bundle['roadNetworkIntelligence'] = {'generatedAt': now, 'regionIntelligence': region_intel}

# ── Bridge corridors: which links carry the most structures ───────────────────
corridors = {}
for f in bridges.get('features', []):
    p = f.get('properties', {})
    key = (p.get('link_name') or 'Unknown', p.get('roadno') or '')
    corridors[key] = corridors.get(key, 0) + 1
top = sorted(corridors.items(), key=lambda kv: -kv[1])[:12]
bundle['roadExcelAnalytics'] = {'bridges': {'top_corridors': [
    {'principal_road_name': k[0], 'principal_link_id': k[1], 'bridge_count': n}
    for k, n in top if k[0] != 'Unknown'
]}}

# ── Structure digital twin: bridge features + summary ─────────────────────────
features, region_counts = [], {}
for f in bridges.get('features', []):
    p = f.get('properties', {})
    geom = f.get('geometry') or {}
    coords = geom.get('coordinates')
    region_counts[p.get('region') or 'Unknown'] = region_counts.get(p.get('region') or 'Unknown', 0) + 1
    features.append({
        'geometry': {'coordinates': coords[:2] if isinstance(coords, list) else None},
        'properties': {
            'assetType': 'bridge',
            'title': p.get('bridge_nam'),
            'structureId': str(p.get('bridge_no') or ''),
        },
    })
bundle['structureDigitalTwin'] = {
    'features': features,
    'summary': {
        'assetCount': len(features),
        'bridgeCount': len(features),
        'culvertCount': stats.get('culverts_total'),
        'regions': [{'label': r, 'count': n} for r, n in sorted(region_counts.items(), key=lambda kv: -kv[1]) if r != 'Unknown'],
    },
}

# ── Spatial catalog: everything served from public/data ──────────────────────
THEMES = {'rail': 'Railways', 'ferry': 'Ferries', 'ferries': 'Ferries', 'airport': 'Aviation',
          'airfield': 'Aviation', 'lake': 'Hydrology', 'river': 'Hydrology', 'bridge': 'Structures',
          'traffic': 'Traffic', 'network': 'Road Network', 'romdas': 'Condition Surveys'}
entries = []
for fn in sorted(os.listdir(DATA)):
    if not fn.endswith(('.json', '.geojson')) or fn == 'bundle.json':
        continue
    theme = next((t for k, t in THEMES.items() if k in fn.lower()), 'Platform Data')
    entries.append({
        'name': fn, 'kind': 'geojson' if fn.endswith('.geojson') else 'json',
        'themeLabel': theme, 'sourceLabel': 'G: Drive repository (canonical)',
        'servedRelativePath': f'data/{fn}',
    })
bundle['spatialCatalog'] = {'entries': entries}

# ── Paved stock single-point reference from network stats ─────────────────────
if stats.get('paved_km'):
    bundle['roadPublicReferences'] = {'paved_stock_timeline': [{
        'financial_year': 'FY25-26',
        'stock_paved_roads_km': stats.get('paved_km'),
        'percent_paved_network': stats.get('paved_pct'),
        'ndp': 'NDPIV',
    }]}

out = os.path.join(DATA, 'bundle.json')
with open(out, 'w', encoding='utf-8') as f:
    json.dump(bundle, f, ensure_ascii=False)
print(f'bundle.json: {os.path.getsize(out)//1024} KB · regions={len(region_intel)} '
      f'corridors={len(top)} twinFeatures={len(features)} catalog={len(entries)}')
