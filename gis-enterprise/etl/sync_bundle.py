"""sync_bundle — PostGIS → the static app bundle (public/data).

Once the geodatabase is the editing environment (QGIS / WFS-T / SQL), run this
after edit sessions to regenerate the JSON files the GitHub-Pages SPA reads,
then rebuild + deploy as usual. Keeps the zero-cost static frontend while the
backend behaves like a live enterprise geodatabase.

  python etl/sync_bundle.py
"""
import json, os
import geopandas as gpd
import pandas as pd
from sqlalchemy import create_engine

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
DATA = os.path.join(REPO, 'public', 'data')

def env(key, default=None):
    envfile = os.path.join(HERE, '..', '.env')
    if os.path.exists(envfile):
        for line in open(envfile, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())
    return os.environ.get(key, default)

eng = create_engine(f"postgresql+psycopg2://{env('PGUSER','gis_admin')}:{env('PGPASSWORD','')}"
                    f"@{env('PGHOST','localhost')}:{env('PGPORT','5432')}/{env('PGDATABASE','ugroads')}")

# network_links.json (attribute master)
links = pd.read_sql('SELECT * FROM core.network_links', eng)
geomcol = 'geom' if 'geom' in links.columns else 'geometry'
links = links.drop(columns=[geomcol], errors='ignore').rename(columns={
    'station': 'maintenance_station', 'region': 'maintenance_region',
    'completion_yr': 'completion_year', 'rehab_yr': 'rehab_year',
    'last_interv': 'last_intervention'})
links.where(pd.notna(links), None).to_json(  # NaN→null
    os.path.join(DATA, 'network_links.json'), orient='records', force_ascii=False)
print(f'network_links.json  {len(links)} rows')

# network2026.geojson (geometry)
g = gpd.read_postgis('SELECT link_id, road_no, road_class, link_name, geom FROM core.network_links WHERE geom IS NOT NULL',
                     eng, geom_col='geom')
g = g.rename(columns={'link_name': 'link_nam_1'})
g.to_file(os.path.join(DATA, 'network2026.geojson'), driver='GeoJSON')
print(f'network2026.geojson {len(g)} features')

# bridges2026.geojson
b = gpd.read_postgis('SELECT * FROM core.bridges', eng, geom_col='geometry')
feats = []
for _, r in b.iterrows():
    geom = None
    if r.geometry is not None and not r.geometry.is_empty:
        geom = {'type': 'Point', 'coordinates': [r.geometry.x, r.geometry.y]}
    feats.append({'type': 'Feature', 'geometry': geom, 'properties': {
        'bridge_no': r.bridge_no, 'bridge_nam': r.bridge_name, 'link_name': r.link_name,
        'link_no': r.link_id, 'roadno': r.road_no, 'river': r.river, 'km': r.chainage_km,
        'region': r.region, 'type_cross': r.type_crossing, 'surface_ty': None,
        'bridge_type': r.bridge_type, 'deck_material': r.deck_material, 'spans': r.spans,
        'length_m': r.length_m, 'width_m': r.width_m, 'lanes': r.lanes,
        'completion_year': r.completion_yr, 'last_intervention': r.last_interv,
        'scour_risk': r.scour_risk, 'rating_approaches': r.r_approaches,
        'rating_roadway': r.r_roadway, 'rating_substructure': r.r_substructure,
        'rating_superstructure': r.r_superstructure, 'rating_waterway': r.r_waterway,
        'overall_rating': r.overall_rating, 'bms_product': r.bms_product,
        'growth_rate': r.growth_rate, 'predicted_aadt_2026': r.predicted_aadt,
        'inspection_comment': r.inspection_note}})
json.dump({'type': 'FeatureCollection', 'name': 'bridges2026_bms', 'features': feats},
          open(os.path.join(DATA, 'bridges2026.geojson'), 'w', encoding='utf-8'),
          ensure_ascii=False, default=lambda o: None if pd.isna(o) else o)
print(f'bridges2026.geojson {len(feats)} features')

print('SYNC COMPLETE — rebuild & deploy the SPA to publish (see DOCUMENTATION.md §8)')
