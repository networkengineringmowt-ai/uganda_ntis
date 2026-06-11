/**
 * useNetworkStats — single source of truth for all network KPIs.
 *
 * Loads gisnetwork18062025.geojson (1,013 links) and bridges2025.geojson once,
 * computes every statistic used across the platform, and caches the result.
 * All tabs MUST import this hook instead of hardcoding numbers.
 *
 * Data vintage: DNR GIS Section 18 Jun 2025
 */

/**
 * Official total network length — Department of National Roads FY 2025/26.
 * Source: NDPIV Investment Programme FY 2025–2026 (MoWT/DNR, June 2025).
 * This is the gazetted figure; it differs from GeoJSON-computed totalKm
 * because some links (mainly unclassified / recently gazetted roads) are
 * not yet in the GIS dataset.
 */
export const OFFICIAL_NETWORK_KM = 21302;
import { useState, useEffect } from 'react';

export interface NetworkStats {
  // Totals — GeoJSON mapped vs official Department of National Roads figure
  totalKm: number;       // from gisnetwork18062025.geojson (mapped)
  officialKm: number;    // = OFFICIAL_NETWORK_KM (21,302 km) — NDPIV FY25/26
  totalLinks: number;
  // Surface
  pavedKm: number;
  unpavedKm: number;
  pavedPct: number;
  // Road class
  classKm: Record<string, number>;
  classLinks: Record<string, number>;
  // Region
  regionKm: Record<string, number>;
  regionLinks: Record<string, number>;
  // Structures
  totalBridges: number;
  // Survey vintage
  dataVintage: string;
  loaded: boolean;
  error?: string;
}

// Condition stats from bot_results Q12 (surveyed subset only — not full network)
export interface SurveyedCondition {
  totalSurveyedLinks: number;
  goodLinks: number;
  fairLinks: number;
  poorLinks: number;
  criticalLinks: number;
  meanIri: number;
  meanPci: number;
}

// Module-level singleton cache
let _cache: NetworkStats | null = null;
let _promise: Promise<NetworkStats> | null = null;

async function _load(): Promise<NetworkStats> {
  if (_cache) return _cache;
  if (_promise) return _promise;

  _promise = (async () => {
    const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL;

    const [netRes, bridgeRes] = await Promise.all([
      fetch(`${base}data/gisnetwork18062025.geojson`).then(r => r.json()).catch(() => null),
      fetch(`${base}data/bridges2025.geojson`).then(r => r.json()).catch(() => null),
    ]);

    if (!netRes || !Array.isArray(netRes.features)) {
      throw new Error('Failed to load road network GeoJSON');
    }

    const features: Array<{ properties: Record<string, unknown> }> = netRes.features;

    let totalKm = 0;
    let pavedKm = 0;
    let unpavedKm = 0;
    const classKm: Record<string, number> = {};
    const classLinks: Record<string, number> = {};
    const regionKm: Record<string, number> = {};
    const regionLinks: Record<string, number> = {};

    for (const feat of features) {
      const p = feat.properties;
      const km = parseFloat(String(p.length_km1 ?? 0)) || 0;
      const cls = String(p.road_class ?? 'Unknown');
      const region = String(p.maintena_1 ?? 'Unknown');
      const surface = String(p.surface_ty ?? '');

      totalKm += km;
      if (surface === 'Bituminous') pavedKm += km;
      else unpavedKm += km;

      classKm[cls] = (classKm[cls] ?? 0) + km;
      classLinks[cls] = (classLinks[cls] ?? 0) + 1;
      regionKm[region] = (regionKm[region] ?? 0) + km;
      regionLinks[region] = (regionLinks[region] ?? 0) + 1;
    }

    const totalBridges = bridgeRes?.features?.length ?? 483;

    _cache = {
      totalKm:     Math.round(totalKm),
      officialKm:  OFFICIAL_NETWORK_KM,
      totalLinks:  features.length,
      pavedKm:     Math.round(pavedKm),
      unpavedKm:   Math.round(unpavedKm),
      pavedPct:    totalKm > 0 ? parseFloat(((pavedKm / totalKm) * 100).toFixed(1)) : 0,
      classKm:     Object.fromEntries(Object.entries(classKm).map(([k, v]) => [k, Math.round(v)])),
      classLinks,
      regionKm:    Object.fromEntries(Object.entries(regionKm).map(([k, v]) => [k, Math.round(v)])),
      regionLinks,
      totalBridges,
      dataVintage: 'DNR GIS / NDPIV FY25-26',
      loaded: true,
    };

    return _cache;
  })();

  return _promise;
}

export function useNetworkStats(): NetworkStats {
  const [stats, setStats] = useState<NetworkStats>(
    _cache ?? {
      totalKm: 21160, officialKm: OFFICIAL_NETWORK_KM, totalLinks: 1013,
      pavedKm: 6405, unpavedKm: 14897, pavedPct: 30.1,
      classKm: { A: 2615, B: 2863, C: 15537, M: 145 },
      classLinks: { A: 0, B: 0, C: 0, M: 0 },
      regionKm: { Central: 4760, Eastern: 2775, 'North Eastern': 2716, Northern: 4595, Southern: 3546, Western: 2768 },
      regionLinks: {},
      totalBridges: 483,
      dataVintage: 'DNR GIS / NDPIV FY25-26',
      loaded: !!_cache,
    }
  );

  useEffect(() => {
    if (_cache) return;
    _load()
      .then(s => setStats(s))
      .catch(e => setStats(prev => ({ ...prev, error: String(e), loaded: true })));
  }, []);

  return stats;
}

/** Sync accessor — returns defaults if not yet loaded. Safe to call outside React. */
export function getNetworkStats(): NetworkStats {
  return _cache ?? {
    totalKm: 21160, officialKm: OFFICIAL_NETWORK_KM, totalLinks: 1013,
    pavedKm: 6405, unpavedKm: 14897, pavedPct: 30.1,
    classKm: { A: 2615, B: 2863, C: 15537, M: 145 },
    classLinks: {},
    regionKm: { Central: 4760, Eastern: 2775, 'North Eastern': 2716, Northern: 4595, Southern: 3546, Western: 2768 },
    regionLinks: {},
    totalBridges: 483,
    dataVintage: 'DNR GIS Jun 2025',
    loaded: false,
  };
}

// Preload on module import so data is ready by the time components mount
_load().catch(() => null);
