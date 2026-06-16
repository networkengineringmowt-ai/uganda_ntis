# REST / OGC API – Features connector (pg_featureserv)

Standards-based REST over every PostGIS layer and function. Base:
`https://gis.unra.go.ug/features` (local `http://localhost:9000`).

## Discovery
| What | URL |
|------|-----|
| Landing / API | `/` · `/api` (OpenAPI 3) |
| Collections | `/collections` |
| One collection | `/collections/core.bridges` |
| Conformance | `/conformance` |

## Reading features
```
GET /collections/core.network_links/items?limit=100&f=json
GET /collections/core.bridges/items/B204                # by feature id
GET /collections/core.bridges/items?road_no=A109&limit=50
GET /collections/core.network_links/items?bbox=29.5,-1.5,35.0,4.2
GET /collections/core.bridges/items?properties=bridge_no,overall_rating,geom
```
Every response is RFC-7946 GeoJSON with `numberMatched` / `next` links for paging.

## Python / GeoPandas
```python
import geopandas as gpd
url = ("https://gis.unra.go.ug/features/collections/"
       "core.bridges/items?limit=2000&f=json")
bridges = gpd.read_file(url)                 # → GeoDataFrame, CRS EPSG:4326
poor = bridges[bridges.overall_rating.isin(['Poor','Very Poor'])]
```

## Function services (parameterised queries published as endpoints)
Create a Postgres function in schema `postgisftw` and pg_featureserv exposes it:
```sql
CREATE FUNCTION postgisftw.bridges_near(lon float, lat float, radius_km float)
RETURNS TABLE(bridge_no text, name text, km numeric, geom geometry) AS $$
  SELECT bridge_no, bridge_name,
         round((ST_Distance(geom::geography,
               ST_MakePoint(lon,lat)::geography)/1000)::numeric,2),
         geom
  FROM core.bridges
  WHERE ST_DWithin(geom::geography, ST_MakePoint(lon,lat)::geography, radius_km*1000)
  ORDER BY 3;
$$ LANGUAGE sql STABLE;
```
→ `GET /functions/bridges_near/items?lon=32.58&lat=0.31&radius_km=10`

## Writing
pg_featureserv is **read-only** (backed by `svc_web`). For transactional
edits use GeoServer **WFS-T** with `gis_editor` credentials, or the platform's
data-entry server (`server/`) which writes server-side and is audited.
