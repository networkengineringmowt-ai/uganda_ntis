/**
 * Download helpers — CSV, GeoJSON, KML, and pre-built shapefile ZIPs.
 * All geospatial exports are built client-side from app state, matching
 * the server-generated files in /public/downloads/.
 */
import type { Structure } from '../types';

// ── Trigger a browser download ────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── CSV ───────────────────────────────────────────────────────────────────────

const CSV_FIELDS: (keyof Structure)[] = [
  'id', 'name', 'type', 'road', 'roadNumber', 'region', 'chainage',
  'lat', 'lng', 'spanLength', 'noOfSpans', 'noOfLanes', 'noOfPiers',
  'width', 'material', 'crossingType', 'surfaceType', 'yearBuilt',
  'maintenanceArea', 'river', 'conditionRating', 'lastInspection',
  'nextInspection', 'inspectionDue', 'traffic', 'priorityRank',
  'estimatedReplacementCost',
];

function escapeCSV(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n'))
    return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function downloadCSV(structures: Structure[], filename = 'structures.csv') {
  const header = CSV_FIELDS.join(',');
  const rows   = structures.map(s =>
    CSV_FIELDS.map(k => escapeCSV(s[k])).join(','),
  );
  const csv = [header, ...rows].join('\n');
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}

// ── GeoJSON (client-built from filtered structures) ───────────────────────────

export function downloadGeoJSON(structures: Structure[], filename = 'structures.geojson') {
  const geojson = {
    type: 'FeatureCollection',
    features: structures.map(s => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id, name: s.name, type: s.type,
        road: s.road, road_number: s.roadNumber, region: s.region,
        chainage_km: s.chainage, span_m: s.spanLength, n_spans: s.noOfSpans,
        n_lanes: s.noOfLanes, width_m: s.width, material: s.material,
        crossing: s.crossingType, surface: s.surfaceType,
        year_built: s.yearBuilt, condition: s.conditionRating,
        last_inspection: s.lastInspection, priority_rank: s.priorityRank,
        traffic: s.traffic, maint_area: s.maintenanceArea, river: s.river,
      },
    })),
  };
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
  triggerDownload(blob, filename);
}

// ── KML (client-built) ────────────────────────────────────────────────────────

const COND_COLORS: Record<number, string> = {
  1: 'ff2222ff', 2: 'ff4488ff', 3: 'ff00aaff', 4: 'ff00ff88', 5: 'ff00cc44',
};

export function downloadKML(structures: Structure[], filename = 'structures.kml') {
  const placemarks = structures.map(s => {
    const col = COND_COLORS[s.conditionRating] ?? 'ffffffff';
    return `  <Placemark>
    <name>${escapeXML(s.name)}</name>
    <description><![CDATA[
      <b>Type:</b> ${s.type}<br/>
      <b>Road:</b> ${escapeXML(s.road)}<br/>
      <b>Chainage:</b> ${s.chainage} km<br/>
      <b>Region:</b> ${s.region}<br/>
      <b>Year Built:</b> ${s.yearBuilt}<br/>
      <b>Condition:</b> ${s.conditionRating}/5<br/>
      <b>Material:</b> ${s.material}
    ]]></description>
    <Style><IconStyle><color>${col}</color>
      <Icon><href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
    </IconStyle></Style>
    <Point><coordinates>${s.lng},${s.lat},0</coordinates></Point>
  </Placemark>`;
  }).join('\n');

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Uganda National Road Structures</name>
  <description>UNRA Bridge and Major Culvert Inventory — ${structures.length} structures</description>
${placemarks}
</Document>
</kml>`;
  triggerDownload(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }), filename);
}

function escapeXML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Pre-built server-side shapefile ZIPs (link to /public/downloads/) ─────────

export function downloadShapefileZip(which: 'all' | 'bridges' | 'culverts' = 'all') {
  const map: Record<string, string> = {
    all:      '/downloads/structures_all.zip',
    bridges:  '/downloads/structures_bridges.zip',
    culverts: '/downloads/structures_culverts.zip',
  };
  const url = map[which];
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `structures_${which}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadStaticFile(url: string, filename: string) {
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
