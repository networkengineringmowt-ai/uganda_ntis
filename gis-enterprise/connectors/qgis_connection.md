# QGIS connector

Three ways to connect QGIS, from richest to lightest.

## 1. Direct PostGIS (full read/write, recommended for GIS officers)
`Layer ▸ Add Layer ▸ Add PostGIS Layers ▸ New`

| Field | Value |
|-------|-------|
| Name | `UGROADS geodatabase` |
| Host | `localhost` (or the DB server hostname) |
| Port | `5434` |
| Database | `ugroads` |
| SSL mode | `prefer` (`require` in production) |
| Username | `gis_editor` (edit) or `gis_viewer` (read-only) |
| Password | from `.env` |

You then see schemas `core / traffic / pms / rms` with every table, full
attribute editing (writes are captured by the audit triggers), the DB-side
GiST spatial indexes, and on-the-fly reprojection from EPSG:4326.

## 2. WFS (OGC, works over the web adaptor, no DB exposure)
`Layer ▸ Add Layer ▸ Add WFS / OGC API – Features Layer ▸ New`

- URL: `https://gis.unra.go.ug/geoserver/ows`
- Version: `2.0.0` (WFS-T supported for `gis_editor` credentials)
- Or OGC API – Features: `https://gis.unra.go.ug/features`

## 3. WMS / WMTS (styled basemaps, fastest for viewing)
`Layer ▸ Add Layer ▸ Add WMS/WMTS Layer ▸ New`

- WMS: `https://gis.unra.go.ug/geoserver/ows?service=wms&version=1.3.0&request=GetCapabilities`
- WMTS (cached): `https://gis.unra.go.ug/geoserver/gwc/service/wmts?REQUEST=GetCapabilities`

## Ready-made connection profile
Import `qgis_ugroads.qgs`-style settings by pasting this into a QGIS
`.qgz`/project, or add via the Browser panel ▸ PostGIS ▸ New Connection with the
table-1 values. A saved connection XML for `Settings ▸ Import/Export` is below:

```xml
<!-- QGIS3.ini  [PostgreSQL][connections][UGROADS] -->
host=localhost
port=5434
database=ugroads
username=gis_viewer
sslmode=1
publicOnly=false
geometryColumnsOnly=true
```
