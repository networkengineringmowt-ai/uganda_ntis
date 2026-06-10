/**
 * unraStandards — the platform's single source of truth for UNRA's OFFICIAL
 * asset-management taxonomy, ingested from the Asset Management Manuals
 * ("0. Manuals/Asset Management Manuals", D:/OneDrive repository):
 *
 *   Primary source: "Manual: Visual Inspections of Paved and Unpaved Roads"
 *   (UNRA, Feb 2012, incl. Addendum No. 1) — survey defect categories with
 *   1–5 grade scales, and the official road-inventory item lists
 *   (Continuous/Line data vs Discrete/Point data).
 *
 * Anything in the platform that names defects, grades, condition surveys or
 * inventory categories should import from here rather than hard-coding.
 */

// ── Survey grade scale (Visual Inspections manual, all defect tables) ─────────
/** Official 1–5 grading used across the visual-inspection defect tables. */
export const GRADE_SCALE = [
  { grade: 1, meaning: 'None / as-new — defect not present' },
  { grade: 2, meaning: 'Minor — isolated occurrence, limited area/severity' },
  { grade: 3, meaning: 'Moderate — defect established over part of segment' },
  { grade: 4, meaning: 'Severe — extensive occurrence and/or high severity' },
  { grade: 5, meaning: 'Very severe — defect dominates the rateable segment' },
] as const;

// ── Surface-condition survey defects (paved) — manual §Surveys for Paved Roads
export const PAVED_DEFECTS = [
  'Cracking',
  'Potholes',
  'Width Loss and Edge Drop',
  'Surface Deterioration',
  'Rutting',
  'Roadside Friction',
] as const;

// ── Surface-condition survey defects (gravel/earth) — §Surveys for Gravel and Earth Roads
export const UNPAVED_DEFECTS = [
  'Gravel Thickness',
  'Potholes',
  'Rutting',
  'Corrugations',
  'Formation Level',
  'Drainage Condition',
  'Erosion Gullies',
  'Roughness',
  'Roadside Friction',
] as const;

// ── Official inventory survey items — manual §Inventory Surveys ───────────────
export const INVENTORY_CONTINUOUS = [
  'Pavement Type', 'Dimensions', 'Number of Lanes', 'Terrain Type',
  'Drainage Ditch', 'Footpath', 'Traffic Island', 'Road Markings',
  'Roadside Structures', 'Safety Devices', 'Sideslope (Cutting, Embankment)',
] as const;

export const INVENTORY_DISCRETE = [
  'Start of Road', 'End of Road', 'Culverts', 'Junction', 'Road Markings',
  'Marker Posts', 'Railway Crossing', 'Road Signs', 'Speed/Safety Humps',
] as const;

// ── Road Inventory 8-way categorisation ──────────────────────────────────────
// Groups every official inventory item (plus the related survey defects) into
// 8 asset categories for the platform's Road Inventory split. Each category
// cites the manual items it covers.
export interface InventoryCategory {
  id: string;
  label: string;
  /** Official manual items covered (Continuous/Line + Discrete/Point). */
  manualItems: string[];
  /** Related visual-survey defects (paved/unpaved). */
  relatedDefects: string[];
  description: string;
}

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  {
    id: 'carriageway', label: 'Carriageway & Pavement',
    manualItems: ['Pavement Type', 'Dimensions', 'Number of Lanes'],
    relatedDefects: ['Cracking', 'Potholes', 'Surface Deterioration', 'Rutting', 'Gravel Thickness', 'Corrugations', 'Roughness'],
    description: 'Pavement/wearing-course type, carriageway width and lane configuration.',
  },
  {
    id: 'shoulders', label: 'Shoulders & Edges',
    manualItems: ['Dimensions (shoulder type & width)'],
    relatedDefects: ['Width Loss and Edge Drop'],
    description: 'Shoulder type/width and the carriageway edge condition (edge break, edge drop).',
  },
  {
    id: 'drainage', label: 'Drainage',
    manualItems: ['Drainage Ditch', 'Culverts'],
    relatedDefects: ['Drainage Condition', 'Erosion Gullies', 'Formation Level'],
    description: 'Side drains/ditches, culverts and cross-drainage; formation level relative to terrain.',
  },
  {
    id: 'structures', label: 'Roadside Structures',
    manualItems: ['Roadside Structures'],
    relatedDefects: [],
    description: 'Bridges, retaining walls and other structures along the alignment (links to BMS).',
  },
  {
    id: 'junctions', label: 'Junctions & Crossings',
    manualItems: ['Junction', 'Railway Crossing', 'Start of Road', 'End of Road'],
    relatedDefects: [],
    description: 'Junctions, railway crossings and the section termini (start/end reference points).',
  },
  {
    id: 'furniture', label: 'Road Furniture & Safety',
    manualItems: ['Road Signs', 'Marker Posts', 'Safety Devices', 'Speed/Safety Humps'],
    relatedDefects: [],
    description: 'Signs, marker posts, guardrails/safety devices, humps and rumble strips.',
  },
  {
    id: 'markings', label: 'Road Markings',
    manualItems: ['Road Markings (continuous)', 'Road Markings (discrete)'],
    relatedDefects: [],
    description: 'Longitudinal line markings and discrete markings (zebra crossings, stop lines…).',
  },
  {
    id: 'environs', label: 'Terrain & Road Environs',
    manualItems: ['Terrain Type', 'Sideslope (Cutting, Embankment)', 'Footpath', 'Traffic Island'],
    relatedDefects: ['Roadside Friction'],
    description: 'Terrain class, cut/fill side slopes, footpaths, islands and roadside friction.',
  },
];

// ── Asset Management Manuals registry (the ingested document set) ─────────────
export const AMS_MANUALS = [
  { id: 'visual-2012',  title: 'Manual: Visual Inspections of Paved & Unpaved Roads (Feb 2012, + Addendum 1)', role: 'Defect grading (1–5) & inventory survey items — THE taxonomy source' },
  { id: 'rms-user',     title: 'UNRA AMS 3 — RMS User Manual 2017',                       role: 'Road Management System operation' },
  { id: 'pms-user',     title: 'UNRA AMS 5 — PMS User Manual 2017',                       role: 'Pavement Management System operation' },
  { id: 'bms-user',     title: 'UNRA AMS 6 — BMS User Manual v1 (Sept 2017)',             role: 'Bridge Management System operation' },
  { id: 'gis-user',     title: 'UNRA AMS 4 — GIS User Manual 1.0 + GIS Data Dictionary',  role: 'GIS layers & attribute dictionary' },
  { id: 'data-coll',    title: 'UNRA AMS 2 — Road Data Collection 0.1',                   role: 'Survey data-collection procedures' },
  { id: 'loc-ref',      title: 'UNRA AMS 1 — Location Referencing 0.1',                   role: 'Link/chainage referencing convention' },
  { id: 'data-format',  title: 'UNRA AMS — Road Data Format Specifications 1.0',          role: 'Data exchange formats' },
  { id: 'bridge-coll',  title: 'UNRA AMS X — Bridge Data Collection 0.1',                 role: 'Structure survey procedures' },
  { id: 'perf-ind',     title: 'Guidelines for Road Performance Indicators',              role: 'KPI design & target-setting methodology' },
  { id: 'pavement-pol', title: 'Pavement Data Collection Policies & Procedures',          role: 'Pavement survey policy' },
  { id: 'traffic-pol',  title: 'Draft Traffic Data Collection Policies (+ QMP template)', role: 'Traffic count policy & QA' },
  { id: 'ltppms',       title: 'LTPPMS Establishment Guide',                              role: 'Long-term pavement performance monitoring' },
  { id: 'panel-insp',   title: 'Panel Inspection Guide',                                  role: 'Panel/peer inspection procedure' },
  { id: 'am-policy',    title: 'UNRA Road Infrastructure Asset Management Policy',        role: 'Overarching AM policy' },
  { id: 'pbmms',        title: 'UNRA Pavement & Bridge Maintenance Management',           role: 'Maintenance management framework' },
] as const;

export const MANUAL_SOURCE_NOTE =
  'Source: UNRA Asset Management Manuals — primarily "Visual Inspections of Paved and Unpaved Roads" (Feb 2012).';
