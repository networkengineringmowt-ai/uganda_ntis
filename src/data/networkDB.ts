/**
 * networkDB — Central single source of truth for the Uganda National Roads Platform.
 *
 * All data is sourced from:
 *   • National Road Network_FY25-26(NDPIV) - draft.xlsx  (1,017 links)
 *   • Bridges and Culverts 2026.xlsx                     (515 bridges, 452 culverts)
 *   • TIS 2023–2025 AADT analysis.xlsx                   (298 stations, 10 vehicle classes)
 *
 * Built by scripts/build_db.py → public/data/central_network_db.json
 * Network-level stats → public/data/network_stats.json
 *
 * Every platform tab consumes data from this module.
 * Inconsistencies mean the source Excel was inconsistent — not the platform.
 */
import { useState, useEffect } from 'react';

// ── Core types ────────────────────────────────────────────────────────────────

export interface BridgeRecord {
  bridge_no:  string | null;
  new_no:     string | null;
  name:       string | null;
  km:         number | null;
  crossing:   number | null;
  road_desc:  string | null;
  river:      string | null;
  n_spans:    number | null;
  span_len:   number | null;
  type:       number | null;
  coord_e:    number | null;
  coord_s:    number | null;
}

export interface CulvertRecord {
  culvert_no: string | null;
  new_no:     string | null;
  road:       string | null;
  km:         number | null;
  river:      string | null;
}

/** Vehicle-class keyed 1-10 (see VEHICLE_CLASS_LABELS for labels) */
export interface TrafficYear {
  aadt:         number | null;  // estimated 24h AADT from 12h daytime count
  day_wd_total: number;         // sum of all classes, daytime weekday
  day_we_total: number;         // sum of all classes, daytime weekend
  vc_day:       Record<string, number>;   // keys '1'–'10'
  vc_night:     Record<string, number>;
}

export interface RoadLink {
  // ── From master network (FY25-26 NDPIV Excel) ────────────────────────
  link_id:             string;
  road_no:             string;
  road_class:          'A' | 'B' | 'C' | 'M' | string;
  link_name:           string | null;
  chainage_from:       number | null;
  chainage_to:         number | null;
  length_km:           number;
  surface_type:        'Bituminous' | 'Unsealed' | string | null;
  maintenance_station: string | null;
  maintenance_region:  string | null;
  completion_year:     number | null;
  rehab_year:          number | null;
  last_intervention:   number | null;
  comments:            string | null;
  ndpiv_1:             string | null;   // NDPIV component 1
  ndpiv_2:             string | null;   // NDPIV component 2
  funder:              string | null;
  oprc:                string | null;
  ndpiv_oprc:          string | null;
  // ── Joined from bridges/culverts Excel ───────────────────────────────
  bridges:  BridgeRecord[];
  culverts: CulvertRecord[];
  // ── Joined from TIS traffic counts ───────────────────────────────────
  traffic:          Record<string, TrafficYear>;  // keyed by year '2023'|'2024'|'2025'
  aadt_latest:      number | null;
  aadt_latest_year: number | null;
  vc_latest:        Record<string, number>;
  // ── Computed ──────────────────────────────────────────────────────────
  pavement_age_yr:  number | null;
}

export interface NetworkStats {
  total_links:             number;
  total_km:                number;
  official_km:             number;  // 21,302 (DNR official 2026)
  paved_km:                number;
  unpaved_km:              number;
  paved_pct:               number;
  bridges_total:           number;
  culverts_total:          number;
  traffic_surveyed_links:  number;
  tcs_stations:            number;
  by_class:   Record<string, { links: number; km: number; paved_km: number }>;
  by_region:  Record<string, { links: number; km: number; paved_km: number; stations: Record<string, number> }>;
  by_station: Record<string, { links: number; km: number; region: string }>;
  vehicle_classes: Record<string, string>;  // '1'->'NMT', '2'->'Motorcycle', ...
}

export interface TCSStation {
  tcs_no:    string | null;
  tcs_name:  string | null;
  road_no:   string | null;
  link_id:   string | null;
  link_name: string | null;
  lat:       number | null;
  lon:       number | null;
  station:   string | null;
  region:    string | null;
  surface:   string | null;
}

/** Vehicle class labels keyed '1'–'10' (from TIS Key sheet) */
export const VEHICLE_CLASS_LABELS: Record<string, string> = {
  '1':  'NMT (Bicycles & Carts)',
  '2':  'Motorcycle',
  '3':  'Saloon Cars & Taxis',
  '4':  'Light Goods / 4WD',
  '5':  'Small Bus (Matatu)',
  '6':  'Medium Bus (Coaster)',
  '7':  'Bus',
  '8':  'Light Truck (Dyna)',
  '9':  'Medium / Heavy Truck',
  '10': 'Truck Trailer / Artic',
};

/** Short labels for table headers */
export const VC_SHORT: Record<string, string> = {
  '1':'NMT','2':'Moto','3':'Cars','4':'LGV','5':'S.Bus',
  '6':'Coaster','7':'Bus','8':'L.Trk','9':'H.Trk','10':'Artic',
};

// ── Singleton loaders ─────────────────────────────────────────────────────────
let _db: RoadLink[] | null = null;
let _stats: NetworkStats | null = null;
let _stations: TCSStation[] | null = null;
let _dbP:  Promise<RoadLink[]>   | null = null;
let _stP:  Promise<NetworkStats> | null = null;
let _tcP:  Promise<TCSStation[]> | null = null;

const BASE = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL;

export async function loadNetworkDB(): Promise<RoadLink[]> {
  if (_db) return _db;
  if (!_dbP) _dbP = fetch(`${BASE}data/central_network_db.json`).then(r => r.json()).then(d => { _db = d; return d; });
  return _dbP;
}
export async function loadNetworkStats(): Promise<NetworkStats> {
  if (_stats) return _stats;
  if (!_stP) _stP = fetch(`${BASE}data/network_stats.json`).then(r => r.json()).then(d => { _stats = d; return d; });
  return _stP;
}
export async function loadTCSStations(): Promise<TCSStation[]> {
  if (_stations) return _stations;
  if (!_tcP) {
    // Drive-first: bundled JSON (exported from G: Drive) is canonical;
    // Supabase is only a fallback mirror if the bundle is unavailable.
    _tcP = fetch(`${BASE}data/tcs_stations.json`)
      .then(r => { if (!r.ok) throw new Error('no bundled stations'); return r.json(); })
      .then(d => { _stations = d; return d; })
      .catch(() =>
        import('../lib/roadsAPI')
          .then(({ RoadsAPI }) => RoadsAPI.getStations())
          .then(rows => {
            const mapped: TCSStation[] = rows.map(r => ({
              tcs_no: r.tcs_no != null ? String(r.tcs_no) : null,
              tcs_name: r.station_name,
              road_no: r.link_id ? r.link_id.split('_')[0] : null,
              link_id: r.link_id, link_name: r.link_name,
              lat: r.latitude, lon: r.longitude,
              station: r.station_type, region: r.region, surface: null,
            }));
            _stations = mapped;
            return mapped;
          }),
      );
  }
  return _tcP;
}


// Preload on module import
loadNetworkStats().catch(() => null);

// ── React hooks ───────────────────────────────────────────────────────────────

export function useNetworkDB() {
  const [db,      setDb]      = useState<RoadLink[]   | null>(_db);
  const [stats,   setStats]   = useState<NetworkStats | null>(_stats);
  const [loading, setLoading] = useState(!_db || !_stats);

  useEffect(() => {
    if (_db && _stats) { setLoading(false); return; }
    Promise.all([loadNetworkDB(), loadNetworkStats()])
      .then(([d, s]) => { setDb(d); setStats(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { db, stats, loading };
}

export function useNetworkStats2() {
  const [stats,   setStats]   = useState<NetworkStats | null>(_stats);
  const [loading, setLoading] = useState(!_stats);
  useEffect(() => {
    if (_stats) { setLoading(false); return; }
    loadNetworkStats().then(s => { setStats(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  return { stats, loading };
}

export function useTCSStations() {
  const [stations, setStations] = useState<TCSStation[]>(_stations ?? []);
  const [loading,  setLoading]  = useState(!_stations);
  useEffect(() => {
    if (_stations) { setLoading(false); return; }
    loadTCSStations().then(d => { setStations(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  return { stations, loading };
}

// ── Utility selectors ─────────────────────────────────────────────────────────

export const byLinkId = (db: RoadLink[]): Map<string, RoadLink> =>
  new Map(db.map(l => [l.link_id, l]));

export const linksByRegion = (db: RoadLink[], region: string) =>
  db.filter(l => l.maintenance_region === region);

export const linksByClass = (db: RoadLink[], cls: string) =>
  db.filter(l => l.road_class === cls);

export const linksByStation = (db: RoadLink[], station: string) =>
  db.filter(l => l.maintenance_station === station);

export const linksWithTraffic = (db: RoadLink[]) =>
  db.filter(l => l.aadt_latest != null);

export const linksWithBridges = (db: RoadLink[]) =>
  db.filter(l => l.bridges.length > 0);

/** AADT for a link at a given year, or latest available */
export function getAADT(link: RoadLink, year?: number): number | null {
  if (year) return link.traffic[String(year)]?.aadt ?? null;
  return link.aadt_latest;
}

/** Vehicle class breakdown (vc_day) for latest year as typed object */
export function getVehicleClasses(link: RoadLink) {
  const vc = link.vc_latest;
  return {
    nmt:        vc['1']  ?? 0,
    motorcycle: vc['2']  ?? 0,
    saloon:     vc['3']  ?? 0,
    lgv:        vc['4']  ?? 0,
    minibus:    vc['5']  ?? 0,
    coaster:    vc['6']  ?? 0,
    bus:        vc['7']  ?? 0,
    light_truck:vc['8']  ?? 0,
    heavy_truck:vc['9']  ?? 0,
    artic:      vc['10'] ?? 0,
    total:      Object.values(vc).reduce((s, v) => s + (v as number), 0),
  };
}

/** Condition band from pavement age (approximation when IRI not available) */
export function ageToBand(age: number | null, surface: string | null): 'good'|'fair'|'poor'|'very_poor'|'not_surveyed' {
  if (age == null) return 'not_surveyed';
  if (surface !== 'Bituminous') return age > 3 ? 'poor' : 'fair';
  if (age <= 5)  return 'good';
  if (age <= 12) return 'fair';
  if (age <= 20) return 'poor';
  return 'very_poor';
}

/** Summary totals from a subset of links */
export function subsetTotals(links: RoadLink[]) {
  let km = 0, paved = 0, bridges = 0, culverts = 0, aadt_sum = 0, aadt_n = 0;
  for (const l of links) {
    km      += l.length_km || 0;
    if (l.surface_type === 'Bituminous') paved += l.length_km || 0;
    bridges  += l.bridges.length;
    culverts += l.culverts.length;
    if (l.aadt_latest) { aadt_sum += l.aadt_latest; aadt_n++; }
  }
  return {
    links: links.length,
    km: Math.round(km * 10) / 10,
    paved_km: Math.round(paved * 10) / 10,
    bridges,
    culverts,
    avg_aadt: aadt_n ? Math.round(aadt_sum / aadt_n) : null,
  };
}
