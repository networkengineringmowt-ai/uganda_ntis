/**
 * useCrossLinks — returns related sections and data connections for any given section.
 *
 * The links are static structural descriptions (not runtime-computed per link_id)
 * because cross-section data joins require shared link_id context that isn't
 * available at the top level. For per-link deep links, use the FeatureAnalyticsPanel.
 *
 * Usage: const links = useCrossLinks('traffic');
 */

import type { ActiveView } from '../types';

export interface CrossLink {
  targetView: ActiveView;
  label: string;
  description: string;
  dataField: string;
}

const CROSS_LINK_MAP: Record<string, CrossLink[]> = {
  roadnetwork: [
    { targetView: 'roadcondition', label: 'Condition Map', description: 'IRI & pavement condition per link', dataField: 'iri / condition_rating' },
    { targetView: 'traffic',       label: 'Traffic',       description: 'AADT per link (TIS 2025)',         dataField: 'aadt_predicted' },
    { targetView: 'bms',           label: 'BMS',           description: 'Bridges on each corridor',         dataField: 'bridge_count / link_id' },
    { targetView: 'lifecycle',     label: 'Lifecycle',     description: 'Last intervention per link',       dataField: 'rehabilitation_year' },
    { targetView: 'overloading',   label: 'Overloading',   description: 'ESAL risk index per link',         dataField: 'risk_index / daily_esals' },
  ],
  roadcondition: [
    { targetView: 'roadnetwork',   label: 'Road Network',  description: 'GIS geometry for this link',       dataField: 'link_id / geometry' },
    { targetView: 'traffic',       label: 'Traffic',       description: 'Load factor driving deterioration', dataField: 'aadt_predicted / heavy_vehicle_pct' },
    { targetView: 'budget',        label: 'Budget',        description: 'Maintenance cost per link',        dataField: 'costMUgx / treatment_type' },
    { targetView: 'lifecycle',     label: 'Lifecycle',     description: 'IRI trajectory over time',         dataField: 'current_iri / iri_trajectory' },
    { targetView: 'hdm4',          label: 'HDM-4',         description: 'Deterioration model prediction',   dataField: 'iri_predicted / urgency_score' },
  ],
  traffic: [
    { targetView: 'roadnetwork',   label: 'Road Network',  description: 'Network geometry for survey links', dataField: 'link_id / length_km' },
    { targetView: 'overloading',   label: 'Overloading',   description: 'ESAL load from this traffic count', dataField: 'daily_esals / hgv_pct' },
    { targetView: 'roadcondition', label: 'Condition',     description: 'Pavement damage from AADT',        dataField: 'iri / congestion_risk' },
    { targetView: 'budget',        label: 'Budget',        description: 'Traffic-weighted maintenance need', dataField: 'maintenance_cost / treatment' },
  ],
  overloading: [
    { targetView: 'traffic',       label: 'Traffic',       description: 'AADT source for ESAL calculation', dataField: 'aadt_predicted / heavy_vehicle_pct' },
    { targetView: 'roadcondition', label: 'Condition',     description: 'Pavement damage from overloading', dataField: 'iri / defect_type' },
    { targetView: 'roadnetwork',   label: 'Road Network',  description: 'Road class & surface for risk index', dataField: 'road_class / surface_type' },
    { targetView: 'budget',        label: 'Budget',        description: 'Early intervention cost from damage', dataField: 'premature_failure_cost' },
  ],
  bms: [
    { targetView: 'roadnetwork',   label: 'Road Network',  description: 'Bridges plotted on road network',  dataField: 'road_no / link_id' },
    { targetView: 'lifecycle',     label: 'Lifecycle',     description: 'Structure life cycle & last repair', dataField: 'inspection_date / condition_rating' },
    { targetView: 'budget',        label: 'Budget',        description: 'Bridge repair & replacement costs', dataField: 'repair_cost / priority_score' },
    { targetView: 'projects',      label: 'NDPIV',         description: 'Bridge investment in NDP IV',      dataField: 'project_type === Bridges' },
  ],
  lifecycle: [
    { targetView: 'roadnetwork',   label: 'Road Network',  description: 'Link geometry & attributes',       dataField: 'link_id / length_km / road_class' },
    { targetView: 'roadcondition', label: 'Condition',     description: 'Current IRI driving lifecycle',    dataField: 'current_iri / condition_rating' },
    { targetView: 'budget',        label: 'Budget',        description: 'Maintenance costs from lifecycle model', dataField: 'projected_cost_2035' },
    { targetView: 'hdm4',          label: 'HDM-4',         description: 'Deterioration curves for this link', dataField: 'iri_trajectory / growth_rate' },
  ],
  budget: [
    { targetView: 'roadcondition', label: 'Condition Map', description: 'IRI drives maintenance priority',  dataField: 'iri / condition_grade' },
    { targetView: 'lifecycle',     label: 'Lifecycle',     description: 'LCC per link over 40 years',      dataField: 'lifecycle_cost / treatment_year' },
    { targetView: 'projects',      label: 'NDPIV',         description: 'Capital vs maintenance split',     dataField: 'budget_usd / dev_bn' },
    { targetView: 'overloading',   label: 'Overloading',   description: 'Premature failure cost from overload', dataField: 'annual_damage_bn' },
  ],
  oprc: [
    { targetView: 'roadnetwork',   label: 'Road Network',  description: 'OPRC lot corridor on network',    dataField: 'road_no / lot_id' },
    { targetView: 'budget',        label: 'Budget',        description: 'OPRC contract value vs maintenance cost', dataField: 'contract_value_usd / cost_per_km' },
    { targetView: 'roadcondition', label: 'Condition',     description: 'Before/after pavement condition',  dataField: 'iri_before / iri_after / performance_score' },
    { targetView: 'traffic',       label: 'Traffic',       description: 'Traffic load driving OPRC design',  dataField: 'aadt / heavy_vehicle_pct' },
  ],
  projects: [
    { targetView: 'roadnetwork',   label: 'Road Network',  description: 'Project corridors on network',    dataField: 'road_no / corridor' },
    { targetView: 'budget',        label: 'Budget',        description: 'Capital allocation vs progress',  dataField: 'budget_usd / disbursed_usd' },
    { targetView: 'bms',           label: 'BMS',           description: 'Bridge components in NDPIV',      dataField: 'project_type === Bridges' },
    { targetView: 'roadcondition', label: 'Condition',     description: 'Pre/post-project pavement condition', dataField: 'iri_before / iri_after' },
  ],
  hdm4: [
    { targetView: 'roadcondition', label: 'Condition Map', description: 'IRI input data for HDM-4',        dataField: 'iri / condition_rating' },
    { targetView: 'traffic',       label: 'Traffic',       description: 'AADT / ESAL inputs for deterioration', dataField: 'aadt / esal_factor' },
    { targetView: 'lifecycle',     label: 'Lifecycle',     description: 'HDM-4 feeds lifecycle trajectories', dataField: 'iri_trajectory / treatment_triggers' },
    { targetView: 'budget',        label: 'Budget',        description: 'HDM-4 programme cost outputs',    dataField: 'treatment_cost / nbc_ratio' },
  ],
};

/**
 * Returns cross-links for the given section view ID.
 * Returns empty array for sections with no defined cross-links.
 */
export function useCrossLinks(sectionId: string): CrossLink[] {
  return CROSS_LINK_MAP[sectionId] ?? [];
}
