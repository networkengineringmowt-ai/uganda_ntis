"""refresh_2026 — regenerate the platform data bundle from the latest G: sources.

Sources (most-updated, confirmed 2026-06-11):
  Network/OPRC/NDPIV: National Road Network/National Road Network_FY25-26(NDPIV) - draft.xlsx
  Network shapefile:  8. Shapefiles/Roads/network2026/network2026.shp
  Bridges (BMS):      Bridge stuff/uganda_bridges_bms_inventory_elements_conditions.csv
  ATC traffic:        ATC/ATC data after 2025/ATC_Minimal_ADT_Formula_Workbook - Copy.xlsx

Outputs into public/data: network_links.json, network_stats.json,
network2026.geojson, bridges2026.geojson, bridges_summary.json, atc_adt_2026.json.
Run: python scripts/refresh_2026.py   (needs pandas, openpyxl, geopandas)
"""
import json, math, os
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..'))
G    = os.path.normpath(os.path.join(REPO, '..'))
OUT  = os.path.join(REPO, 'public', 'data')

def clean(v):
    if v is None: return None
    if isinstance(v, float) and math.isnan(v): return None
    if isinstance(v, (pd.Timestamp,)): return str(v.date())
    if hasattr(v, 'item'): v = v.item()
    if isinstance(v, str): v = v.strip()
    return v if v != '' else None

def save(name, obj):
    p = os.path.join(OUT, name)
    json.dump(obj, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{name}: {os.path.getsize(p)//1024} KB')

# ── 1 · Network links from NDPIV FY25-26 ─────────────────────────────────────
nd = pd.ExcelFile(os.path.join(G, 'National Road Network', 'National Road Network_FY25-26(NDPIV) - draft.xlsx'))
df = nd.parse('Network combined')
df = df[df['Link_ID'].notna()]
links = []
for _, r in df.iterrows():
    links.append({
        'link_id': clean(r['Link_ID']), 'road_no': clean(r['Road_No']),
        'road_class': clean(r['Road_Class']), 'link_name': clean(r['Link_Name']),
        'chainage_from': clean(r['Chainage_From']), 'chainage_to': clean(r['Chainage_To']),
        'length_km': clean(r['Length(km)']), 'surface_type': clean(r['Surface_Type']),
        'maintenance_station': clean(r['Maintenance_Station']),
        'maintenance_region': clean(r['Maintenance_Region']),
        'completion_year': clean(r['Completion_Year']), 'rehab_year': clean(r['Rehabilitation_Year']),
        'last_intervention': clean(r['Year_of_Last_Interventation']),
        'pavement_age': clean(r.get('Pavement Age')),
        'comments': clean(r['Comments']),
        'ndpiv_1': clean(r['NATIONAL ROADS COMPONENT FOR NDP IV (1)']),
        'ndpiv_2': clean(r['NATIONAL ROADS COMPONENT FOR NDP IV (2)']),
        'funder': clean(r['FUNDER']), 'oprc': clean(r['OPRC']),
    })
save('network_links.json', links)
print(f'  links: {len(links)}')

# ── 2 · Network stats (recompute; keep non-derivable fields) ──────────────────
old = json.load(open(os.path.join(OUT, 'network_stats.json'), encoding='utf-8'))
# FY25-26 vocabulary: 'Bituminous' = paved, 'Unsealed' = unpaved
def is_paved(s):
    return bool(s) and any(k in s.lower() for k in ('bitum', 'sealed', 'concrete', 'paved')) \
        and 'unsealed' not in s.lower() and 'unpaved' not in s.lower()
tot_km = sum(l['length_km'] or 0 for l in links)
paved_km = sum(l['length_km'] or 0 for l in links if is_paved(l['surface_type']))
by_class, by_region = {}, {}
for l in links:
    km = l['length_km'] or 0; pv = km if is_paved(l['surface_type']) else 0
    c = (l['road_class'] or '?')[:1].upper()
    bc = by_class.setdefault(c, {'links': 0, 'km': 0.0, 'paved_km': 0.0})
    bc['links'] += 1; bc['km'] += km; bc['paved_km'] += pv
    rg = l['maintenance_region'] or 'Unknown'
    br = by_region.setdefault(rg, {'links': 0, 'km': 0.0, 'paved_km': 0.0, 'stations': {}})
    br['links'] += 1; br['km'] += km; br['paved_km'] += pv
    st = l['maintenance_station'] or 'Unknown'
    br['stations'][st] = br['stations'].get(st, 0) + 1
for d in by_class.values():
    d['km'] = round(d['km'], 1); d['paved_km'] = round(d['paved_km'], 1)
for d in by_region.values():
    d['km'] = round(d['km'], 1); d['paved_km'] = round(d['paved_km'], 1)

# ── 3 · Bridges 2026 from the BMS inventory CSV ───────────────────────────────
bdf = pd.read_csv(os.path.join(G, 'Bridge stuff', 'uganda_bridges_bms_inventory_elements_conditions.csv'))
feats = []
for _, r in bdf.iterrows():
    lon, lat = clean(r['Corrected Longitude']), clean(r['Corrected Latitude'])
    props = {
        # legacy property names (kept so existing views keep working)
        'bridge_no': clean(r['Bridge Number']), 'bridge_nam': clean(r['Bridge Name']),
        'link_name': clean(r['Road Link Name']), 'link_no': clean(r['Link ID']),
        'roadno': clean(r['Road Number']), 'river': clean(r['River / Watercourse']),
        'km': clean(r['Bridge Chainage From Start of Road km']),
        'region': clean(r['Maintenance Region']), 'type_cross': clean(r['Type Crossing']),
        'surface_ty': clean(r['Surface Type']),
        # 2026 BMS inventory + element conditions + predictions
        'bridge_type': clean(r['Bridge Type']), 'deck_material': clean(r['Deck Material']),
        'spans': clean(r['Number of Spans']), 'length_m': clean(r['Overall Bridge Length m']),
        'width_m': clean(r['Overall Bridge Width m']), 'lanes': clean(r['Number of Lanes']),
        'completion_year': clean(r['Completion Year']),
        'last_intervention': clean(r['Year of Last Intervention']),
        'scour_risk': clean(r['Scour Risk']),
        'rating_approaches': clean(r['Approaches Rating']), 'rating_roadway': clean(r['Roadway Rating']),
        'rating_substructure': clean(r['Substructure Rating']),
        'rating_superstructure': clean(r['Superstructure Rating']),
        'rating_waterway': clean(r['Waterway Rating']),
        'overall_rating': clean(r['Overall Rating']), 'bms_product': clean(r['BMS Product']),
        'growth_rate': clean(r['Annual Weighted Growth Rate']),
        'predicted_aadt_2026': (lambda v: float(str(v).replace(',', '')) if v is not None and str(v).replace(',', '').replace('.', '', 1).isdigit() else clean(v))(clean(r['Current Predicted AADT'])),
        'inspection_comment': clean(r['Inspection Comment']),
    }
    feats.append({'type': 'Feature',
                  'geometry': ({'type': 'Point', 'coordinates': [lon, lat]} if lon is not None and lat is not None else None),
                  'properties': props})
save('bridges2026.geojson', {'type': 'FeatureCollection', 'name': 'bridges2026_bms', 'features': feats})
print(f'  bridges: {len(feats)}')

# bridges_summary: refresh bridge-side numbers, keep culvert fields
bs = json.load(open(os.path.join(OUT, 'bridges_summary.json'), encoding='utf-8'))
bs['total_bridges'] = len(feats)
bs['bridges_with_gps'] = sum(1 for f in feats if f['geometry'])
cond = {}
for f in feats:
    k = f['properties']['overall_rating']
    k = str(int(k)) if isinstance(k, (int, float)) and k is not None else (str(k) if k else 'Unrated')
    cond[k] = cond.get(k, 0) + 1
bs['condition_distribution_bridges'] = cond
bt = {}
for f in feats:
    k = f['properties']['bridge_type'] or 'Unknown'
    bt[k] = bt.get(k, 0) + 1
bs['by_structure_type_bridges'] = dict(sorted(bt.items(), key=lambda kv: -kv[1]))
save('bridges_summary.json', bs)

# ── 4 · ATC ADT 2026 from raw hourly counts ───────────────────────────────────
atc = pd.ExcelFile(os.path.join(G, 'ATC', 'ATC data after 2025', 'ATC_Minimal_ADT_Formula_Workbook - Copy.xlsx'))
raw = atc.parse('Raw_Data')
CLS = ['Motorcycles', 'Saloon cars and taxis', 'Light goods, vans, pickups and 4WD',
       'Small buses, minibuses and matatus (<30 seats)', 'Medium buses - coasters', 'Large buses',
       'Light single-unit trucks / dynas and tractors - 2 axles (1:1)',
       'Medium / heavy single-unit trucks - 2 to 3 axles',
       'Light truck & trailer or heavy truck & semi-trailer - 4 axles',
       'Heavy truck & trailer or heavy truck & semi-trailer - 5 axles',
       'Heavy truck & trailer or heavy truck & semi-trailer - 6 axles',
       'Heavy truck & semi-trailer - 7 axles']
sites = []
for site, g in raw.groupby('Site Location'):
    days = g['Date'].nunique()
    if not days: continue
    total = float(g['Direction 1 Total Volume'].sum() + g['Direction 2 Total Volume'].sum())
    breakdown = {}
    for c in CLS:
        v = float(g.get(f'Direction 1 - {c}', pd.Series(dtype=float)).sum()
                  + g.get(f'Direction 2 - {c}', pd.Series(dtype=float)).sum())
        breakdown[c] = round(v / days, 1)
    sites.append({
        'site': site, 'link': clean(g['Link'].iloc[0]), 'road_section': clean(g['Road Section'].iloc[0]),
        'region': clean(g['Region'].iloc[0]),
        'lat': clean(g['Latitude'].iloc[0]), 'lon': clean(g['Longitude'].iloc[0]),
        'survey_days': int(days),
        'years': sorted(int(y) for y in g['Year'].dropna().unique()),
        'adt_total': round(total / days, 1),
        'avg_speed_kmh': round(float(g['Speed_km_h'].mean()), 1) if g['Speed_km_h'].notna().any() else None,
        'adt_by_class': breakdown,
    })
sites.sort(key=lambda s: -s['adt_total'])
save('atc_adt_2026.json', {'generated': '2026-06-11', 'source': 'ATC_Minimal_ADT_Formula_Workbook (post-2025 counts)',
                           'sites': sites})
print(f'  atc sites: {len(sites)}')

# stats: finish with bridge + atc figures
stats = dict(old)
stats.update({
    'total_links': len(links), 'total_km': round(tot_km, 1),
    'paved_km': round(paved_km, 1), 'unpaved_km': round(tot_km - paved_km, 1),
    'paved_pct': round(100 * paved_km / tot_km, 1) if tot_km else None,
    'by_class': by_class, 'by_region': by_region,
    'bridges_total': len(feats),
    'atc_sites_2026': len(sites),
    'data_vintage': 'FY25-26 NDPIV draft · network2026 shapefile · BMS bridge inventory · post-2025 ATC',
})
save('network_stats.json', stats)

# ── 5 · network2026.geojson from the shapefile (legacy property names) ────────
import geopandas as gpd
shp = gpd.read_file(os.path.join(G, '8. Shapefiles', 'Roads', 'network2026', 'network2026.shp'))
shp = shp.to_crs(4326)
ren = {'Road_No_1': 'road_no', 'Link_ID_1': 'link_id', 'Road_Cla_1': 'road_class',
       'Link_Name': 'link_nam_1', 'Chainage_1': 'chainage_f', 'Chainage_2': 'chainage_t',
       'Length_km_': 'length_km1', 'Surface__1': 'surface_ty', 'Maintena_2': 'maintenanc',
       'Maintena_3': 'maintena_1', 'Completi_1': 'completion', 'Rehabili_1': 'rehabilita',
       'StartX': 'start_x', 'StartY': 'start_y', 'EndX': 'end_x', 'EndY': 'end_y',
       'Unique_ID': 'unique_id'}
shp = shp.rename(columns=ren)[list(ren.values()) + ['geometry']]
shp.geometry = shp.geometry.simplify(0.0001)  # ~11 m — visually lossless at map scales
gj = json.loads(shp.to_json())
for f in gj['features']:
    f['properties'] = {k: clean(v) for k, v in f['properties'].items()}
save('network2026.geojson', gj)
print(f'  shapefile links: {len(gj["features"])}')
print('refresh complete')
