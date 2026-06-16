# L1 · Client Layer

Everything that *consumes* the services. Because the service layer is pure OGC +
REST, the client set is open-ended — no proprietary runtime required.

## 1. Web applications (the DNR platform)
| App | URL | Built from | Live data path |
|-----|-----|-----------|----------------|
| NRMS platform | priscananjehe1996.github.io/uganda-roads/ | React+TS+Vite (`src/`) | bundled GeoJSON today → can switch to `/tiles` & `/features` |
| NBMS standalone | …/uganda_nbms/ | `src/nbms.tsx` | same |
| NTIS standalone | …/uganda_ntis/ | `src/ntis.tsx` | same |

These ship as static SPAs on GitHub Pages and read the canonical G: data baked
into `public/data`. To make any layer **live**, swap its Leaflet source for a
service-layer endpoint — see [`../connectors/web_clients.md`](../connectors/web_clients.md).
The three apps share one auth model (rms/bms/tis field · super · admin) and the
branded *Secure Gateway* login.

## 2. Desktop GIS — QGIS
The GIS officers' authoring tool. Connects three ways (direct PostGIS for full
editing, WFS for web-safe editing, WMS/WMTS for fast viewing) — full steps in
[`../connectors/qgis_connection.md`](../connectors/qgis_connection.md). QGIS is
the OSS counterpart to ArcGIS Pro for cartography, geoprocessing, layout/atlas
printing, and publishing styles (SLD) that GeoServer then serves.

## 3. Esri clients (interoperability)
ArcGIS Pro / ArcGIS Online consume our WMS/WMTS/WFS/OGC-API services directly —
no Esri licence needed on the UGROADS side. See
[`../connectors/arcgis_connection.md`](../connectors/arcgis_connection.md).

## 4. Mobile / field capture
- The platform's **`rms`/`bms`/`tis`** roles open a mobile-first field-capture
  shell (`src/modules/RMS/RMSFieldShell`) for bridge inspections, traffic counts
  and condition surveys.
- Offline-tolerant: submissions queue in `localStorage` and flush to the
  data-entry server when connectivity returns (writes are audited).
- QField (QGIS mobile) is the heavy-duty option — it reads the same PostGIS/WFS
  layers for disconnected field editing with later sync.

## 5. Programmatic clients
Any language with HTTP. GeoPandas/`requests` for Python ETL and analytics,
`curl`/`httpie` for ops, R `sf` via WFS — all through
[`../connectors/rest_api.md`](../connectors/rest_api.md).

## Client-side performance guidance
- **Whole-network rendering** → MVT (`/tiles`) — vector, client-styled, cached.
- **Thematic/legended maps** → WMS with a server SLD (`network_class`).
- **Analysis / export / joins** → OGC API – Features (`/features`) GeoJSON.
- Prefer WMTS/MVT (cached) over WMS for basemaps to keep DB load near zero.
