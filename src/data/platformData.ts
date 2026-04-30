/**
 * Platform-level data loaders for the Uganda National Roads Management Platform.
 * Separate from bridge/culvert data (generateData.ts).
 */

import type { OngoingProject, TrafficYearSummary, WtssRecord } from '../types';

// ─── Analytics cache ──────────────────────────────────────────────────────────
let analyticsCache: PlatformAnalytics | null = null;
let projectsCache:  OngoingProject[]   | null = null;

export interface RegionTraffic {
  year:                               number;
  region:                             string;
  covered_length_km:                  number;
  network_weighted_motorised_aadt:    number;
  network_weighted_non_motorised_aadt?: number;
  total_vehicle_km:                   number;
}

export interface PlatformAnalytics {
  // Network inventory
  totalNetworkKm:          number;
  pavedKm:                 number;
  unsealedKm:              number;
  percentPaved:            number;
  regionPavedKm:           Record<string, number>;

  // Traffic
  trafficYears:            TrafficYearSummary[];
  regionTraffic2025:       RegionTraffic[];
  trafficGrowth:           { from_year: number; to_year: number; motorised_aadt_growth_pct: number }[];

  // Condition (official indicators)
  pavedFairToGoodPct:      number;
  unpavedFairToGoodPct:    number;

  // Paved stock growth
  wtssTimeline:            WtssRecord[];

  // Projects
  activeProjects:          number;
  projectsKm:              number;
  upgradedKm:              number;

  // Bridges summary
  bridgeCount:             number;
  culvertCount:            number;
}

export async function loadPlatformAnalytics(): Promise<PlatformAnalytics> {
  if (analyticsCache) return analyticsCache;

  const res  = await fetch('/analytics.json');
  const data = await res.json();

  const { excel_analytics, traffic_year_summary, wtss_2015_2023, dashboard_snapshot } = data;

  const inv = excel_analytics?.inventory_context ?? {};
  const ds  = dashboard_snapshot?.official_public_snapshot ?? {};
  const tys = Array.isArray(traffic_year_summary) ? traffic_year_summary : [];
  const wtss = Array.isArray(wtss_2015_2023) ? wtss_2015_2023 : [];
  const regionTraffic2025: RegionTraffic[] =
    excel_analytics?.traffic?.latest_region_summary_2025 ?? [];
  const trafficGrowth =
    excel_analytics?.traffic?.growth_summary ?? [];

  analyticsCache = {
    totalNetworkKm:     inv.total_network_length_km   ?? 21291.541,
    pavedKm:            inv.paved_inventory_length_km  ?? 6312.098,
    unsealedKm:         (inv.total_network_length_km ?? 21291.541) - (inv.paved_inventory_length_km ?? 6312.098),
    percentPaved:       ((inv.paved_inventory_length_km ?? 6312.098) / (inv.total_network_length_km ?? 21291.541)) * 100,
    regionPavedKm:      inv.paved_inventory_region_length_km ?? {},
    trafficYears:       tys.map((t: Record<string, unknown>) => ({
      year:                               Number(t.year),
      covered_length_km:                  Number(t.covered_length_km),
      observed_links:                     Number(t.observed_links),
      network_weighted_motorised_aadt:    Number(t.network_weighted_motorised_aadt),
      network_weighted_non_motorised_aadt: Number(t.network_weighted_non_motorised_aadt),
      total_vehicle_km:                   Number(t.total_vehicle_km),
    })),
    regionTraffic2025,
    trafficGrowth,
    pavedFairToGoodPct:   ds.paved_roads_fair_to_good_pct   ?? 94.2,
    unpavedFairToGoodPct: ds.unpaved_roads_fair_to_good_pct ?? 62.0,
    wtssTimeline: wtss.map((w: Record<string, unknown>) => ({
      ndp:                   String(w.ndp ?? ''),
      financial_year:        String(w.financial_year ?? ''),
      annual_increase_km:    Number(w.annual_increase_km),
      stock_of_paved_roads_km: Number(w.stock_of_paved_roads_km),
      percent_paved_network: Number(w.percent_paved_network),
    })),
    activeProjects: ds.current_delivery_progress_2024_25?.road_development_projects_active  ?? 26,
    projectsKm:    ds.current_delivery_progress_2024_25?.road_development_projects_total_distance_km ?? 1383.76,
    upgradedKm:    ds.current_delivery_progress_2024_25?.upgraded_to_paved_bituminous_km_equivalent ?? 122.43,
    bridgeCount:   excel_analytics?.bridges?.total_bridges  ?? 446,
    culvertCount:  excel_analytics?.bridges?.total_culverts ?? 294,
  };

  return analyticsCache;
}

export async function loadProjects(): Promise<OngoingProject[]> {
  if (projectsCache) return projectsCache;

  const res  = await fetch('/projects.json');
  const raw  = await res.json() as Record<string, string>[];

  projectsCache = raw.map(r => ({
    project_name:          r.project_name ?? '',
    funding_agency:        r.funding_agency ?? '',
    location:              r.location ?? '',
    regions:               r.regions ?? '',
    parsed_length_km:      parseFloat(r.parsed_length_km) || 0,
    planned_progress_pct:  r.planned_progress_pct !== '' ? parseFloat(r.planned_progress_pct) : null,
    actual_progress_pct:   r.actual_progress_pct  !== '' ? parseFloat(r.actual_progress_pct)  : null,
    financial_progress_pct: r.financial_progress_pct !== '' ? parseFloat(r.financial_progress_pct) : null,
    target_completion_date: r.target_completion_date ?? '',
    contractor:            r.contractor ?? '',
    supervisor:            r.supervisor ?? '',
    behind_schedule:       r.behind_schedule === 'True' || r.behind_schedule === 'true',
  }));

  return projectsCache;
}
