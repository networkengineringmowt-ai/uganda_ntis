/**
 * dataDictionary — the single source of truth for what every field, metric and
 * categorical value on the platform MEANS. Hover tips (InfoTip / Term) and the
 * browsable Data Dictionary page both read from here, so a definition written
 * once shows up everywhere.
 *
 * Add an entry under the right group. `key` is matched case-insensitively
 * against column keys, column labels, and KPI labels (spaces/underscores
 * normalised), so wiring a tip is usually zero-effort.
 */

export interface DictValue { value: string; meaning: string; color?: string }
export interface DictEntry {
  key: string;            // canonical lookup key (lower-case, no spaces)
  term: string;          // display term
  label?: string;        // longer label
  unit?: string;         // unit of measure (numeric fields)
  group: string;         // dictionary section
  description: string;   // what it is / how it is derived
  range?: string;        // typical / valid range for numeric fields
  source?: string;       // where the value comes from
  values?: DictValue[];  // categorical value meanings
  aliases?: string[];    // extra keys that map here
}

export const DICTIONARY: DictEntry[] = [
  // ── Pavement condition ─────────────────────────────────────────────────────
  {
    key: 'iri', term: 'IRI', label: 'International Roughness Index', unit: 'm/km', group: 'Pavement Condition',
    range: '0 (perfect) – 20+ (impassable)', source: 'ROMDAS laser profilometer survey, carried forward by the deterioration model',
    description: 'The world-standard measure of longitudinal road roughness — the accumulated suspension travel (mm) a quarter-car experiences per km driven. Lower is smoother. Drives ride quality, vehicle operating cost and the maintenance trigger.',
    values: [
      { value: '< 3.5', meaning: 'Good — smooth, recently surfaced', color: '#00ff88' },
      { value: '3.5 – 6.5', meaning: 'Fair — routine maintenance', color: '#ffd23f' },
      { value: '6.5 – 9.0', meaning: 'Poor — periodic maintenance due', color: '#ff8c00' },
      { value: '> 9.0', meaning: 'Very Poor — rehabilitation/reconstruction', color: '#ff2d78' },
    ],
  },
  {
    key: 'vci', term: 'VCI', label: 'Visual Condition Index', unit: '%', group: 'Pavement Condition',
    range: '0 (failed) – 100 (perfect)', source: 'Visual defect survey, weighted-deduction model (UNRA AMS manual)',
    description: 'A 0–100 score of surface condition from visible distress (cracking, ravelling, potholes, rutting, edge break). 100 = no distress; deductions are taken per defect type and severity. The headline pavement-health indicator.',
    values: [
      { value: '≥ 85', meaning: 'Very Good', color: '#00ff88' },
      { value: '75 – 84', meaning: 'Good', color: '#7CFC00' },
      { value: '65 – 74', meaning: 'Fair', color: '#ffd23f' },
      { value: '55 – 64', meaning: 'Poor', color: '#ff8c00' },
      { value: '< 55', meaning: 'Very Poor', color: '#ff2d78' },
    ],
  },
  {
    key: 'pci', term: 'PCI', label: 'Pavement Condition Index', unit: '0–100', group: 'Pavement Condition',
    range: '0 – 100', source: 'ASTM D6433 distress survey',
    description: 'Composite 0–100 index combining distress type, severity and density into one pavement-health number (ASTM D6433). Complementary to VCI; higher is better.',
  },
  {
    key: 'rut_mm', term: 'Rutting', unit: 'mm', group: 'Pavement Condition', aliases: ['rutting', 'rut'],
    range: '0 – 30 mm', source: 'ROMDAS transverse laser profile',
    description: 'Depth of longitudinal depressions in the wheel paths, caused by traffic-induced deformation of the pavement layers. >20 mm holds water and is a safety (aquaplaning) hazard.',
    values: [
      { value: '< 5 mm', meaning: 'Negligible', color: '#22c55e' },
      { value: '5 – 10 mm', meaning: 'Moderate', color: '#eab308' },
      { value: '10 – 20 mm', meaning: 'Severe', color: '#f97316' },
      { value: '> 20 mm', meaning: 'Critical — safety hazard', color: '#ef4444' },
    ],
  },
  {
    key: 'cracking', term: 'Cracking', unit: '% area', group: 'Pavement Condition', aliases: ['crack', 'cracking_pct'],
    range: '0 – 100 %', source: 'Visual / AI image survey',
    description: 'Proportion of the surface affected by cracking (longitudinal, transverse, block or crocodile/fatigue). Crocodile cracking signals structural fatigue; high cracking lets water reach the base and accelerates failure.',
  },
  {
    key: 'pavement_age', term: 'Pavement Age', unit: 'years', group: 'Pavement Condition', aliases: ['age'],
    description: 'Years since the link was last surfaced or rehabilitated. Compared against design life (≈20 yr bituminous, ≈7 yr unsealed) to flag assets past their service life.',
  },
  {
    key: 'surface_type', term: 'Surface Type', group: 'Pavement Condition', aliases: ['surface', 'surface_cat', 'surface_ty'],
    description: 'The running-surface material of the road link.',
    values: [
      { value: 'Bituminous / Paved', meaning: 'Sealed asphalt or surface-dressed (DBST) — the paved network', color: '#00f5ff' },
      { value: 'Unsealed / Gravel', meaning: 'Gravel or earth wearing course — the unpaved network', color: '#ff8c00' },
      { value: 'Concrete', meaning: 'Rigid Portland-cement concrete pavement', color: '#94a3b8' },
    ],
  },

  // ── Road classification ────────────────────────────────────────────────────
  {
    key: 'road_class', term: 'Road Class', group: 'Network', aliases: ['class', 'rd_class', 'cls'],
    source: 'DNR functional classification (NDPIV)',
    description: 'Functional classification of the national road, setting design standard, target condition and maintenance priority.',
    values: [
      { value: 'A', meaning: 'Class A — international trunk / primary corridor', color: '#00f5ff' },
      { value: 'B', meaning: 'Class B — national link road', color: '#00ff88' },
      { value: 'C', meaning: 'Class C — district/feeder collector', color: '#ffd23f' },
      { value: 'M', meaning: 'Class M — urban/municipal road', color: '#b967ff' },
    ],
  },
  {
    key: 'maintenance_region', term: 'Maintenance Region', group: 'Network', aliases: ['region'],
    description: 'One of the DNR road-maintenance regions the asset falls under (Central, Eastern, Southern, Western, Northern, North-Eastern). Governs the responsible station and budget allocation.',
  },
  {
    key: 'length_km', term: 'Length', unit: 'km', group: 'Network', aliases: ['length', 'km', 'length_km'],
    description: 'Carriageway length of the road link in kilometres, from the FY25-26 NDPIV master and the network2026 geometry.',
  },
  {
    key: 'oprc', term: 'OPRC', label: 'Output & Performance-based Road Contract', group: 'Network',
    description: 'A multi-year contract paying the contractor for ROAD CONDITION OUTPUTS (e.g. maintaining IRI/VCI above a threshold) rather than for inputs/quantities — transferring performance risk to the contractor. 9 active lots cover the network.',
  },
  {
    key: 'ndpiv', term: 'NDP IV', label: 'National Development Plan IV', group: 'Network',
    description: "Uganda's 5-year national development plan (FY25/26 onward). The platform's network reference (21,302 km), upgrade and rehabilitation programme are aligned to the NDPIV road investment list.",
  },

  // ── Traffic ────────────────────────────────────────────────────────────────
  {
    key: 'aadt', term: 'AADT', label: 'Annual Average Daily Traffic', unit: 'veh/day', group: 'Traffic',
    aliases: ['aadt_predicted', 'adt', 'aadt_latest', 'traffic'], source: 'TIS counts / ATC stations, projected from the 2016 base year',
    range: 'C-road ~300 → A-road 10,000+',
    description: 'Average number of vehicles passing a point per day over a year, all directions. THE core traffic-demand measure; every traffic figure on the platform is anchored to the 2016 base year and projected with per-class compound growth.',
  },
  {
    key: 'base_year', term: 'Base Year', group: 'Traffic',
    description: 'The reference year all traffic statistics are anchored to: 2016 (growth factor = 1.00). Observed counts are scaled to/from 2016 so every projection is comparable.',
  },
  {
    key: 'growth_factor', term: 'Growth Factor', group: 'Traffic', aliases: ['growth_rate', 'growth'],
    description: 'Multiplier applied to the 2016-base AADT to project traffic to another year, from per-vehicle-class compound annual growth rates (motorcycles 6%, cars 5%, trucks 3.5%, …).',
  },
  {
    key: 'esal', term: 'ESAL', label: 'Equivalent Single Axle Load', unit: '80 kN passes', group: 'Traffic',
    description: 'Heavy-vehicle damage expressed as equivalent passes of a standard 80 kN single axle (the "4th-power law": one heavy axle can equal thousands of cars). Drives structural/overloading risk and pavement design.',
  },
  {
    key: 'heavy_vehicle_pct', term: 'Heavy Vehicle %', unit: '%', group: 'Traffic', aliases: ['hgv', 'heavy_pct'],
    description: 'Share of AADT that is heavy goods vehicles & buses. High % means faster structural wear for the same total traffic.',
  },
  {
    key: 'congestion_risk', term: 'Congestion Risk', group: 'Traffic',
    description: 'Predicted demand ÷ design capacity for the link (capacities: M 15k, A 10k, B 5k, C 2.5k PCU/day).',
    values: [
      { value: 'Low', meaning: '< 40% of capacity — free flow', color: '#00ff88' },
      { value: 'Medium', meaning: '40–70% — monitor growth', color: '#ffd23f' },
      { value: 'High', meaning: '70–90% — plan capacity improvement', color: '#ff8c00' },
      { value: 'Critical', meaning: '> 90% — immediate upgrade', color: '#ff2d78' },
    ],
  },

  // ── FWD / structural ─────────────────────────────────────────────────────────
  {
    key: 'd0', term: 'D0 (peak deflection)', unit: 'microns (µm)', group: 'FWD / Structural', aliases: ['d300', 'd600', 'd900'],
    source: 'Falling Weight Deflectometer survey',
    description: 'Surface deflection measured directly under the FWD load plate (D0) and at 300/600/900 mm offsets. The deflection "bowl" shape reveals layer stiffness — D0 reflects the whole pavement, outer sensors the subgrade. Higher deflection = weaker structure.',
  },
  {
    key: 'load_kn', term: 'FWD Load', unit: 'kN', group: 'FWD / Structural',
    description: 'Impulse load applied by the Falling Weight Deflectometer (typically ~40–50 kN, simulating a heavy wheel) to measure the pavement’s deflection response.',
  },
  {
    key: 'sn', term: 'Structural Number (SN)', group: 'FWD / Structural', aliases: ['sn_required', 'sn_existing', 'critical_index'],
    description: 'AASHTO index of total pavement structural capacity (sum of layer thickness × coefficient). Critical index = (SN_required − SN_existing)/SN_required; > 0.5 indicates structural deficiency needing investigation.',
  },

  // ── Bridges & structures ──────────────────────────────────────────────────
  {
    key: 'overall_rating', term: 'Condition Rating', group: 'Bridges', aliases: ['conditionrating', 'r_substructure', 'r_superstructure', 'r_approaches', 'r_roadway', 'r_waterway', 'rating'],
    source: 'Bridge inspection (BMS element ratings)',
    description: 'Element and overall condition rating from the bridge inspection. Element ratings (substructure, superstructure, deck/roadway, approaches, waterway) roll up to the overall structure rating.',
    values: [
      { value: 'Very Good / 5', meaning: 'As-new, no action', color: '#00ff88' },
      { value: 'Good / 4', meaning: 'Minor defects, routine maintenance', color: '#7CFC00' },
      { value: 'Fair / 3', meaning: 'Moderate defects, monitor', color: '#ffd23f' },
      { value: 'Poor / 2', meaning: 'Significant defects, repair needed', color: '#ff8c00' },
      { value: 'Critical / 1', meaning: 'Severe — urgent intervention / load restriction', color: '#ff2d78' },
    ],
  },
  {
    key: 'scour_risk', term: 'Scour Risk', group: 'Bridges',
    description: 'Risk that river flow erodes material from around bridge foundations/abutments — the leading cause of bridge failure. Rated from waterway inspection and hydraulic exposure.',
    values: [
      { value: 'Low', meaning: 'Stable bed, protected foundations', color: '#00ff88' },
      { value: 'Medium', meaning: 'Some exposure, monitor at floods', color: '#ffd23f' },
      { value: 'High', meaning: 'Active scour — countermeasures needed', color: '#ff2d78' },
    ],
  },
  {
    key: 'type_crossing', term: 'Crossing Type', group: 'Bridges', aliases: ['type_cross', 'crossingtype'],
    description: 'What the structure carries the road over — river, stream, valley, road/rail, or drainage. Determines hydraulic and structural design.',
  },
  {
    key: 'deck_material', term: 'Deck Material', group: 'Bridges',
    description: 'Primary material of the bridge deck/superstructure (reinforced concrete, prestressed concrete, steel, composite, masonry, timber). Governs load capacity, durability and inspection regime.',
  },
  {
    key: 'bridge_type', term: 'Bridge Type', group: 'Bridges',
    description: 'Structural form — slab, beam/girder, box culvert, arch, truss, suspension. Affects span capability, cost and maintenance.',
  },

  // ── Maintenance & programming ────────────────────────────────────────────────
  {
    key: 'urgency', term: 'Intervention Urgency', group: 'Maintenance',
    description: 'When the ML intervention model schedules works for the link, from condition and deterioration rate.',
    values: [
      { value: 'now', meaning: 'Immediate — condition past trigger', color: '#ff2d78' },
      { value: 'urgent', meaning: 'This financial year', color: '#ff8c00' },
      { value: 'soon', meaning: 'Within the medium-term plan (1–3 yr)', color: '#ffd23f' },
      { value: 'planned', meaning: 'Monitored, in the long-term programme', color: '#00ff88' },
    ],
  },
  {
    key: 'treatment', term: 'Treatment', group: 'Maintenance',
    description: 'Recommended maintenance treatment (routine, periodic resealing, overlay, partial/full rehabilitation, reconstruction) selected by the intervention model from condition and traffic.',
  },
  {
    key: 'total_cost_usd', term: 'Estimated Cost', unit: 'USD', group: 'Maintenance', aliases: ['cost', 'cost_usd', 'estimatedreplacementcost'],
    description: 'Modelled cost of the recommended intervention, from the MoWT schedule of rates × quantity. Used for budget planning and prioritisation.',
  },

  // ── Generic geospatial ───────────────────────────────────────────────────────
  {
    key: 'link_id', term: 'Link ID', group: 'Identifiers',
    description: 'Unique identifier of a road link in the FY25-26 network master (e.g. A001_Link01). Joins condition, traffic, inventory and works data to the geometry.',
  },
  {
    key: 'bridge_no', term: 'Structure ID', group: 'Identifiers', aliases: ['structure_id', 'id'],
    description: 'Unique structure number — B-series for bridges, C-series for major culverts.',
  },
  {
    key: 'chainage', term: 'Chainage', unit: 'km', group: 'Identifiers', aliases: ['chainage_km', 'chainage_from', 'chainage_to'],
    description: 'Distance along the road from its start point (km), locating an asset or survey point on the link.',
  },
];

// ── Lookup index (built once) ──────────────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().replace(/[\s_/()%-]+/g, '').trim();
const INDEX: Record<string, DictEntry> = {};
for (const e of DICTIONARY) {
  INDEX[norm(e.key)] = e;
  INDEX[norm(e.term)] = e;
  if (e.label) INDEX[norm(e.label)] = e;
  (e.aliases ?? []).forEach(a => { INDEX[norm(a)] = e; });
}

/** Find a dictionary entry by key, term, label or alias (fuzzy, case-insensitive). */
export function lookup(keyOrLabel?: string | null): DictEntry | undefined {
  if (!keyOrLabel) return undefined;
  const n = norm(keyOrLabel);
  if (INDEX[n]) return INDEX[n];
  // soft contains match (e.g. "Avg IRI (m/km)" → iri)
  for (const k of Object.keys(INDEX)) {
    if (k.length >= 3 && (n.includes(k) || k.includes(n))) return INDEX[k];
  }
  return undefined;
}

/** All dictionary groups in display order. */
export const DICT_GROUPS = Array.from(new Set(DICTIONARY.map(e => e.group)));
