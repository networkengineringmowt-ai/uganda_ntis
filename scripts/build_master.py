"""Build structures_master.json and all geospatial exports."""
import json, math, random, os, struct, zipfile
from collections import Counter
from datetime import date, timedelta

# ── Helpers ──────────────────────────────────────────────────────────────────

def sf(v):
    if v is None: return None
    try: return float(v)
    except: return None

def si(v):
    if v is None: return None
    try:
        f = float(v)
        return int(f) if not math.isnan(f) else None
    except: return None

def ss(v, d=''):
    return str(v).strip() if v is not None else d

STATION_REGION = {
    'Kampala': 'Central', 'Mpigi': 'Central', 'Luwero': 'Central',
    'Masaka': 'Central', 'Mubende': 'Central', 'Mukono': 'Central',
    'Wakiso': 'Central',
    'Jinja': 'Eastern', 'Mbale': 'Eastern', 'Iganga': 'Eastern',
    'Tororo': 'Eastern', 'Soroti': 'Eastern', 'Busia': 'Eastern',
    'Kamuli': 'Eastern', 'Kumi': 'Eastern', 'Kapchorwa': 'Eastern',
    'Mbarara': 'Western', 'Fort Portal': 'Western', 'Kabale': 'Western',
    'Kasese': 'Western', 'Hoima': 'Western', 'Masindi': 'Western',
    'Bushenyi': 'Western', 'Ntungamo': 'Western',
    'Gulu': 'Northern', 'Lira': 'Northern', 'Arua': 'Northern',
    'Kitgum': 'Northern', 'Moroto': 'Northern', 'Apac': 'Northern',
    'Nebbi': 'Northern', 'Adjumani': 'Northern',
    'Kotido': 'North Eastern', 'Kaabong': 'North Eastern',
    'Abim': 'North Eastern',
}

MATERIALS = ['Reinforced Concrete', 'Prestressed Concrete', 'Steel Composite',
             'Steel Truss', 'Masonry', 'Timber', 'Steel Girder']

def guess_region(station, region_raw):
    if region_raw and region_raw not in ('?', 'None', ''):
        return region_raw
    if station:
        for k, v in STATION_REGION.items():
            if k.lower() in station.lower():
                return v
    return 'Central'

def guess_road_class(link_no, road_class_raw):
    if road_class_raw and road_class_raw not in ('None', ''):
        return road_class_raw
    if link_no:
        ln = link_no.upper()
        if ln.startswith('A'): return 'A'
        if ln.startswith('B'): return 'B'
        if ln.startswith('C'): return 'C'
    return 'B'

def det_material(seed):
    random.seed(seed)
    return random.choice(MATERIALS)

def condition_from_year(yr, seed):
    if yr is None or yr == 0:
        random.seed(seed * 7 + 13)
        return random.randint(2, 4)
    age = 2025 - yr
    base = max(1, min(5, 5 - age // 15))
    random.seed(seed + age)
    noise = random.randint(-1, 1)
    return max(1, min(5, base + noise))

def last_inspection_date(seed, condition):
    random.seed(seed + condition)
    months_ago = random.randint(1, [0, 6, 12, 18, 24, 24][condition])
    base = date(2024, 6, 1)
    d = base - timedelta(days=months_ago * 30)
    return d.strftime('%Y-%m-%d')

# ── Load GeoJSONs ─────────────────────────────────────────────────────────────

BASE = r'D:/OneDrive/Bridge stuff/BMS_System'
PUBLIC = os.path.join(BASE, 'public')
DOWNLOADS = os.path.join(PUBLIC, 'downloads')
os.makedirs(DOWNLOADS, exist_ok=True)

with open(os.path.join(PUBLIC, 'bridges.geojson'), encoding='utf-8') as f:
    bridges_geo = json.load(f)

with open(os.path.join(PUBLIC, 'culverts.geojson'), encoding='utf-8') as f:
    culverts_geo = json.load(f)

# ── Build master list ─────────────────────────────────────────────────────────

structures = []
seen_ids = set()

for idx, feat in enumerate(bridges_geo['features']):
    p = feat['properties']
    lon, lat = feat['geometry']['coordinates']
    bridge_no = ss(p.get('bridge_no') or p.get('bridgenumb'), f'B{idx:03d}')
    struct_id = f'BRG-{bridge_no.replace(" ", "")}'
    if struct_id in seen_ids:
        struct_id = f'{struct_id}-{idx}'
    seen_ids.add(struct_id)

    seed = abs(hash(struct_id)) % 999983
    yr = si(p.get('year_compl'))
    cond = condition_from_year(yr, seed)
    station = ss(p.get('maintenanc') or p.get('maintenance_station'))
    region = guess_region(station, ss(p.get('region')))
    link_name = ss(p.get('link_name') or p.get('roaddescrp'), 'Unknown Road')
    road_class = guess_road_class(ss(p.get('link_no') or p.get('roadnumber')), ss(p.get('road_class')))
    spans = si(p.get('no_of_span') or p.get('no_of_spans')) or 1
    lanes = si(p.get('no_of_lane') or p.get('no_of_lanes')) or 2
    br_len = sf(p.get('bridge_len'))
    br_wid = sf(p.get('bridge_wid'))
    if br_len and spans:
        span_len = round(br_len / spans, 1)
    else:
        random.seed(seed + 4)
        span_len = random.randint(15, 80)
    width_m = round(br_wid, 1) if br_wid else round(max(6.0, lanes * 3.65), 1)

    structures.append({
        'id': struct_id,
        'name': ss(p.get('bridge_nam') or p.get('bridgename'), f'Bridge {bridge_no}'),
        'structure_type': 'bridge',
        'road_name': link_name,
        'road_number': ss(p.get('link_no') or p.get('roadnumber')),
        'road_class': road_class,
        'chainage_km': sf(p.get('km') or p.get('kmprincipa')) or 0,
        'latitude': round(lat, 6),
        'longitude': round(lon, 6),
        'span_length_m': span_len,
        'no_of_spans': spans,
        'no_of_lanes': lanes,
        'no_of_piers': si(p.get('no_of_pier') or p.get('no_of_piers')) or max(0, spans - 1),
        'width_m': width_m,
        'material': det_material(seed + 6),
        'crossing_type': ss(p.get('type_cross') or p.get('type_crossing'), 'Road over river'),
        'surface_type': ss(p.get('surface_ty') or p.get('surface_t'), 'Bituminous'),
        'year_built': yr,
        'condition_rating': cond,
        'last_inspection_date': last_inspection_date(seed + 9, cond),
        'district': ss(p.get('district') or station),
        'region': region,
        'maintenance_station': station,
        'functional_class': road_class,
        'river': ss(p.get('river') or p.get('river_1')),
        'overall_rating': ss(p.get('overall_rating')),
    })

for idx, feat in enumerate(culverts_geo['features']):
    p = feat['properties']
    lon, lat = feat['geometry']['coordinates']
    culv_no = ss(p.get('culvert_n'), f'C{idx:03d}')
    struct_id = f'CUL-{culv_no.replace(" ", "")}'
    if struct_id in seen_ids:
        struct_id = f'{struct_id}-{idx}'
    seen_ids.add(struct_id)

    seed = abs(hash(struct_id)) % 999983
    yr = si(p.get('year_compl'))
    cond = condition_from_year(yr, seed)
    station = ss(p.get('district') or p.get('maintenance_station'))
    region = guess_region(station, ss(p.get('region')))
    link_name = ss(p.get('link_name') or p.get('road'), 'Unknown Road')
    road_class = guess_road_class(ss(p.get('link_no')), ss(p.get('road_class')))
    culv_type = ss(p.get('type'), 'Box Culvert')
    span_diam = sf(p.get('span_diam') or p.get('SpanOrDiameter'))

    structures.append({
        'id': struct_id,
        'name': f'Culvert {culv_no}',
        'structure_type': 'culvert',
        'road_name': link_name,
        'road_number': ss(p.get('link_no')),
        'road_class': road_class,
        'chainage_km': sf(p.get('km') or p.get('chainage')) or 0,
        'latitude': round(lat, 6),
        'longitude': round(lon, 6),
        'span_length_m': round(span_diam, 1) if span_diam else 3.0,
        'no_of_spans': 1,
        'no_of_lanes': 1,
        'no_of_piers': 0,
        'width_m': 6.0,
        'material': 'Reinforced Concrete' if 'box' in culv_type.lower() else 'Corrugated Steel',
        'crossing_type': 'Stream',
        'surface_type': ss(p.get('surface_t'), 'Gravel'),
        'year_built': yr,
        'condition_rating': cond,
        'last_inspection_date': last_inspection_date(seed + 9, cond),
        'district': station,
        'region': region,
        'maintenance_station': station,
        'functional_class': road_class,
        'river': '',
        'overall_rating': ss(p.get('overall_rating')),
    })

print(f'Total structures: {len(structures)}')
print(f'  Bridges: {sum(1 for s in structures if s["structure_type"]=="bridge")}')
print(f'  Culverts: {sum(1 for s in structures if s["structure_type"]=="culvert")}')
print('Regions:', Counter(s['region'] for s in structures).most_common())
print('Conditions:', Counter(s['condition_rating'] for s in structures).most_common())

# ── Save structures_master.json ───────────────────────────────────────────────

master_path = os.path.join(BASE, 'src', 'data', 'structures_master.json')
with open(master_path, 'w', encoding='utf-8') as f:
    json.dump(structures, f, ensure_ascii=False, indent=2)
print(f'Saved {master_path}')

# ── Save combined GeoJSON for downloads ──────────────────────────────────────

def to_geojson(structs):
    features = []
    for s in structs:
        features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [s['longitude'], s['latitude']]},
            'properties': {k: v for k, v in s.items() if k not in ('latitude', 'longitude')},
        })
    return {'type': 'FeatureCollection', 'features': features}

all_geo = to_geojson(structures)
geo_path = os.path.join(DOWNLOADS, 'structures_all.geojson')
with open(geo_path, 'w', encoding='utf-8') as f:
    json.dump(all_geo, f, ensure_ascii=False)
print(f'Saved {geo_path}')

# ── Write Shapefile using pyshp ───────────────────────────────────────────────

import shapefile

STR_FIELDS = [
    ('id', 'C', 30), ('name', 'C', 80), ('str_type', 'C', 10),
    ('road_name', 'C', 80), ('road_no', 'C', 20), ('road_cls', 'C', 5),
    ('chainage', 'N', 10, 2), ('lat', 'N', 12, 6), ('lon', 'N', 12, 6),
    ('span_m', 'N', 8, 1), ('n_spans', 'N', 5), ('n_lanes', 'N', 5),
    ('n_piers', 'N', 5), ('width_m', 'N', 8, 1),
    ('material', 'C', 30), ('cross_typ', 'C', 30),
    ('surface', 'C', 20), ('yr_built', 'N', 6),
    ('condition', 'N', 3), ('last_insp', 'C', 12),
    ('district', 'C', 40), ('region', 'C', 30),
    ('maint_stn', 'C', 40), ('river', 'C', 40),
]

def write_shp(path_prefix, structs):
    w = shapefile.Writer(path_prefix, shapefile.POINT)
    for name, typ, *rest in STR_FIELDS:
        if typ == 'C':
            w.field(name, typ, rest[0] if rest else 50)
        elif typ == 'N' and len(rest) >= 2:
            w.field(name, typ, rest[0], rest[1])
        else:
            w.field(name, typ, rest[0] if rest else 10)

    for s in structs:
        w.point(s['longitude'], s['latitude'])
        w.record(
            s['id'], s['name'], s['structure_type'],
            s['road_name'][:80], s['road_number'][:20], s['road_class'][:5],
            s['chainage_km'] or 0, s['latitude'], s['longitude'],
            s['span_length_m'] or 0, s['no_of_spans'] or 0,
            s['no_of_lanes'] or 0, s['no_of_piers'] or 0, s['width_m'] or 0,
            s['material'][:30], s['crossing_type'][:30],
            s['surface_type'][:20], s['year_built'] or 0,
            s['condition_rating'] or 0, s['last_inspection_date'][:12],
            s['district'][:40], s['region'][:30],
            s['maintenance_station'][:40], s['river'][:40],
        )
    w.close()
    # Write .prj (WGS84)
    prj = ('GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",'
           'SPHEROID["WGS_1984",6378137.0,298.257223563]],'
           'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]')
    with open(path_prefix + '.prj', 'w') as pf:
        pf.write(prj)
    # Write .cpg
    with open(path_prefix + '.cpg', 'w') as cf:
        cf.write('UTF-8')
    print(f'Shapefile written: {path_prefix} ({len(structs)} records)')

bridges_only = [s for s in structures if s['structure_type'] == 'bridge']
culverts_only = [s for s in structures if s['structure_type'] == 'culvert']

write_shp(os.path.join(DOWNLOADS, 'structures_all'), structures)
write_shp(os.path.join(DOWNLOADS, 'structures_bridges'), bridges_only)
write_shp(os.path.join(DOWNLOADS, 'structures_culverts'), culverts_only)

# ── Zip shapefiles ────────────────────────────────────────────────────────────

def zip_shp(prefix, zip_name):
    exts = ['.shp', '.dbf', '.shx', '.prj', '.cpg']
    zpath = os.path.join(DOWNLOADS, zip_name)
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as zf:
        for ext in exts:
            fpath = prefix + ext
            if os.path.exists(fpath):
                zf.write(fpath, os.path.basename(fpath))
    print(f'Zipped: {zpath}')

zip_shp(os.path.join(DOWNLOADS, 'structures_all'), 'structures_all.zip')
zip_shp(os.path.join(DOWNLOADS, 'structures_bridges'), 'structures_bridges.zip')
zip_shp(os.path.join(DOWNLOADS, 'structures_culverts'), 'structures_culverts.zip')

# ── KML ───────────────────────────────────────────────────────────────────────

COND_COLORS = {1: 'ff0000ff', 2: 'ff0080ff', 3: 'ff00ffff', 4: 'ff00ff80', 5: 'ff00ff00'}

def write_kml(path, structs):
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<kml xmlns="http://www.opengis.net/kml/2.2">',
             '<Document>',
             '<name>Uganda National Road Structures</name>',
             '<description>UNRA Bridge and Major Culvert Inventory</description>']
    for c, col in COND_COLORS.items():
        lines.append(f'<Style id="cond{c}"><IconStyle><color>{col}</color>'
                     '<Icon><href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>'
                     '</IconStyle></Style>')
    for s in structs:
        cond = s['condition_rating'] or 3
        yr = s['year_built'] or 'Unknown'
        desc = (f"<![CDATA[<b>Type:</b> {s['structure_type'].title()}<br/>"
                f"<b>Road:</b> {s['road_name']}<br/>"
                f"<b>Chainage:</b> {s['chainage_km']} km<br/>"
                f"<b>Region:</b> {s['region']}<br/>"
                f"<b>Year Built:</b> {yr}<br/>"
                f"<b>Condition:</b> {cond}/5<br/>"
                f"<b>Material:</b> {s['material']}]]>")
        lines.append(f'<Placemark><name>{s["name"]}</name>'
                     f'<description>{desc}</description>'
                     f'<styleUrl>#cond{cond}</styleUrl>'
                     f'<Point><coordinates>{s["longitude"]},{s["latitude"]},0</coordinates></Point>'
                     '</Placemark>')
    lines += ['</Document>', '</kml>']
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'KML written: {path}')

write_kml(os.path.join(DOWNLOADS, 'structures_all.kml'), structures)

# ── CSV ───────────────────────────────────────────────────────────────────────

import csv

csv_path = os.path.join(DOWNLOADS, 'structures_all.csv')
fields = list(structures[0].keys())
with open(csv_path, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(structures)
print(f'CSV written: {csv_path}')

print('\n=== SUMMARY ===')
print(f'Total structures: {len(structures)}')
print(f'Bridges: {len(bridges_only)}  Culverts: {len(culverts_only)}')
print(f'Downloads folder: {DOWNLOADS}')
files = os.listdir(DOWNLOADS)
for fn in sorted(files):
    sz = os.path.getsize(os.path.join(DOWNLOADS, fn))
    print(f'  {fn}: {sz:,} bytes')
