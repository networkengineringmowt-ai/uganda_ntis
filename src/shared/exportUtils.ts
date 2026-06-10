/**
 * exportUtils — generic export helpers used across all platform sections.
 * CSV for tables, PNG for charts/maps via html-to-image, KML/GeoJSON for geodata.
 */
import { toPng } from 'html-to-image';

// ── Internal helper ───────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n'))
    return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── CSV ───────────────────────────────────────────────────────────────────────

export function exportTableToCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escapeCsvCell(r[h])).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const name = filename.endsWith('.csv') ? filename : `${filename}-${isoDate()}.csv`;
  triggerDownload(blob, name);
}

// ── PNG (charts, maps, any DOM container) ─────────────────────────────────────

export async function exportChartToPNG(
  containerRef: React.RefObject<HTMLElement | null>,
  filename: string,
) {
  const el = containerRef.current;
  if (!el) return;
  try {
    const dataUrl = await toPng(el, { cacheBust: true, backgroundColor: '#02050a' });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename.endsWith('.png') ? filename : `${filename}-${isoDate()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error('PNG export failed', e);
  }
}

export const exportMapToPNG = exportChartToPNG;

// ── GeoJSON ───────────────────────────────────────────────────────────────────

export function exportGeoJSON(
  geojson: object,
  filename: string,
) {
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
  const name = filename.endsWith('.geojson') ? filename : `${filename}-${isoDate()}.geojson`;
  triggerDownload(blob, name);
}

// ── KML ───────────────────────────────────────────────────────────────────────

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface GeoJsonFeature {
  type: string;
  geometry: { type: string; coordinates: number[] | number[][] | number[][][] };
  properties: Record<string, unknown>;
}

interface GeoJsonCollection {
  type: string;
  features: GeoJsonFeature[];
}

function featureToPlacemark(f: GeoJsonFeature): string {
  const props = f.properties;
  const name = escapeXml(String(props['name'] ?? props['link_name'] ?? props['id'] ?? 'Feature'));
  const desc = Object.entries(props)
    .map(([k, v]) => `<b>${escapeXml(k)}:</b> ${escapeXml(String(v ?? ''))}`)
    .join('<br/>');

  const geom = f.geometry;
  let coordTag = '';
  if (geom.type === 'Point') {
    const c = geom.coordinates as number[];
    coordTag = `<Point><coordinates>${c[0]},${c[1]},0</coordinates></Point>`;
  } else if (geom.type === 'LineString') {
    const pts = (geom.coordinates as number[][]).map(c => `${c[0]},${c[1]},0`).join(' ');
    coordTag = `<LineString><coordinates>${pts}</coordinates></LineString>`;
  } else if (geom.type === 'MultiLineString') {
    const inner = (geom.coordinates as number[][][])
      .map(line => {
        const pts = line.map(c => `${c[0]},${c[1]},0`).join(' ');
        return `<LineString><coordinates>${pts}</coordinates></LineString>`;
      })
      .join('\n    ');
    coordTag = `<MultiGeometry>${inner}</MultiGeometry>`;
  }

  return `  <Placemark>
    <name>${name}</name>
    <description><![CDATA[${desc}]]></description>
    ${coordTag}
  </Placemark>`;
}

export function geoJsonToKml(geojson: GeoJsonCollection, filename: string) {
  const placemarks = geojson.features.map(featureToPlacemark).join('\n');
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Uganda National Road Network</name>
  <description>Exported from Uganda Roads Management Platform — ${isoDate()}</description>
${placemarks}
</Document>
</kml>`;
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const name = filename.endsWith('.kml') ? filename : `${filename}-${isoDate()}.kml`;
  triggerDownload(blob, name);
}
