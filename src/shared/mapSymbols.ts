// Shared map constants — single source of truth for all map components.

export const ESRI_TILE_URLS = {
  imagery: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  labels:  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
};

export const ESRI_ATTRIBUTIONS = {
  imagery: 'Esri, Maxar, Earthstar Geographics, CNES/Airbus DS, USDA, USGS',
  labels:  'Esri',
};

// Road line symbology — matches the dark-tarmac shimmer style on satellite imagery.
export const ROAD_STYLES = {
  paved:   { color: '#111111', weight: 3.5, opacity: 0.95, dashArray: undefined as string | undefined },
  unpaved: { color: '#C8A84B', weight: 1.5, opacity: 0.85, dashArray: '4,3'  as string | undefined },
  unknown: { color: '#6B7280', weight: 2.0, opacity: 0.85, dashArray: '2 4'  as string | undefined },
  shimmer: { color: '#555555', weight: 1.5, opacity: 0.5 },
};

// Structure markers — minZoom keeps them hidden at country-overview zoom.
export const STRUCTURE_STYLES = {
  bridge:  { color: '#3B82F6', radius: 5, minZoom: 10 },
  culvert: { color: '#F59E0B', radius: 4, minZoom: 10 },
};

// Congestion risk palette — shared between PredictionsPanel and ATCView.
export const CONGESTION_COLORS: Record<string, string> = {
  Low:      '#00ff88',
  Medium:   '#ffd23f',
  High:     '#ff6b35',
  Critical: '#ff2d78',
};

export function surfaceCategory(surface: string): 'paved' | 'unpaved' | 'unknown' {
  if (['Bituminous', 'Paved', 'Asphalt', 'Concrete', 'Bitumen'].includes(surface)) return 'paved';
  if (['Unsealed', 'Gravel', 'Earth'].includes(surface)) return 'unpaved';
  return 'unknown';
}

// Road condition palette (IRI-based classification)
export const CONDITION_COLORS: Record<string, string> = {
  Good:       '#22c55e',
  Fair:       '#84cc16',
  Poor:       '#eab308',
  Bad:        '#f97316',
  'Very Bad': '#ef4444',
  unknown:    '#64748b',
};

// Traffic volume bands
export const TRAFFIC_COLORS: Record<string, string> = {
  low:      '#22d3ee',
  medium:   '#fbbf24',
  high:     '#f97316',
  critical: '#ef4444',
};

// Infrastructure layer symbols — single source for InfraLayers.tsx and legends
export const INFRA_SYMBOLS = {
  ferryLine:          { color: '#22d3ee', weight: 2,   opacity: 0.72, dashArray: '6 4', fill: false },
  ferryPoint:         { color: '#22d3ee', fillColor: '#22d3ee',  fillOpacity: 0.75, weight: 1.5, opacity: 0.9 },
  weighbridgePerm:    { color: '#f97316', fillColor: '#fb923c',  fillOpacity: 0.9,  weight: 2,   opacity: 0.9 },
  weighbridgeBorder:  { color: '#ef4444', fillColor: '#fca5a5',  fillOpacity: 0.9,  weight: 2,   opacity: 0.9 },
  weighbridgeProp:    { color: '#f97316', fillColor: 'transparent', fillOpacity: 0, weight: 2,   opacity: 0.9, dashArray: '3 3' },
  airportIntl:        { color: '#818cf8', fillColor: '#818cf8',  fillOpacity: 0.9,  weight: 2,   opacity: 0.95 },
  airportDomestic:    { color: '#818cf8', fillColor: '#818cf8',  fillOpacity: 0.65, weight: 1.5, opacity: 0.95 },
  airfield:           { color: '#94a3b8', fillColor: '#94a3b8',  fillOpacity: 0.55, weight: 1,   opacity: 0.8 },
  railOperational:    { color: '#9ca3af', weight: 1,   opacity: 0.18 },
  railNonOp:          { color: '#9ca3af', weight: 1,   opacity: 0.12, dashArray: '4 4' },
  railProposed:       { color: '#9ca3af', weight: 1,   opacity: 0.15, dashArray: '8 3' },
};

// Project status colours
export const PROJECT_STATUS_COLORS: Record<string, string> = {
  Completed:     '#22c55e',
  Ongoing:       '#3b82f6',
  Planned:       '#fbbf24',
  Stalled:       '#f97316',
  Cancelled:     '#ef4444',
  'Not Started': '#64748b',
};

// Administrative and protected-area boundary styles
export const PARK_STYLE = {
  color: '#16a34a', fillColor: '#15803d', weight: 1, opacity: 0.5, fillOpacity: 0.08,
};

export const DISTRICT_STYLE = {
  color: '#475569', fillColor: 'transparent', weight: 0.8, opacity: 0.45, fillOpacity: 0,
};

export const REGION_STYLE = {
  color: '#64748b', fillColor: 'transparent', weight: 1.2, opacity: 0.55, fillOpacity: 0,
};
