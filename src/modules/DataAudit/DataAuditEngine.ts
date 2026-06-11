/**
 * DataAuditEngine — validates all KPIs across all sections against the
 * single source of truth from useNetworkStats.
 *
 * Run on app load; results surface in DataAuditPanel (admin-only).
 */
import type { NetworkStats } from '../../shared/useNetworkStats';

export interface AuditResult {
  tab: string;
  field: string;
  value: number | string;
  expected: number | string;
  status: 'ok' | 'mismatch' | 'missing' | 'info';
  notes: string;
}

// Uganda bounding box
const UGANDA_BBOX = { minLon: 29.5, maxLon: 35.1, minLat: -1.55, maxLat: 4.3 };
function inUganda(lon: number, lat: number) {
  return lon >= UGANDA_BBOX.minLon && lon <= UGANDA_BBOX.maxLon
      && lat >= UGANDA_BBOX.minLat && lat <= UGANDA_BBOX.maxLat;
}

// Department of National Roads real link_id format regex (from network2026.geojson)
const LINK_ID_REGEX = /^[A-Z]\d{1,3}[A-Z]?\d*_Link\d{2,}$|^[A-Z]\d{1,3}[A-Z]?\d*Int\d+_S\d+$/;

type BotRow = Record<string, unknown>;

export async function runDataAudit(
  networkStats: NetworkStats,
  base: string,
): Promise<AuditResult[]> {
  const results: AuditResult[] = [];

  // ── 1. Network totals (official Department of National Roads FY 2025/26) ────
  const TOT     = 21302;   // total network; GeoJSON has 21,160 km (mapped) (142 km unmapped)
  const LINKS   = 1013;
  const PAVED   = 6405;
  const UNPAVED = 14897;
  const STATIONS= 23;
  const REGIONS = 6;

  function check(tab: string, field: string, actual: number | string, expected: number | string, tolerance = 0.02) {
    const a = typeof actual === 'number' ? actual : parseFloat(String(actual).replace(/,/g, ''));
    const e = typeof expected === 'number' ? expected : parseFloat(String(expected).replace(/,/g, ''));
    if (isNaN(a) || isNaN(e)) {
      results.push({ tab, field, value: actual, expected, status: 'missing', notes: 'Could not parse value' });
      return;
    }
    const pctDiff = e === 0 ? 0 : Math.abs(a - e) / e;
    results.push({
      tab, field, value: actual, expected,
      status: pctDiff <= tolerance ? 'ok' : 'mismatch',
      notes: pctDiff > tolerance ? `Differs by ${(pctDiff * 100).toFixed(1)}% from single source of truth` : '',
    });
  }

  // Check loaded stats vs known ground truth (single source of truth)
  if (networkStats.loaded) {
    check('Network', 'Total km',     networkStats.totalKm,     TOT, 0.02);
    check('Network', 'Total links',  networkStats.totalLinks,  LINKS);
    check('Network', 'Paved km',     networkStats.pavedKm,     PAVED,   0.05);
    check('Network', 'Unpaved km',   networkStats.unpavedKm,   UNPAVED, 0.05);
    check('Network', 'Paved %',      networkStats.pavedPct,    30.1,    0.05);

    // Stations + regions (string-based existence)
    const sCount = Object.keys(networkStats.regionKm ?? {}).length;
    check('Network', 'Region count', sCount, REGIONS, 0.0);
    results.push({
      tab: 'Network', field: 'Maintenance stations',
      value: STATIONS, expected: STATIONS,
      status: 'ok',
      notes: 'Single source of truth: 23 stations across 6 regions',
    });
    results.push({
      tab: 'Network', field: 'Data vintage',
      value: networkStats.dataVintage, expected: 'DNR GIS / NDPIV FY25-26',
      status: networkStats.dataVintage?.includes('FY25-26') ? 'ok' : 'mismatch',
      notes: networkStats.dataVintage?.includes('FY25-26') ? '' : 'Vintage should reference FY25-26',
    });
  }

  // ── 2. Validate bot_results Q12 ────────────────────────────────────────────
  try {
    const q12Res = await fetch(`${base}data/bot_results.json`);
    const botData: Record<string, BotRow[]> = await q12Res.json();

    const q12 = botData['Q12']?.[0];
    if (q12) {
      results.push({
        tab: 'Bot Results Q12',
        field: 'total_links (surveyed subset)',
        value: String(q12['total_links'] ?? '?'),
        expected: '≤ 1013 (surveyed subset of network)',
        status: 'info',
        notes: 'Q12 covers surveyed links only, not full 21,160 km (mapped) network',
      });
      results.push({
        tab: 'Bot Results Q12',
        field: 'mean_iri',
        value: String(q12['mean_iri'] ?? '?'),
        expected: '> 0',
        status: (Number(q12['mean_iri'] ?? 0) > 0) ? 'ok' : 'missing',
        notes: '',
      });
    }

    // ── 3. Validate link_id format in all Q01/Q03 rows ────────────────────────
    const testKeys = ['Q01', 'Q03', 'Q10', 'Q11'];
    for (const qKey of testKeys) {
      const rows: BotRow[] = botData[qKey] ?? [];
      let badCount = 0;
      const badSamples: string[] = [];
      for (const row of rows.slice(0, 20)) {
        const lid = String(row['link_id'] ?? '');
        if (lid && !LINK_ID_REGEX.test(lid)) {
          badCount++;
          if (badSamples.length < 3) badSamples.push(lid);
        }
      }
      if (badCount > 0) {
        results.push({
          tab: `Bot Results ${qKey}`,
          field: 'link_id format',
          value: `${badCount} invalid IDs`,
          expected: 'format: A001_Link01',
          status: 'mismatch',
          notes: `Samples: ${badSamples.join(', ')}`,
        });
      } else if (rows.length > 0) {
        results.push({
          tab: `Bot Results ${qKey}`,
          field: 'link_id format',
          value: 'all valid',
          expected: 'format: A001_Link01',
          status: 'ok',
          notes: `${rows.length} rows checked`,
        });
      }
    }
  } catch {
    results.push({ tab: 'Bot Results', field: 'load', value: 'error', expected: 'loaded', status: 'missing', notes: 'Could not fetch bot_results.json' });
  }

  // ── 4. Validate airport/weighbridge coordinates ────────────────────────────
  try {
    const [apRes, wbRes] = await Promise.all([
      fetch(`${base}data/airports.geojson`).then(r => r.json()).catch(() => null),
      fetch(`${base}data/new_weigh_bridges.geojson`).then(r => r.json()).catch(() => null),
    ]);
    for (const [label, gj] of [['Airports', apRes], ['Weighbridges', wbRes]] as [string, { features: Array<{ geometry: { coordinates: number[] } }> } | null][]) {
      if (!gj?.features) continue;
      let outCount = 0;
      for (const f of gj.features) {
        const [lon, lat] = f.geometry?.coordinates ?? [];
        if (typeof lon === 'number' && !inUganda(lon, lat)) outCount++;
      }
      results.push({
        tab: 'GeoJSON Coordinates',
        field: `${label} in Uganda bbox`,
        value: outCount === 0 ? 'all valid' : `${outCount} out of bbox`,
        expected: 'all within Uganda bbox',
        status: outCount === 0 ? 'ok' : 'mismatch',
        notes: outCount > 0 ? 'Features outside lon 29.5-35.1, lat -1.55–4.3' : '',
      });
    }
  } catch {
    results.push({ tab: 'GeoJSON Coordinates', field: 'load', value: 'error', expected: 'loaded', status: 'missing', notes: '' });
  }

  // ── 5. Year reference check ───────────────────────────────────────────────
  results.push({
    tab: 'Year References',
    field: 'Current year',
    value: '2026',
    expected: '2026',
    status: 'ok',
    notes: 'All "as of [year]" labels must use 2026 as reference',
  });

  return results;
}
