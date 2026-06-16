# Connectors — how every client talks to the stack

The **service layer** speaks open standards, so any OGC- or REST-capable client
connects with no proprietary driver. This folder documents each connector and
ships ready-to-use connection files. All URLs assume the **Web Adaptor** origin
`https://gis.unra.go.ug` (locally `http://localhost:8088`).

| Client | Protocol | Endpoint | File |
|--------|----------|----------|------|
| QGIS (desktop) | WFS / WMS / direct PostGIS | `/geoserver/ows`, `/features`, `:5434` | [`qgis_connection.md`](qgis_connection.md) |
| Esri ArcGIS Pro / Map | WMS / WMTS / WFS (OGC) | `/geoserver/ows`, `/geoserver/gwc/service/wmts` | [`arcgis_connection.md`](arcgis_connection.md) |
| Leaflet / OpenLayers / MapLibre | XYZ-MVT / WMS / GeoJSON | `/tiles`, `/geoserver/ows`, `/features` | [`web_clients.md`](web_clients.md) |
| Any REST client / ETL | OGC API – Features (GeoJSON) | `/features/collections/...` | [`rest_api.md`](rest_api.md) |
| Python / GeoPandas | OGC API / direct PostGIS | `/features`, `:5434` | [`rest_api.md`](rest_api.md) |
| QGIS Server / GDAL | OGC | `/geoserver/ows` | — |

## The three access roles for services
- **`svc_web`** (read-only) — backs pg_tileserv and pg_featureserv; SELECT only.
- **`gis_editor`** — WFS-T transactions through GeoServer (INSERT/UPDATE/DELETE).
- **`gis_admin`** — schema, publishing, maintenance (via gisctl / pgAdmin).

Never expose `gis_admin` to a public service. The public web origin only ever
reaches `svc_web` (tiles/features) and GeoServer's read services; editing is
authenticated through GeoServer security or the platform's data-entry server.
