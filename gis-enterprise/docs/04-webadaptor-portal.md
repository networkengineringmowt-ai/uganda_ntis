# L2 · Web Adaptor + Portal

The single public front door. Combines the two ArcGIS-Enterprise front-tier
roles — **Web Adaptor** (reverse proxy + TLS + one origin) and **Portal**
(home / sharing hub / catalogue) — in one lightweight nginx container.

Config: [`../webadaptor/nginx.conf`](../webadaptor/nginx.conf) ·
Portal: [`../portal/index.html`](../portal/index.html) ·
Connectors: [`../connectors/`](../connectors/).

## 1. Web Adaptor (nginx reverse proxy)
Why it exists: without it, clients juggle five host/port combos and five TLS
setups. The adaptor presents **one origin** with stable paths and one cert.

| Path | → upstream | Purpose |
|------|-----------|---------|
| `/portal/` | static | Portal home + service catalogue |
| `/geoserver/` | geoserver:8080 | WMS/WFS-T/WMTS/WPS + REST admin |
| `/tiles/` | pg_tileserv:7800 | MVT vector tiles (**edge-cached**) |
| `/features/` | pg_featureserv:9000 | OGC API – Features |
| `/pgadmin/` | pgadmin:80 | DB administration UI |
| `/health` | — | liveness probe |

Built in: gzip, `X-Forwarded-*` so back-ends emit correct absolute URLs behind
TLS, a 2 GB disk **tile cache** (`X-Tile-Cache: HIT/MISS`, 1-day TTL), 512 MB
upload cap for shapefile/GeoPackage ingest, security headers, and a commented
**HTTPS server block** ready for certs.

```
http://localhost:8088/                 # local (docker-compose maps 8088→80)
https://gis.unra.go.ug/                 # production (DNS + TLS)
```

### Enable TLS (production)
1. Drop `fullchain.pem` / `privkey.pem` in `webadaptor/certs/`.
2. Uncomment the `:443` server block and the `certs` volume in compose.
3. Add an HTTP→HTTPS redirect; renew with certbot or an internal CA.

## 2. Portal (home & service catalogue)
A branded landing page (`portal/index.html`) that is the OSS analogue of *Portal
for ArcGIS* home — a discovery hub, not a heavyweight CMS:
- **Applications** (client layer): NRMS, NBMS, NTIS, QGIS.
- **Geospatial Services** (service layer): GeoServer, tiles, features, with
  **live health dots** probed through the adaptor.
- **Published Layers** (data layer): the catalogue table mapping each layer to
  `schema.table`, geometry type and the endpoints that serve it.
- **Administration**: pgAdmin, gisctl, audit/versioning.

It's static (HTML+JS), so it costs nothing to run and is trivially themable to
MoWT branding (already carries the crest + dark-neon palette).

## 3. Connectors (how clients attach)
Each documented with copy-paste settings in [`../connectors/`](../connectors/):
QGIS (PostGIS/WFS/WMS), Esri ArcGIS (WMS/WMTS/WFS/OGC), web clients
(MapLibre/Leaflet/OpenLayers), REST/OGC-API (`/features`) and Python/GeoPandas.

## 4. Security model at the front door
- Only `/geoserver`, `/tiles`, `/features`, `/pgadmin`, `/portal` are routed —
  raw DB port `5434` and service ports are **not** internet-exposed (publish only
  `8088`/`443` from the host; keep the rest on the internal docker network).
- Public services run as `svc_web`/`gis_viewer` (read-only). WFS-T and pgAdmin
  require authentication.
- Add rate-limiting (`limit_req_zone`) and IP allow-lists for `/pgadmin` and
  GeoServer REST admin in hardened deployments.
- Put the adaptor behind the MoWT firewall/VPN for internal-only tiers.
