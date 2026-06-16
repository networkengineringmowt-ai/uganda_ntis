# Web map clients (Leaflet / OpenLayers / MapLibre)

The platform's React apps (NRMS/NBMS/NTIS) use Leaflet today against bundled
GeoJSON. To switch a layer to **live services** from the enterprise stack, use
one of the patterns below — all through the web adaptor origin.

## MapLibre GL — MVT vector tiles (fastest, styled client-side)
```js
map.addSource('roads', {
  type: 'vector',
  tiles: ['https://gis.unra.go.ug/tiles/core.network_links/{z}/{x}/{y}.pbf'],
  minzoom: 5, maxzoom: 16,
});
map.addLayer({
  id: 'roads', type: 'line', source: 'roads', 'source-layer': 'core.network_links',
  paint: { 'line-color': ['match', ['get','road_class'],
            'A','#00f5ff','B','#00ff88','M','#b967ff', '#ffd23f'], 'line-width': 1.6 },
});
```

## Leaflet — WMS image layer (server-side styled, zero client styling)
```js
L.tileLayer.wms('https://gis.unra.go.ug/geoserver/ows', {
  layers: 'core:network_links', styles: 'network_class',
  format: 'image/png', transparent: true, version: '1.3.0',
}).addTo(map);
```

## Leaflet — MVT via VectorGrid
```js
L.vectorGrid.protobuf('https://gis.unra.go.ug/tiles/core.network_links/{z}/{x}/{y}.pbf', {
  vectorTileLayerStyles: { 'core.network_links': { color:'#00f5ff', weight:1.5 } },
}).addTo(map);
```

## Any client — GeoJSON (OGC API – Features)
```js
const r = await fetch('https://gis.unra.go.ug/features/collections/core.bridges/items?limit=1000&f=json');
const geojson = await r.json();              // standard FeatureCollection
L.geoJSON(geojson).addTo(map);
```

## OpenLayers — WMTS cached tiles
Point an `ol/source/WMTS` at
`https://gis.unra.go.ug/geoserver/gwc/service/wmts` (parse GetCapabilities with
`ol/format/WMTSCapabilities`).
