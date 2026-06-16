# UGROADS GIS Enterprise — Architecture Overview

A complete, **open-source** enterprise GIS for the Department of National Roads
that matches the capability tiers of ArcGIS Enterprise — **client, service,
data, web-adaptor and portal layers** — with **zero licence or per-seat cost**.

> Stack: PostgreSQL 16 + PostGIS 3.4 · GeoServer 2.25 · pg_tileserv ·
> pg_featureserv · QGIS · nginx (web adaptor) · pgAdmin. Orchestrated by one
> `docker compose up -d`.

---

## 1. Esri → open-source capability map

| ArcGIS Enterprise component | Role | UGROADS open-source equivalent |
|---|---|---|
| ArcGIS Server (GIS Server) | Map/feature/geoprocessing services | **GeoServer** (WMS, WFS-T, WMTS, WPS) |
| ArcGIS Data Store / Enterprise GDB (ArcSDE) | Managed spatial store + versioning | **PostgreSQL/PostGIS** + `audit.*` triggers |
| Vector/Scene tile services | Vector tiles | **pg_tileserv** (MVT) |
| Feature service (REST) | REST/GeoJSON features | **pg_featureserv** (OGC API – Features) |
| Portal for ArcGIS | Sharing hub / home / catalogue | **Portal** (`portal/`, served by adaptor) |
| ArcGIS Web Adaptor | Single origin + reverse proxy + TLS | **nginx web adaptor** (`webadaptor/`) |
| ArcGIS Pro / Online | Authoring & viewing clients | **QGIS** + the React apps + any OGC client |
| Server Manager / ArcSDE admin | Administration | **pgAdmin** + **gisctl** CLId |
| Geodatabase archiving | Row history / time travel | **audit-trigger** + `audit.restore_row()` |

Everything an Esri stack does for road-asset management — publish, serve, edit,
tile, secure, administer, version — has a first-class OSS counterpart here.

---

## 2. The five layers

```
                          ┌──────────────────────────────────────────────┐
   L1  CLIENT LAYER       │  NRMS · NBMS · NTIS web apps   QGIS desktop    │
   (who consumes it)      │  Leaflet/MapLibre/OpenLayers   ArcGIS Pro/AGOL │
                          │  Mobile field-capture          REST/ETL scripts│
                          └───────────────┬──────────────────────────────┘
                                          │  HTTPS (one origin)
                          ┌───────────────▼──────────────────────────────┐
   L2  WEB ADAPTOR        │  nginx — TLS, reverse proxy, gzip, tile cache, │
   + PORTAL               │  security headers · Portal home & catalogue   │
   (single front door)    │  /portal /geoserver /tiles /features /pgadmin │
                          └───────────────┬──────────────────────────────┘
                                          │  internal docker network
            ┌─────────────────────────────┼─────────────────────────────┐
   L3  SERVICE LAYER      │  GeoServer        pg_tileserv     pg_featureserv│
   (open standards)       │  WMS/WFS-T/WMTS    MVT tiles       OGC API Feats │
                          │  /WPS, GWC cache                   + functions   │
                          └───────────────┬──────────────────────────────┘
                                          │  SQL (least-privilege roles)
                          ┌───────────────▼──────────────────────────────┐
   L4  DATA LAYER         │  PostgreSQL 16 + PostGIS 3.4 — the geodatabase │
   (system of record)     │  schemas core/traffic/pms/rms · GiST indexes   │
                          │  audit.history (versioning) · backups          │
                          └───────────────┬──────────────────────────────┘
                                          │
                          ┌───────────────▼──────────────────────────────┐
   L5  MANAGEMENT /       │  gisctl CLI · pgAdmin · ETL (GeoPandas/GDAL)   │
       CONNECTORS         │  backups · audit/restore · sync to public bundle│
                          └──────────────────────────────────────────────┘
```

Each layer is documented in detail:
- **[01-client-layer.md](01-client-layer.md)** — apps, desktop, mobile, OGC clients
- **[02-service-layer.md](02-service-layer.md)** — GeoServer, pg_tileserv, pg_featureserv, WPS, geocode
- **[03-data-layer.md](03-data-layer.md)** — PostGIS schemas, roles, indexes, versioning, ETL
- **[04-webadaptor-portal.md](04-webadaptor-portal.md)** — nginx adaptor, portal, connectors, security
- **[05-operations.md](05-operations.md)** — deploy, scale, backup/restore, monitor, DR

---

## 3. Request lifecycle (example: draw the road network on a web map)

```
Browser ──GET /tiles/core.network_links/8/152/121.pbf──▶ nginx adaptor
   adaptor: cache MISS → proxy to pg_tileserv (svc_web, SELECT only)
   pg_tileserv: ST_AsMVT( ... ) on core.network_links using GiST index
   PostGIS: returns protobuf tile  ──▶ pg_tileserv ──▶ adaptor (cache STORE, 1d)
   adaptor ──▶ Browser (X-Tile-Cache: MISS).   Next request → HIT (no DB hit).
```

Editing flows the same way but through **GeoServer WFS-T** with `gis_editor`
credentials; every INSERT/UPDATE/DELETE is recorded by the `audit.log_change()`
trigger so the change is reversible (`audit.restore_row()`), exactly like
geodatabase archiving.

---

## 4. Cost & licensing

Every component is OSI-licensed (PostGIS GPL-2.0, GeoServer GPL-2.0, pg_tileserv/
pg_featureserv MIT/Apache, QGIS GPL-2.0, nginx BSD-2). **No licence fees, no
per-seat costs, no core limits, no internet dependency** — it runs fully on a
single MoWT server or laptop and scales horizontally when needed (see
[05-operations.md](05-operations.md)).
