import { useCallback, useEffect, useState } from 'react';

// Types for the Road Network dashboard bundle (served by local backend or static JSON)
export interface DashboardBundle {
  dashboardManifest?:      { generatedAt?: string };
  roadNetworkIntelligence?: {
    generatedAt?: string;
    forecast?: Record<string, unknown>;
    networkComparison?: Record<string, unknown>;
    regionIntelligence?: RegionIntelligence[];
    signalCards?: unknown[];
    queryFindings?: unknown[];
    stationMachineLearning?: { anomalies?: unknown[] };
  };
  roadPublicReferences?: {
    paved_stock_timeline?: PavedStockRow[];
  };
  assetValueUpdate?: {
    rows?: AssetValueRow[];
    latest?: AssetValueRow;
  };
  roadExcelAnalytics?: {
    traffic?: { year_summary?: TrafficYearRow[] };
    paved_condition?: { cycles?: ConditionCycle[] };
    bridges?: { top_corridors?: BridgeCorridor[] };
    ongoing_projects?: { nearest_target_completion_dates?: ProjectRow[] };
  };
  structureDigitalTwin?: {
    assets?: DigitalTwinAsset[];
    features?: GeoFeature[];
    summary?: {
      assetCount?: number;
      bridgeCount?: number;
      culvertCount?: number;
      regions?: { label: string; count: number }[];
    };
  };
  spatialCatalog?: { entries?: CatalogEntry[] };
  roadFrontendSummary?: Record<string, unknown>;
  manualIntelligence?: Record<string, unknown>;
  assetManagementEngine?: {
    assetComponents?: AssetComponent[];
    frontendCoverage?: unknown[];
    generatedAt?: string;
  };
}

export interface RegionIntelligence {
  region: string;
  averageObservedAdt?: number;
  weightedAverageVci?: number;
  projects?: number;
  stressScore?: number;
}
export interface PavedStockRow {
  financial_year?: string;
  stock_paved_roads_km?: number;
  percent_paved_network?: number;
  annual_increase_km?: number;
  ndp?: string;
}
export interface AssetValueRow {
  fy?: string;
  crcBillionUgx?: number;
  cdrcBillionUgx?: number;
  valueGapBillionUgx?: number;
  lengthKm?: number;
  averageConditionPct?: number;
}
export interface TrafficYearRow {
  year?: number;
  network_weighted_motorised_aadt?: number;
  observed_links?: number;
  total_vehicle_km?: number;
}
export interface ConditionCycle {
  summary?: {
    cycle?: string;
    weighted_average_vci?: number;
    weighted_average_roughness?: number;
    weighted_average_rutting?: number;
    survey_coverage_pct_of_inventory?: number;
  };
}
export interface BridgeCorridor {
  principal_road_name?: string;
  principal_link_id?: string;
  bridge_count?: number;
  total_bridge_length_m?: number;
}
export interface ProjectRow {
  project_name?: string;
  planned_progress_pct?: number;
  actual_progress_pct?: number;
  financial_progress_pct?: number;
  target_completion_date?: string;
  behind_schedule?: boolean;
}
export interface DigitalTwinAsset {
  assetId: string;
  title?: string;
  structureId?: string;
  assetType?: string;
  geometry?: { latitude?: number; longitude?: number };
  currentSnapshot?: { year?: number };
  history?: { year?: number }[];
  roadContext?: { linkName?: string; roadNo?: string; maintenanceRegion?: string };
  photoGallery?: { previewUrl?: string; count?: number };
}
export interface GeoFeature {
  geometry?: { coordinates?: [number, number] };
  properties: {
    assetType?: string;
    title?: string;
    structureId?: string;
    photoCount?: number;
    historyCount?: number;
  };
}
export interface CatalogEntry {
  name?: string;
  kind?: string;
  themeLabel?: string;
  sourceLabel?: string;
  servedRelativePath?: string;
}
export interface AssetComponent {
  key: string;
  label: string;
}
export interface PlatformHealth { status?: string }
export interface DatabaseHealth { status?: string }

// ─────────────────────────────────────────────────────────────────────────────

interface BundleState {
  bundle: DashboardBundle | null;
  platformHealth: PlatformHealth | null;
  dbHealth: DatabaseHealth | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const INITIAL: BundleState = {
  bundle: null, platformHealth: null, dbHealth: null,
  isLoading: true, error: null, lastUpdated: null,
};

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json() as T;
  } catch {
    return null;
  }
}

/**
 * Loads the Road Network dashboard bundle.
 * Priority order:
 *   1. Live API at /api/dashboard-bundle (available when local backend is running)
 *   2. Static fallback at /data/bundle.json (always available on GitHub Pages)
 */
export function useDashboardBundle(pollIntervalMs = 120_000) {
  const [state, setState] = useState<BundleState>(INITIAL);

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, isLoading: !s.bundle, error: null }));
    try {
      // Try live API first — available in local dev or with a backend
      let bundle = await safeFetch<DashboardBundle>('/api/dashboard-bundle');
      let health = await safeFetch<PlatformHealth>('/api/platform/health');

      // Fallback to static bundle for GitHub Pages / offline
      if (!bundle) {
        bundle = await safeFetch<DashboardBundle>('/data/bundle.json');
      }

      setState({
        bundle: bundle ?? null,
        platformHealth: health ?? { status: bundle ? 'static' : 'offline' },
        dbHealth: null,
        isLoading: false,
        error: bundle ? null : 'Running in offline mode — live data unavailable.',
        lastUpdated: bundle
          ? (bundle.dashboardManifest?.generatedAt ??
             bundle.roadNetworkIntelligence?.generatedAt ??
             new Date().toISOString())
          : new Date().toISOString(),
      });
    } catch (err) {
      setState(s => ({
        ...s, isLoading: false,
        error: err instanceof Error ? err.message : 'Unable to load bundle.',
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), pollIntervalMs);
    return () => clearInterval(timer);
  }, [pollIntervalMs, refresh]);

  return { ...state, refresh };
}
