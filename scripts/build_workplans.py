"""build_workplans — ingest URF Annual Work Plans (Maintenance Strategy/Annual WPs.xlsx)
into public/data/annual_workplans.json. One block per FY sheet (2021-22 .. 2025-26):
category / surface rows with treated km and planned expenditure (UGX '000),
plus per-FY totals in UGX Bn. FY2025-26 is the current reporting programme.
"""
import json, os, warnings
import pandas as pd
warnings.filterwarnings('ignore')

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..'))
G    = os.path.normpath(os.path.join(REPO, '..'))
OUT  = os.path.join(REPO, 'public', 'data', 'annual_workplans.json')

SURFACES = {'paved roads': 'Paved', 'un paved roads': 'Unpaved', 'unpaved roads': 'Unpaved'}
def is_bridge(t): return 'bridge' in t and 'culvert' in t

x = pd.ExcelFile(os.path.join(G, 'Maintenance Strategy', 'Annual WPs.xlsx'))
out = {}
for sheet in x.sheet_names:
    df = x.parse(sheet, header=None)
    # locate the header row + Planned-Exp column
    pcol = None
    for i in range(min(12, len(df))):
        for j, v in enumerate(df.iloc[i].tolist()):
            if isinstance(v, str) and 'planned exp' in v.lower():
                pcol = j; break
        if pcol is not None:
            hdr = i; break
    if pcol is None:
        print(f'  [{sheet}] no Planned Exp column — skipped'); continue
    rows, category = [], None
    for i in range(hdr + 1, len(df)):
        cells = df.iloc[i].tolist()
        texts = [(j, str(v).strip()) for j, v in enumerate(cells[:pcol]) if isinstance(v, str) and str(v).strip()]
        planned = pd.to_numeric(cells[pcol], errors='coerce')
        treated = pd.to_numeric(cells[pcol - 1], errors='coerce')
        surf = next((t for _, t in texts if t.lower() in SURFACES or is_bridge(t.lower())), None)
        if surf:
            rows.append({
                'category': category or 'Uncategorised',
                'surface': SURFACES.get(surf.lower(), 'Bridges & Culverts'),
                'length_treated_km': round(float(treated), 1) if pd.notna(treated) else None,
                'planned_ugx_000': round(float(planned), 1) if pd.notna(planned) else 0,
            })
        elif texts:
            t = texts[0][1]
            tl = t.lower()
            if 'sub total' in tl or 'total' == tl or tl.startswith('grand'):
                continue
            if 'of which' in tl or tl.startswith('q'):
                continue
            if len(t) > 5 and not tl.startswith(('designated', 'table', 'uganda', 'annual', 'summary')):
                category = t.strip()
    total = sum(r['planned_ugx_000'] for r in rows)
    by_cat = {}
    for r in rows:
        by_cat[r['category']] = round(by_cat.get(r['category'], 0) + r['planned_ugx_000'] / 1e6, 2)
    out[sheet.replace('-', '/')] = {
        'rows': rows,
        'total_planned_ugx_bn': round(total / 1e6, 1),
        'by_category_ugx_bn': by_cat,
    }
    print(f'  [{sheet}] rows={len(rows)} total=UGX {total/1e6:,.1f} Bn · cats={list(by_cat)[:5]}')

json.dump({'source': 'Maintenance Strategy/Annual WPs.xlsx (Uganda Road Fund)',
           'generated': '2026-06-11', 'current_fy': '2025/26', 'years': out},
          open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print('annual_workplans.json written')
