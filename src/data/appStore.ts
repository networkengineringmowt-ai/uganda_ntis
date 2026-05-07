/**
 * Unified data store — single source of truth for all shared platform data.
 * All modules should import analytics, projects, and constants from here.
 *
 * Data hierarchy:
 *   analytics.json  → loadPlatformAnalytics()  (network, traffic, condition, bridges)
 *   projects.json   → loadEnhancedProjects()   (projects with lat/lng + photos)
 *   bridges.geojson → loadAllStructures()       (re-exported from generateData)
 */

export {
  loadPlatformAnalytics,
  loadProjects,
  type PlatformAnalytics,
  type RegionTraffic,
} from './platformData';

export { loadAllStructures } from './generateData';

import { loadProjects as _loadProjects } from './platformData';
import type { OngoingProject } from '../types';

// ─── Project type (extends OngoingProject with map + photo fields) ─────────────

export interface Project extends OngoingProject {
  id:             string;
  lat:            number;
  lng:            number;
  status:         'planned' | 'ongoing' | 'complete';
  progressPhotos: string[];  // internal /s-photos/ paths or Drive thumbnail URLs
  description:    string;
}

// ─── Geocoder ─────────────────────────────────────────────────────────────────
// Approximate midpoint coordinates for known Ugandan cities / corridors.
const CITY_COORDS: Record<string, [number, number]> = {
  kampala:    [0.3476,  32.5825],
  jinja:      [0.4247,  33.2041],
  gulu:       [2.7746,  32.2990],
  mbarara:   [-0.6077,  30.6523],
  mbale:      [1.0624,  34.1750],
  arua:       [3.0217,  30.9116],
  soroti:     [1.7174,  33.6110],
  'fort portal': [0.6716, 30.2757],
  kabale:    [-1.2487,  29.9917],
  entebbe:    [0.0564,  32.4638],
  masaka:    [-0.3357,  31.7372],
  moroto:     [2.5350,  34.6650],
  lira:       [2.2499,  32.9000],
  kasese:     [0.1833,  30.0833],
  tororo:     [0.6930,  34.1807],
  nimule:     [3.5965,  32.0619],
  pakwach:    [2.4627,  31.4957],
  atiak:      [3.1884,  32.2100],
  katuna:    [-1.0003,  29.6883],
  hoima:      [1.4297,  31.3526],
  butiaba:    [1.8323,  31.3220],
  wanseko:    [1.9500,  31.1900],
  nebbi:      [2.4775,  31.0882],
  eruba:      [2.7000,  31.1000],
  vurra:      [3.0000,  30.5000],
  bugiri:     [0.5653,  33.7444],
  busia:      [0.4611,  34.0887],
  iganga:     [0.6092,  33.4690],
  kira:       [0.3833,  32.7000],
  mbalala:    [0.4500,  32.8000],
  njeru:      [0.4400,  33.1800],
  mukono:     [0.3540,  32.7553],
  luwero:     [0.8481,  32.4819],
  matugga:    [0.5000,  32.5500],
  semuto:     [0.7000,  32.4000],
  karuma:     [2.2500,  32.2320],
  olwiyo:     [2.7080,  31.9000],
  // Region fallbacks
  northern:   [2.5,    32.5],
  eastern:    [1.5,    33.8],
  western:    [0.5,    30.5],
  central:    [0.5,    32.2],
  southern:  [-0.8,    30.5],
  'north eastern': [2.0, 34.2],
};

function geocodeProject(location: string, regions: string): [number, number] {
  const loc = (location + ' ' + regions).toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (loc.includes(city)) return coords;
  }
  // Default: geographic centre of Uganda
  return [1.37, 32.3];
}

// ─── Placeholder photo paths (served from internal network /s-photos/) ────────
// These are used as starter progressPhotos entries; they show a camera
// placeholder when the internal photo server is not reachable.
const PHOTO_POOL = [
  '/s-photos/B001/B001_18_01.JPG',
  '/s-photos/B026/B026_18_01.JPG',
  '/s-photos/B050/B050_18_01.JPG',
  '/s-photos/B094/B094_18_01.JPG',
  '/s-photos/B100/B100_18_01.JPG',
  '/s-photos/B158/B158_18_01.JPG',
];

function starterPhotos(idx: number): string[] {
  // Assign 2–3 photos per project, cycling through pool
  const start = (idx * 2) % PHOTO_POOL.length;
  return [
    PHOTO_POOL[start % PHOTO_POOL.length],
    PHOTO_POOL[(start + 1) % PHOTO_POOL.length],
    PHOTO_POOL[(start + 3) % PHOTO_POOL.length],
  ];
}

function deriveStatus(p: OngoingProject): 'planned' | 'ongoing' | 'complete' {
  if (p.actual_progress_pct !== null && p.actual_progress_pct >= 99) return 'complete';
  if (p.actual_progress_pct !== null && p.actual_progress_pct > 0) return 'ongoing';
  return 'planned';
}

// ─── Cache ─────────────────────────────────────────────────────────────────────
let enhancedCache: Project[] | null = null;

export async function loadEnhancedProjects(): Promise<Project[]> {
  if (enhancedCache) return enhancedCache;

  const raw = await _loadProjects();
  enhancedCache = raw.map((p, i): Project => {
    const [lat, lng] = geocodeProject(p.location, p.regions);
    return {
      ...p,
      id:             `PROJ-${String(i + 1).padStart(3, '0')}`,
      lat,
      lng,
      status:         deriveStatus(p),
      progressPhotos: starterPhotos(i),
      description:    `${p.project_name} — ${p.location}. Funded by ${p.funding_agency}. ` +
                      `Target completion: ${p.target_completion_date || 'TBD'}.`,
    };
  });

  return enhancedCache;
}

// ─── Canonical fallback constants ─────────────────────────────────────────────
// Used in loading states before analytics.json resolves.
// Single definition — import from here, never re-define in component files.
export const NETWORK_KM        = 21_291.541;
export const PAVED_KM          = 6_312.098;
export const PERCENT_PAVED     = 29.6;
export const TOTAL_LINKS       = 1_014;
export const PAVED_GOOD_PCT    = 94.2;
export const UNPAVED_GOOD_PCT  = 62.0;
