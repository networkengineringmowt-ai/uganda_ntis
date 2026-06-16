# Esri ArcGIS connector (interoperability, no Esri licence needed on our side)

ArcGIS Pro / ArcGIS Online / ArcGIS Enterprise consume the same OGC services
GeoServer publishes — so an Esri shop integrates with UGROADS without us buying
anything. (This is the whole point of standing on open standards.)

## ArcGIS Pro
- **WMS:** *Insert ▸ Connections ▸ Server ▸ New WMS Server*
  URL `https://gis.unra.go.ug/geoserver/ows?service=WMS&request=GetCapabilities`
- **WMTS (cached tiles):** *New WMTS Server*
  URL `https://gis.unra.go.ug/geoserver/gwc/service/wmts?REQUEST=GetCapabilities`
- **WFS (features, ArcGIS Pro 2.4+):** *New WFS Server*
  URL `https://gis.unra.go.ug/geoserver/ows?service=WFS&request=GetCapabilities`
- **OGC API – Features (Pro 3.x):** *New OGC API Server* → `https://gis.unra.go.ug/features`

## ArcGIS Online / Enterprise
*Content ▸ Add Item ▸ From URL* → choose **WMS / WMTS / WFS OGC** and paste the
GetCapabilities URL. The layers can then be added to Web Maps and Dashboards.

## Going the other way (consuming Esri services here)
GeoServer can cascade an external ArcGIS MapServer/FeatureServer:
*Stores ▸ Add new store ▸ ArcGIS REST* (or WMS cascade), then republish — useful
to bring in UNRA's existing Esri layers under the same portal.

## Notes
- GeoServer advertises CRS EPSG:4326 and EPSG:3857; reproject in-client as needed.
- WFS-T editing from ArcGIS requires `gis_editor` credentials configured in
  GeoServer security (Security ▸ Users/Groups/Roles ▸ Data access rules).
