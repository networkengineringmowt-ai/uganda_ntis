"""build_fwd_inventory — generate road inventory + FWD bundles from G: sources.

Inventory: 6.Road Inventory Data/2022-23 (paved line + point features, unpaved register)
FWD:       FWD/ (KNBP Phase 1, Kaserem-Kapchorwa, Gulu-Atiak-Nimule, Ntungamo-Rukungiri)

Outputs: public/data/road_inventory_2023.json, public/data/fwd_surveys.json
"""
import json, os, re, warnings
import pandas as pd
warnings.filterwarnings('ignore')

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..'))
G    = os.path.normpath(os.path.join(REPO, '..'))
OUT  = os.path.join(REPO, 'public', 'data')

def clean(v):
    if v is None or (isinstance(v, float) and pd.isna(v)): return None
    if hasattr(v, 'item'): v = v.item()
    if isinstance(v, str): v = v.strip()
    return v if v != '' else None

def mode(s):
    s = s.dropna()
    return clean(s.mode().iloc[0]) if len(s) else None

def med(s):
    s = pd.to_numeric(s, errors='coerce').dropna()
    return round(float(s.median()), 2) if len(s) else None

# ── 1 · Road inventory 2022-23 ────────────────────────────────────────────────
INV = os.path.join(G, '6.Road Inventory Data', '2022-23')
line = pd.ExcelFile(os.path.join(INV, 'Line features paved road network inventory combined 2023-.xlsx')).parse('Line features combined ')
point = pd.ExcelFile(os.path.join(INV, 'Point features paved road network inventory combined 2023-.xlsx')).parse('Point features inventory 2023')
line.columns = [str(c).strip() for c in line.columns]
point.columns = [str(c).strip() for c in point.columns]

links = {}
for lid, g in line.groupby('Link ID'):
    if not clean(lid): continue
    lf = g['Sub Type'].dropna().value_counts().to_dict() if 'Sub Type' in g else {}
    links[str(lid).strip()] = {
        'link_id': str(lid).strip(),
        'link_name': mode(g['Link Name']),
        'region': mode(g['Region']), 'station': mode(g['Station']),
        'surface_type': mode(g['Surface Type']), 'material_type': mode(g['Material Type']),
        'road_width_m': med(g['Road Width']),
        'has_shoulder_pct': round(100 * (g['Does the road have a shoulder?'].astype(str).str.lower() == 'yes').mean(), 1),
        'shoulder_material': mode(g['Shoulder Material Type']),
        'shoulder_width_m': med(g['Shoulder Width']),
        'road_reserve_width_m': med(g['Road Reserve Width']),
        'lanes': mode(g['Number of Lanes']),
        'terrain': mode(g['Terrain']),
        'line_features': {str(k)[:40]: int(v) for k, v in sorted(lf.items(), key=lambda kv: -kv[1])},
        'line_records': int(len(g)),
        'point_features': {}, 'point_records': 0,
    }

pf_col = 'Feature Subtype' if 'Feature Subtype' in point.columns else 'Feature Type'
for lid, g in point.groupby('Link ID'):
    key = str(lid).strip()
    if key in links:
        pf = g[pf_col].dropna().value_counts().to_dict()
        links[key]['point_features'] = {str(k)[:40]: int(v) for k, v in sorted(pf.items(), key=lambda kv: -kv[1])}
        links[key]['point_records'] = int(len(g))

# Unpaved register (link coverage)
try:
    unp = pd.ExcelFile(os.path.join(INV, 'Unpaved Road Network Inventory Combined 2023.xlsx')).parse('Unpaved Network')
    unp.columns = [str(c).strip() for c in unp.columns]
    unpaved_links = int(unp['LinkID'].notna().sum())
except Exception:
    unpaved_links = None

inv = {
    'survey': '2022-23 road inventory (UNRA field teams)',
    'paved_links_surveyed': len(links),
    'paved_line_records': int(len(line)),
    'paved_point_records': int(len(point)),
    'unpaved_links_in_register': unpaved_links,
    'links': sorted(links.values(), key=lambda l: l['link_id']),
}
p = os.path.join(OUT, 'road_inventory_2023.json')
json.dump(inv, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
print(f'road_inventory_2023.json: {len(links)} paved links, {len(line)} line + {len(point)} point records')

# ── 2 · FWD surveys ───────────────────────────────────────────────────────────
FWD = os.path.join(G, 'FWD')

def read_bowls(path, sheets=None, label=''):
    """Find sheets with Chainage + D0 columns and extract deflection bowls."""
    out = []
    try:
        x = pd.ExcelFile(path)
    except Exception as e:
        print('  skip', os.path.basename(path), repr(e)[:60]); return out
    for s in (sheets or x.sheet_names):
        if s not in x.sheet_names: continue
        try:
            df = x.parse(s)
        except Exception:
            continue
        df.columns = [str(c).strip() for c in df.columns]
        # header row may be offset — scan the first 15 rows for one containing
        # both a chainage-like and a centre-deflection cell, then re-read
        def find_cols(frame):
            cmap = {str(c).strip().lower(): c for c in frame.columns}
            chc = next((cmap[k] for k in cmap if 'corrected ch' in k or 'chainage' in k
                        or k == 'distance' or k in ('station', 'stationid')), None)
            d0c = next((cmap[k] for k in cmap if re.fullmatch(r'd ?0(\.0)?', k)), None) \
                  or next((cmap[k] for k in cmap if re.fullmatch(r'd ?1(\.0)?', k)), None)
            return cmap, chc, d0c
        cols, ch, d0 = find_cols(df)
        if not ch or not d0:
            try:
                raw = x.parse(s, header=None, nrows=16)
                hdr = None
                for i in range(len(raw)):
                    vals = [str(v).strip().lower() for v in raw.iloc[i].tolist()]
                    has_ch = any('chainage' in v or v in ('distance', 'station', 'stationid') or 'corrected ch' in v for v in vals)
                    has_d = any(re.fullmatch(r'd ?[01](\.0)?', v) for v in vals)
                    if has_ch and has_d:
                        hdr = i; break
                if hdr is None: continue
                df = x.parse(s, header=hdr)
                df.columns = [str(c).strip() for c in df.columns]
                cols, ch, d0 = find_cols(df)
            except Exception:
                continue
        if not ch or not d0: continue
        d300 = next((cols[k] for k in cols if k in ('d300', 'd 300')), None)
        d600 = next((cols[k] for k in cols if k in ('d600', 'd 600')), None)
        d900 = next((cols[k] for k in cols if k in ('d900', 'd 900')), None)
        load = next((cols[k] for k in cols if k.startswith('load') or k.startswith('force')), None)
        pts = []
        for _, r in df.iterrows():
            c, v = pd.to_numeric(r[ch], errors='coerce'), pd.to_numeric(r[d0], errors='coerce')
            if pd.isna(c) or pd.isna(v) or v <= 0: continue
            pt = {'ch': round(float(c), 3), 'd0': round(float(v), 1)}
            if load is not None and not pd.isna(pd.to_numeric(r[load], errors='coerce')):
                pt['load'] = round(float(pd.to_numeric(r[load], errors='coerce')), 1)
            for nm, col in (('d300', d300), ('d600', d600), ('d900', d900)):
                if col is not None:
                    w = pd.to_numeric(r[col], errors='coerce')
                    if not pd.isna(w): pt[nm] = round(float(w), 1)
            pts.append(pt)
        if pts:
            # multiple drops per station → average the bowls per chainage
            if len(pts) > 1.5 * len({p['ch'] for p in pts}):
                grouped = {}
                for p in pts: grouped.setdefault(p['ch'], []).append(p)
                pts = []
                for c in sorted(grouped):
                    grp = grouped[c]
                    avg = {'ch': c, 'd0': round(sum(g['d0'] for g in grp) / len(grp), 1)}
                    for k in ('load', 'd300', 'd600', 'd900'):
                        vals = [g[k] for g in grp if k in g]
                        if vals: avg[k] = round(sum(vals) / len(vals), 1)
                    pts.append(avg)
            # chainage in metres → km
            if pts and max(p['ch'] for p in pts) > 200:
                for p in pts: p['ch'] = round(p['ch'] / 1000, 3)
            pts.sort(key=lambda p: p['ch'])
            out.append({'sheet': s, 'points': pts})
            print(f'  {label or os.path.basename(path)} [{s}]: {len(pts)} bowls')
    return out

surveys = []
def add(road, source, path, sheets=None):
    for blk in read_bowls(path, sheets, road):
        d0s = [p['d0'] for p in blk['points']]
        surveys.append({
            'road': road, 'source': source, 'sheet': blk['sheet'],
            'points': blk['points'], 'n': len(d0s),
            'd0_mean': round(sum(d0s) / len(d0s), 1), 'd0_max': round(max(d0s), 1),
            'ch_from': blk['points'][0]['ch'], 'ch_to': blk['points'][-1]['ch'],
        })

add('Kapchorwa – Suam (KNBP Phase 1)', 'FWD data KNBP Phase 1.xlsx',
    os.path.join(FWD, 'FWD data KNBP Phase 1.xlsx'), ['LHS', 'RHS'])
add('Kaserem – Kapchorwa', 'Kaserem_Kapchorwa Deflection Data.xlsx',
    os.path.join(FWD, 'Kaserem_Kapchorwa Deflection Data.xlsx'), ['LHS', 'RHS'])
GU = os.path.join(FWD, 'Field data', 'Gulu Ataik Nimule Excel')
for fn, road in [('Ataik - Gulu.xlsx', 'Atiak – Gulu'), ('Gulu - Ataik.xlsx', 'Gulu – Atiak'),
                 ('Ataik - Nimule Section 2.xlsx', 'Atiak – Nimule (Section 2)'),
                 ('Nimule Ataik RHS.xlsx', 'Nimule – Atiak (RHS)')]:
    add(road, fn, os.path.join(GU, fn))
add('Ntungamo – Rukungiri', 'FWD_Analysis_Tool_Rukungiri_Ntungamo_final_v2.xlsx',
    os.path.join(FWD, 'Field data', 'FWD DATA NTUNGAMO - RUKUNGIRI ROAD',
                 'FWD_Analysis_Tool_Rukungiri_Ntungamo_final_v2.xlsx'), ['LHS', 'RHS'])

fwd = {'generated': '2026-06-11', 'source_dir': 'FWD/ (G: repository)',
       'surveys': surveys, 'total_points': sum(s['n'] for s in surveys)}
p = os.path.join(OUT, 'fwd_surveys.json')
json.dump(fwd, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
print(f'fwd_surveys.json: {len(surveys)} surveys, {fwd["total_points"]} deflection bowls')
