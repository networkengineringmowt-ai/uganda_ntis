/**
 * Uganda Department of National Roads Road Network — Link ID & Location Referencing Knowledge Base
 *
 * Sources:
 *  - DNR GIS Section: National Road Network Shapefile gisnetwork18062025.geojson
 *  - Department of National Roads Road Management System (RMS) User Manual 2017
 *  - Department of National Roads Road Infrastructure Asset Management Policy 2017 v1.4
 *  - MoWT Road Classification and Numbering System
 *
 * DATA VERIFIED: Link IDs confirmed from live GeoJSON (1,013 features, 18 Jun 2025)
 */

// ── Functional Classification (from real GeoJSON data) ────────────────────────
export const ROAD_CLASSIFICATION = {
  A: {
    code: 'A',
    name: 'Class A — National Trunk Roads',
    description: 'International and inter-regional trunk roads connecting Uganda to neighbouring countries and major regional centres',
    minCarriagewayWidth: 7.0,
    designSpeed: 100,
    lanes: 2,
    standard: 'Paved (bituminous) — all weather',
    totalKm: 2615,
    examples: ['A001 Kampala–Gulu–Nimule', 'A002 Kampala–Jinja–Malaba', 'A004 Kampala–Masaka–Mutukula'],
  },
  B: {
    code: 'B',
    name: 'Class B — National Secondary Roads',
    description: 'Secondary national roads linking regional towns and districts to Class A roads',
    minCarriagewayWidth: 6.5,
    designSpeed: 80,
    lanes: 2,
    standard: 'Paved or gravel — all weather',
    totalKm: 2863,
    examples: ['B100 Kampala–Hoima', 'B101 Kampala–Masaka bypass', 'B150 Jinja–Iganga'],
  },
  C: {
    code: 'C',
    name: 'Class C — Regional Roads',
    description: 'Regional roads connecting district headquarters to national roads',
    minCarriagewayWidth: 6.0,
    designSpeed: 60,
    lanes: 2,
    standard: 'Gravel — all weather',
    totalKm: 15537,
    examples: ['C003 Fort Portal–Bundibugyo', 'C150 Mbale–Moroto', 'C261 Matte–Sekanyonyi'],
  },
  M: {
    code: 'M',
    name: 'Municipality / Urban Roads',
    description: 'Classified roads within municipal and urban boundaries managed by Department of National Roads',
    minCarriagewayWidth: 6.0,
    designSpeed: 50,
    lanes: 2,
    standard: 'Paved or gravel',
    totalKm: 145,
    examples: ['M3 Northern Bypass Kampala', 'M20 Entebbe Expressway'],
  },
} as const;

// ── Link ID Format & Structure (VERIFIED from gisnetwork18062025.geojson) ──────
export const LINK_ID_STRUCTURE = {
  description: `
    Department of National Roads uses a Linear Reference System (LRS) based on chainage (distance from a defined datum).
    Each road is divided into management units called LINKS, defined by:
      - Start node (intersection, town, boundary)
      - End node (intersection, town, boundary)
      - Road number (e.g. A001, B100, C261)

    Link IDs in the DNR GIS are formatted as: [ROAD_NUMBER]_Link[SEQUENTIAL_INDEX]
    e.g. "A001_Link01" = first link on the A001 Kampala-Gulu highway
         "B101_Link02" = second link on road B101
         "C261_Link01" = first link on road C261

    Road numbers use 3-digit zero-padded format: A001, A002, B100, B101, C003, M3, M20
    Some municipality roads use alphanumeric codes: M3N2_Link01, M20Int4_S9

    Chainage (km) is measured from the start of the road (0+000) to each reference point.
    Links have chainage_f (from) and chainage_t (to) fields defining their extent along the road.
  `,
  format: /^[A-Z]\d{1,3}[A-Z]?\d*_Link\d{2,}$|^[A-Z]\d{1,3}[A-Z]?\d*Int\d+_S\d+$/,
  components: {
    roadNumber: 'Class letter (A/B/C/M) + 3-digit road number e.g. A001, B101, C261',
    separator: 'Underscore + "Link" keyword',
    linkIndex: '2-digit sequential number within the road (01, 02, 03, ...)',
  },
  chainageSystem: {
    unit: 'kilometres',
    notation: 'Decimal km stored in chainage_f/chainage_t fields, e.g. 32.23 km from datum',
    datum: 'Defined at each road origin (typically at major town or border)',
  },
  totalLinks: 1013,
  totalLength: 21160,
};

// ── Maintenance Regions ────────────────────────────────────────────────────────
export const MAINTENANCE_REGIONS = [
  { id: 'Central',       label: 'Central Region',       headquarters: 'Kampala',     roadKm: 4760 },
  { id: 'Northern',      label: 'Northern Region',      headquarters: 'Gulu',        roadKm: 4595 },
  { id: 'Eastern',       label: 'Eastern Region',       headquarters: 'Mbale',       roadKm: 2775 },
  { id: 'Western',       label: 'Western Region',       headquarters: 'Fort Portal', roadKm: 2768 },
  { id: 'Southern',      label: 'Southern Region',      headquarters: 'Mbarara',     roadKm: 3546 },
  { id: 'North Eastern', label: 'North Eastern Region', headquarters: 'Moroto',      roadKm: 2716 },
] as const;

// ── SQL Join Logic for Full Link History ───────────────────────────────────────
export const LINK_HISTORY_JOINS = {
  description: 'Query to retrieve all data for a single link_id across all platform tables',
  primaryTable: 'pavement_condition',
  joinOrder: [
    { table: 'romdas_sections',       on: 'romdas_sections.link_id = pavement_condition.link_id',      type: 'LEFT JOIN' },
    { table: 'romdas_ml_predictions', on: 'romdas_ml_predictions.link_id = romdas_sections.link_id',   type: 'LEFT JOIN' },
    { table: 'bridges',               on: 'bridges.road_link_id = pavement_condition.link_id',         type: 'LEFT JOIN' },
    { table: 'culverts',              on: 'culverts.road_link_id = pavement_condition.link_id',         type: 'LEFT JOIN' },
  ],
  fullLinkHistorySQL: (linkId: string) => `
    SELECT
      pc.link_id,
      pc.road_name,
      pc.road_class,
      pc.length_km,
      pc.region,
      pc.surface_type,
      pc.condition_class,
      pc.iri_value,
      pc.survey_year,
      rs.rutting_mm,
      rs.cracking_pct,
      rs.pothole_count,
      rs.texture_depth,
      mp.iri_predicted,
      mp.urgency_score,
      mp.condition_class AS ml_condition_class,
      mp.is_anomaly,
      b.bridge_id,
      b.bridge_name,
      b.span_length,
      b.condition_rating AS bridge_condition,
      b.last_inspection
    FROM pavement_condition pc
    LEFT JOIN romdas_sections rs ON rs.link_id = pc.link_id
    LEFT JOIN romdas_ml_predictions mp ON mp.link_id = pc.link_id
    LEFT JOIN bridges b ON b.road_link_id = pc.link_id
    WHERE pc.link_id = '${linkId}'
    ORDER BY pc.survey_year DESC
  `,
};

// ── Condition Classes (IRI-based) ──────────────────────────────────────────────
export const CONDITION_CLASSES = {
  1: { label: 'Good',     iriRange: [0, 4],    color: '#22c55e', treatmentType: 'Routine maintenance' },
  2: { label: 'Fair',     iriRange: [4, 6],    color: '#84cc16', treatmentType: 'Preventive maintenance' },
  3: { label: 'Poor',     iriRange: [6, 8],    color: '#eab308', treatmentType: 'Rehabilitation' },
  4: { label: 'Bad',      iriRange: [8, 10],   color: '#f97316', treatmentType: 'Major rehabilitation' },
  5: { label: 'Very Bad', iriRange: [10, 999], color: '#ef4444', treatmentType: 'Reconstruction' },
} as const;

// ── Intent matching expansions for the bot ────────────────────────────────────
export const LINK_QUERY_INTENTS = [
  {
    patterns: ['what is link', 'tell me about link', 'show link', 'link id', 'road link', 'section'],
    queryId: 'LINK_DETAIL',
    description: 'Full history and attributes for a specific link_id',
    extractLinkId: (text: string): string | null => {
      // Match real Department of National Roads formats: A001_Link01, B101_Link02, C261_Link01, M3N2_Link01
      const m = text.match(/([A-Z]\d{1,3}[A-Z]?\d*_Link\d{2,})/i)
        ?? text.match(/([A-Z]\d{1,3}[A-Z]?\d*Int\d+_S\d+)/i);
      return m ? m[1].toUpperCase() : null;
    },
  },
  {
    patterns: ['all links on road', 'links on', 'sections of', 'road a0', 'road b', 'entire road', 'road c'],
    queryId: 'ROAD_ALL_LINKS',
    description: 'All links on a named road',
    extractRoadNumber: (text: string): string | null => {
      const m = text.match(/\b([A-Z]\d{1,3}[A-Z]?\d*)\b/i);
      if (!m) return null;
      const raw = m[1].toUpperCase();
      return raw.replace(/^([A-Z])(\d{1,2})$/, (_, l, n) => `${l}${n.padStart(3, '0')}`);
    },
  },
  {
    patterns: ['chainage', 'km marker', 'km post', 'location referencing', 'at km', 'from km', 'to km'],
    queryId: 'CHAINAGE_LOOKUP',
    description: 'Find link by chainage location on a road',
  },
  {
    patterns: ['bridge on', 'culvert on', 'structures on', 'bridge at link', 'crossing at'],
    queryId: 'LINK_STRUCTURES',
    description: 'Bridges and culverts on a specific road link',
  },
];

// ── Key road corridors (real Department of National Roads road numbers) ───────────────────────────────
export const KEY_CORRIDORS = [
  { name: 'Northern Corridor',   roads: ['A002'], description: 'Kampala–Jinja–Malaba–Kenya border',   length: 247 },
  { name: 'Central Corridor',    roads: ['A004'], description: 'Kampala–Masaka–Mutukula–Tanzania',     length: 220 },
  { name: 'Western Corridor',    roads: ['A003'], description: 'Kampala–Mbarara–Kabale–Rwanda/DRC',    length: 510 },
  { name: 'Northern Road',       roads: ['A001'], description: 'Kampala–Gulu–Nimule–South Sudan',      length: 515 },
  { name: 'Eastern Corridor',    roads: ['A005'], description: 'Kampala–Jinja–Tororo–Kenya',           length: 247 },
  { name: 'Hoima Road',          roads: ['B100'], description: 'Kampala–Hoima–Kafu',                   length: 237 },
] as const;

// ── Help text the bot can use when asked about road/link numbering ─────────────
export const LINK_ID_EXPLAINER = `
Uganda Department of National Roads uses a LINEAR REFERENCING SYSTEM (LRS) where each road is divided into
LINKS — management sections defined by nodes (intersections, towns, boundaries).

LINK ID FORMAT: [Road Number]_Link[Sequence Number]
  • A001_Link01 = First link on the A001 Kampala-Gulu highway
  • B101_Link02 = Second link on road B101
  • C261_Link01 = First link on road C261 (Matte-Sekanyonyi)
  • M3_Link01   = First link on M3 (Kampala Northern Bypass)

ROAD NUMBER FORMAT: Class letter + 3-digit zero-padded number
  • A001, A002, A003 ... (NOT the old "A1", "A2" shorthand)
  • B100, B101, B102 ...
  • C003, C150, C261 ...
  • M3, M20 (municipal roads may use shorter codes)

ROAD CLASSIFICATION:
  • Class A: International/trunk roads — 2,615 km (e.g. A001, A002, A004)
  • Class B: Secondary national roads — 2,863 km (e.g. B100, B101, B150)
  • Class C: Regional roads — 15,537 km (e.g. C003, C150, C261)
  • Class M: Municipal/urban classified roads — 145 km

CHAINAGE: Distance measured in km from the road datum (start of road).
  • Stored as decimal km in fields chainage_f and chainage_t
  • Example: chainage_f = 0.0, chainage_t = 32.27 means link spans 0 to 32.27 km

Total network: 21,160 km (mapped) across 1,013 links — Data: DNR GIS Jun 2025

To look up a specific road or link, say:
  "Show me link A001_Link01"
  "What is the condition of road A002?"
  "List all links in Northern Region"
`;
