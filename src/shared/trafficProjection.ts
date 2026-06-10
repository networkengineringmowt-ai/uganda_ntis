/**
 * trafficProjection.ts — Projects traffic counts forward to the current date.
 *
 * Each vehicle class has its own annual growth rate. AADT is projected forward
 * from its base survey year to the current platform reference date (June 2026).
 *
 * Formula:   projected = base × (1 + g)^(2026 - base_year)
 *
 * Per-class annual growth rates (% per year):
 *   Motorcycles                6.0%
 *   Saloon Cars & Taxis        5.0%
 *   Light Goods / 4WD          4.0%
 *   Small Bus (Matatu)         4.0%
 *   Medium Bus (Coaster)       3.0%
 *   Large Bus                  3.0%
 *   Light Trucks               4.0%
 *   Heavy Trucks               3.5%
 *   Truck Trailers             2.5%
 *   NMT (Bicycles / Carts)     1.0%
 */

export const CURRENT_YEAR = 2026;
export const CURRENT_MONTH_LABEL = 'June 2026';

/** Per-class annual growth rate (decimal). Keys match VC_LABELS below. */
export const VC_GROWTH: Record<string, number> = {
  motorcycles:   0.060,
  cars_taxis:    0.050,
  light_goods:   0.040,
  minibus:       0.040,
  medium_bus:    0.030,
  large_bus:     0.030,
  light_truck:   0.040,
  heavy_truck:   0.035,
  trailer:       0.025,
  nmt:           0.010,
};

/** Vehicle class definitions (label + share of network avg + growth key). */
export interface VehicleClass {
  key:    string;
  label:  string;
  short:  string;
  share:  number;   // proportion of total AADT (network average)
  growth: number;   // annual growth rate (decimal)
}

export const VC_CLASSES: VehicleClass[] = [
  { key: 'motorcycles', label: 'Motorcycles',         short: 'Moto',   share: 0.295, growth: VC_GROWTH.motorcycles },
  { key: 'cars_taxis',  label: 'Saloon Cars & Taxis', short: 'Cars',   share: 0.248, growth: VC_GROWTH.cars_taxis  },
  { key: 'light_goods', label: 'Light Goods / 4WD',   short: 'LGV',    share: 0.118, growth: VC_GROWTH.light_goods },
  { key: 'minibus',     label: 'Small Bus (Matatu)',  short: 'S.Bus',  share: 0.082, growth: VC_GROWTH.minibus     },
  { key: 'medium_bus',  label: 'Medium Bus (Coaster)', short: 'M.Bus', share: 0.053, growth: VC_GROWTH.medium_bus  },
  { key: 'large_bus',   label: 'Large Bus',           short: 'L.Bus',  share: 0.042, growth: VC_GROWTH.large_bus   },
  { key: 'light_truck', label: 'Light Trucks',        short: 'L.Trk',  share: 0.062, growth: VC_GROWTH.light_truck },
  { key: 'heavy_truck', label: 'Heavy Trucks',        short: 'H.Trk',  share: 0.074, growth: VC_GROWTH.heavy_truck },
  { key: 'trailer',     label: 'Truck Trailers',      short: 'Artic',  share: 0.026, growth: VC_GROWTH.trailer     },
];

/**
 * Project a vehicle-class count from a base survey year to the current year (2026).
 *   projected = base × (1 + g)^(currentYear - baseYear)
 */
export function projectClass(
  baseCount: number,
  baseYear:  number,
  growth:    number,
  toYear:    number = CURRENT_YEAR,
): number {
  const years = toYear - baseYear;
  if (years <= 0) return baseCount;
  return baseCount * Math.pow(1 + growth, years);
}

/**
 * Project a total AADT to the current year using the weighted average growth
 * of all vehicle classes (network-average composition).
 */
export const NETWORK_BLENDED_GROWTH: number =
  VC_CLASSES.reduce((s, c) => s + c.share * c.growth, 0);

export function projectAADT(
  baseAadt: number,
  baseYear: number,
  toYear:   number = CURRENT_YEAR,
): number {
  const years = toYear - baseYear;
  if (years <= 0) return baseAadt;
  return baseAadt * Math.pow(1 + NETWORK_BLENDED_GROWTH, years);
}

/**
 * Break AADT into per-class counts then project each forward independently.
 * Returns both base and projected counts.
 */
export interface ClassProjection {
  key:        string;
  label:      string;
  short:      string;
  baseCount:  number;
  projCount:  number;
  growth:     number;
  share:      number;
}

export function projectAllClasses(
  baseAadt: number,
  baseYear: number,
  toYear:   number = CURRENT_YEAR,
): ClassProjection[] {
  return VC_CLASSES.map(vc => {
    const baseCount = Math.round(baseAadt * vc.share);
    const projCount = Math.round(projectClass(baseCount, baseYear, vc.growth, toYear));
    return { key: vc.key, label: vc.label, short: vc.short, baseCount, projCount, growth: vc.growth, share: vc.share };
  });
}

/** Sum of per-class projected counts (slightly differs from projectAADT because of per-class compounding). */
export function projectAADTByClass(
  baseAadt: number,
  baseYear: number,
  toYear:   number = CURRENT_YEAR,
): number {
  return projectAllClasses(baseAadt, baseYear, toYear).reduce((s, c) => s + c.projCount, 0);
}
