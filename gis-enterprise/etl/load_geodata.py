"""load_geodata — load every G: canonical layer into the PostGIS geodatabase.

Sources are the same masters the platform bundle uses (public/data), so PostGIS
and the static SPA always agree. Re-runnable: tables are replaced atomically.

  pip install psycopg2-binary sqlalchemy geoalchemy2 geopandas
  python etl/load_geodata.py            (reads connection from ../.env or env vars)
"""
import json, os, sys
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point
from sqlalchemy import create_engine, text

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
DATA = os.path.join(REPO, 'public', 'data')

def env(key, default=None):
    # .env (simple KEY=VALUE) then process env
    envfile = os.path.join(HERE, '..', '.env')
    if os.path.exists(envfile):
        for line in open(envfile, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())
    return os.environ.get(key, default)

url = (f"postgresql+psycopg2://{env('PGUSER','gis_admin')}:{env('PGPASSWORD','')}"
       f"@{env('PGHOST','localhost')}:{env('PGPORT','5432')}/{env('PGDATABASE','ugroads')}")
eng = create_engine(url)

def load_json(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)

def done(schema, table, n):
    print(f'  {schema}.{table:<22} {n:>6} rows')

# ── core.network_links (attributes + network2026 geometry) ───────────────────
links = pd.DataFrame(load_json('network_links.json')).rename(columns={
    'maintenance_station': 'station', 'maintenance_region': 'region',
    'completion_year': 'completion_yr', 'rehab_year': 'rehab_yr',
    'last_intervention': 'last_interv'})
for c in ('completion_yr', 'rehab_yr', 'last_interv'):
    links[c] = pd.to_numeric(links[c], errors='coerce').astype('Int64')
links['pavement_age'] = pd.to_numeric(links['pavement_age'], errors='coerce')

geo = gpd.read_file(os.path.join(DATA, 'network2026.geojson'))[['link_id', 'geometry']]
geo = geo.dissolve(by='link_id').reset_index()           # one MultiLineString per link
gdf = gpd.GeoDataFrame(links.merge(geo, on='link_id', how='left'),
                       geometry='geometry', crs='EPSG:4326')
gdf = gdf.set_geometry(gdf.geometry.apply(lambda g: g))   # keep None geoms
gdf.to_postgis('network_links', eng, schema='core', if_exists='replace', index=False)
done('core', 'network_links', len(gdf))

# ── core.bridges (BMS inventory + element conditions) ────────────────────────
bj = load_json('bridges2026.geojson')
rows = []
for f in bj['features']:
    p, g = f['properties'], f.get('geometry')
    rows.append({
        'bridge_no': p.get('bridge_no'), 'bridge_name': p.get('bridge_nam'),
        'link_id': p.get('link_no'), 'link_name': p.get('link_name'),
        'road_no': p.get('roadno'), 'region': p.get('region'),
        'river': p.get('river'), 'chainage_km': p.get('km'),
        'type_crossing': p.get('type_cross'), 'bridge_type': p.get('bridge_type'),
        'deck_material': p.get('deck_material'), 'spans': p.get('spans'),
        'length_m': p.get('length_m'), 'width_m': p.get('width_m'),
        'lanes': p.get('lanes'), 'completion_yr': p.get('completion_year'),
        'last_interv': p.get('last_intervention'), 'scour_risk': p.get('scour_risk'),
        'r_approaches': p.get('rating_approaches'), 'r_roadway': p.get('rating_roadway'),
        'r_substructure': p.get('rating_substructure'),
        'r_superstructure': p.get('rating_superstructure'),
        'r_waterway': p.get('rating_waterway'), 'overall_rating': p.get('overall_rating'),
        'bms_product': p.get('bms_product'), 'growth_rate': p.get('growth_rate'),
        'predicted_aadt': p.get('predicted_aadt_2026'),
        'inspection_note': p.get('inspection_comment'),
        'geometry': Point(g['coordinates']) if g and g.get('coordinates') else None,
    })
bdf = gpd.GeoDataFrame(pd.DataFrame(rows), geometry='geometry', crs='EPSG:4326')
# the bridges FK references network_links — drop link ids not in the master
valid = set(links['link_id'])
bdf.loc[~bdf['link_id'].isin(valid), 'link_id'] = None
bdf.to_postgis('bridges', eng, schema='core', if_exists='replace', index=False)
done('core', 'bridges', len(bdf))

# ── pms.link_condition ────────────────────────────────────────────────────────
cond = load_json('link_condition_lookup.json')
cdf = pd.DataFrame([{'link_id': k, **v} for k, v in cond.items()]).rename(
    columns={'year': 'survey_year'})
cdf.to_sql('link_condition', eng, schema='pms', if_exists='replace', index=False)
done('pms', 'link_condition', len(cdf))

# ── pms.fwd_bowls ─────────────────────────────────────────────────────────────
fwd = load_json('fwd_surveys.json')
frows = [{'road': s['road'], 'sheet': s['sheet'], 'chainage_km': p['ch'],
          'd0': p['d0'], 'd300': p.get('d300'), 'd600': p.get('d600'),
          'd900': p.get('d900'), 'load_kn': p.get('load')}
         for s in fwd['surveys'] for p in s['points']]
pd.DataFrame(frows).to_sql('fwd_bowls', eng, schema='pms', if_exists='replace', index=False)
done('pms', 'fwd_bowls', len(frows))

# ── traffic.atc_sites ─────────────────────────────────────────────────────────
atc = load_json('atc_adt_2026.json')
arows = []
for s in atc['sites']:
    arows.append({'site': s['site'], 'link': s.get('link'),
                  'road_section': s.get('road_section'), 'region': s.get('region'),
                  'survey_days': s.get('survey_days'), 'adt_total': s.get('adt_total'),
                  'avg_speed': s.get('avg_speed_kmh'),
                  'adt_by_class': json.dumps(s.get('adt_by_class', {})),
                  'geometry': Point(s['lon'], s['lat'])
                              if s.get('lon') is not None and s.get('lat') is not None else None})
adf = gpd.GeoDataFrame(pd.DataFrame(arows), geometry='geometry', crs='EPSG:4326')
adf.to_postgis('atc_sites', eng, schema='traffic', if_exists='replace', index=False)
with eng.begin() as cx:
    cx.execute(text("ALTER TABLE traffic.atc_sites "
                    "ALTER COLUMN adt_by_class TYPE jsonb USING adt_by_class::jsonb"))
done('traffic', 'atc_sites', len(adf))

# ── rms.inventory_links ───────────────────────────────────────────────────────
inv = load_json('road_inventory_2023.json')
irows = [{'link_id': l['link_id'], 'link_name': l['link_name'], 'region': l['region'],
          'station': l['station'], 'material': l['material_type'],
          'road_width_m': l['road_width_m'], 'shoulder_pct': l['has_shoulder_pct'],
          'shoulder_width_m': l['shoulder_width_m'],
          'reserve_width_m': l['road_reserve_width_m'], 'lanes': str(l.get('lanes') or ''),
          'terrain': l['terrain'], 'line_features': json.dumps(l['line_features']),
          'point_features': json.dumps(l['point_features']),
          'line_records': l['line_records'], 'point_records': l['point_records']}
         for l in inv['links']]
pd.DataFrame(irows).to_sql('inventory_links', eng, schema='rms', if_exists='replace', index=False)
with eng.begin() as cx:
    for col in ('line_features', 'point_features'):
        cx.execute(text(f"ALTER TABLE rms.inventory_links "
                        f"ALTER COLUMN {col} TYPE jsonb USING {col}::jsonb"))
done('rms', 'inventory_links', len(irows))

# ── re-apply spatial indexes, grants and audit triggers (to_postgis replaced) ─
with eng.begin() as cx:
    cx.execute(text("""
      CREATE INDEX IF NOT EXISTS network_links_geom_gix ON core.network_links USING gist (geom);
      CREATE INDEX IF NOT EXISTS bridges_geom_gix ON core.bridges USING gist (geometry);
      GRANT SELECT ON ALL TABLES IN SCHEMA core, traffic, pms, rms TO gis_viewer, svc_web;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core, traffic, pms, rms TO gis_editor;
    """))
    # geometry column from to_postgis is named 'geometry'; standardise links to 'geom'
    cx.execute(text("""
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='core' AND table_name='network_links' AND column_name='geometry') THEN
          ALTER TABLE core.network_links RENAME COLUMN geometry TO geom;
        END IF;
      END $$;
    """))
print('reattaching audit triggers…')
with eng.begin() as cx:
    cx.execute(text(open(os.path.join(HERE, '..', 'sql', '03_audit_triggers.sql'),
                         encoding='utf-8').read()))
print('LOAD COMPLETE — geodatabase is current with the G: masters')
