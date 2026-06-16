# L3 · Service Layer

Open-standard geospatial services over the geodatabase. Three engines, each
best at one job; all reachable through the web adaptor.

| Engine | Standard(s) | Port | Adaptor path | Backing role |
|--------|-------------|------|--------------|--------------|
| GeoServer | WMS, WFS-T, WMTS, WPS, CSW | 8080 | `/geoserver/` | `gis_editor` (WFS-T) / `gis_viewer` |
| pg_tileserv | Mapbox Vector Tiles (MVT/XYZ) | 7800 | `/tiles/` | `svc_web` (SELECT) |
| pg_featureserv | OGC API – Features | 9000 | `/features/` | `svc_web` (SELECT) |

---

## 1. GeoServer — the OGC workhorse
Publishes styled maps, editable features, cached tiles and geoprocessing.

**Publish a layer (one-time):**
1. `/geoserver/web` → login `admin` / `${GEOSERVER_PASSWORD}` (from `.env`).
2. **Stores ▸ Add ▸ PostGIS** → host `postgis`, port `5432`, db `ugroads`,
   schema `core`, user `gis_viewer`. (Use the *internal* docker host/port.)
3. **Layers ▸ Publish** `network_links`, `bridges`, `atc_sites` → set the
   declared SRS `EPSG:4326`, compute native + lat/lon bounds.
4. **Styles ▸ Add** → upload [`../geoserver/styles/network_class.sld`](../geoserver/styles/network_class.sld);
   set it as the layer's default style.

**Services exposed per published layer:**
- **WMS** styled images — `/geoserver/ows?service=wms&request=GetMap&layers=core:network_links&styles=network_class&...`
- **WFS / WFS-T** features + transactions — `/geoserver/ows?service=wfs&request=GetFeature&typeNames=core:bridges&outputFormat=application/json`
- **WMTS** cached tiles (GeoWebCache) — `/geoserver/gwc/service/wmts`
- **WPS** geoprocessing — buffer, intersection, `ras:*`, plus custom processes.

**Editing (WFS-T):** allow only `gis_editor` under *Security ▸ Data ▸ rules*
(`core.*.w = ROLE_EDITOR`). Public read stays open; writes require auth. Every
write hits the audit trigger and is reversible.

---

## 2. pg_tileserv — instant vector tiles
Zero-config MVT for every spatial table. No publishing step — the table *is* the
layer.

- Catalogue: `/tiles/index.json`
- Tile URL: `/tiles/{schema.table}/{z}/{x}/{y}.pbf`
  e.g. `/tiles/core.network_links/8/152/121.pbf`
- Layer detail/metadata: `/tiles/core.bridges.json`
- **Function layers**: any `postgisftw.*` function returning geometry becomes a
  parameterised tile layer (filter by class, year, region server-side).

The adaptor edge-caches tiles (`X-Tile-Cache: HIT/MISS`, 1-day TTL) so repeat
views never touch the database.

---

## 3. pg_featureserv — OGC API – Features (REST/GeoJSON)
Modern REST surface for apps, ETL and analytics. Read-only (`svc_web`).
Full reference + examples: [`../connectors/rest_api.md`](../connectors/rest_api.md).
Highlights: `/collections`, `/collections/{id}/items` with `bbox`, attribute
filters, `properties=`, paging, and `postgisftw.*` **function services**
(e.g. `bridges_near`).

---

## 4. Geoprocessing & geocoding
- **WPS (GeoServer):** built-in vector/raster processes; chain via WPS requests
  or the platform's analytics.
- **In-database analysis:** PostGIS does the heavy lifting (`ST_DWithin`,
  `ST_Intersection`, `ST_LineLocatePoint` for chainage, nearest-bridge, overlay)
  — exposed as `postgisftw.*` function services so clients call them as REST.
- **Geocoding:** add a Pelias/Nominatim container against Ugandan OSM if address
  search is needed; publish through the same adaptor path `/geocode/` (optional,
  documented for future scale-out).

---

## 5. Service-layer SLOs & tuning
- Vector tiles: serve from cache; precompute hot zoom levels with GWC seed.
- WFS GetFeature: cap with `count=`; rely on GiST indexes (built in `02_schema.sql`).
- Connection pool: GeoServer JNDI / pg_*serv `DATABASE_URL` pool sized to CPU.
- Long ops (WPS, big WFS): adaptor `proxy_read_timeout 300s` already set.
