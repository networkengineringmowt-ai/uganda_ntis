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
  unpaved: { color: '#A16207', weight: 1.5, opacity: 0.75, dashArray: '4 3'  as string | undefined },
  unknown: { color: '#6B7280', weight: 1.5, opacity: 0.65, dashArray: '2 4'  as string | undefined },
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
