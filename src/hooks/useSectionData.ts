import { fetchJson } from '../utils/fetchCache';
import { useState, useEffect } from 'react';

interface SectionData {
  networkSummary: any | null;
  regionalPerformance: any[] | null;
  mlMetrics: any | null;
  budgetAlignment: any[] | null;
  infrastructureCoverage: any[] | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to load all section data from exported JSON files
 * Ensures all components use database-driven data instead of hardcoded values
 */
export const useSectionData = (): SectionData => {
  const [data, setData] = useState<SectionData>({
    networkSummary: null,
    regionalPerformance: null,
    mlMetrics: null,
    budgetAlignment: null,
    infrastructureCoverage: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [summary, regional, ml, budget, infrastructure] = await Promise.all([
          fetchJson(`${import.meta.env.BASE_URL}data/network_summary.json`),
          fetchJson(`${import.meta.env.BASE_URL}data/regional_performance.json`),
          fetchJson(`${import.meta.env.BASE_URL}data/ml_model_metrics.json`),
          fetchJson(`${import.meta.env.BASE_URL}data/budget_alignment.json`),
          fetchJson(`${import.meta.env.BASE_URL}data/infrastructure_coverage.json`),
        ]);

        setData({
          networkSummary: summary,
          regionalPerformance: regional,
          mlMetrics: ml,
          budgetAlignment: budget,
          infrastructureCoverage: infrastructure,
          loading: false,
          error: null,
        });
      } catch (err) {
        setData((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load section data',
        }));
      }
    };

    loadData();
  }, []);

  return data;
};

/**
 * Hook to load regional analytics
 */
export const useRegionalAnalytics = () => {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/regional_analytics.json`)
      .then(r => r.json())
      .then(setData)
      .catch((err) => {
        console.error('Error loading regional analytics:', err);
        setData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
};
