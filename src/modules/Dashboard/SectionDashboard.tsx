/**
 * SectionDashboard — Dynamic Supabase-connected dashboard panel.
 *
 * Serves as the first "Dashboard" sub-tab in every section across all platforms.
 * ALL metrics, labels, and chart data come from Supabase — zero hardcoded values.
 * Styling matches the "network story" dark-neon theme used throughout NRMS.
 *
 * Props:
 *   sectionId  — matches the sidebar view id (e.g. 'rms', 'bms', 'traffic')
 *   accent     — optional override for the accent colour
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  LayoutDashboard, RefreshCw, TrendingUp, Database,
  Activity, Gauge, Route, Layers, Network, Building2,
  Hammer, Search, DollarSign, Clock, FolderOpen, Map,
  ClipboardCheck, Wrench, Globe, Shield,
} from 'lucide-react';

// ── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:     '#020202',
  panel:  'rgba(6,12,20,0.96)',
  border: 'rgba(0,245,255,0.12)',
  cyan:   '#00f5ff',
  green:  '#00ff88',
  orange: '#ff6600',
  pink:   '#ff006e',
  yellow: '#ffee00',
  blue:   '#4d9fff',
  purple: '#a855f7',
  dim:    'rgba(148,163,184,0.6)',
  text:   '#e2eaf4',
} as const;

// ── Icon map ─────────────────────────────────────────────────────────────────
const ICONS: Record<string, React.ReactNode> = {
  Route:         <Route size={15} />,
  Layers:        <Layers size={15} />,
  Network:       <Network size={15} />,
  Building2:     <Building2 size={15} />,
  Hammer:        <Hammer size={15} />,
  Search:        <Search size={15} />,
  DollarSign:    <DollarSign size={15} />,
  Clock:         <Clock size={15} />,
  FolderOpen:    <FolderOpen size={15} />,
  Map:           <Map size={15} />,
  ClipboardCheck:<ClipboardCheck size={15} />,
  Wrench:        <Wrench size={15} />,
  Globe:         <Globe size={15} />,
  Shield:        <Shield size={15} />,
  Gauge:         <Gauge size={15} />,
  BarChart3:     <TrendingUp size={15} />,
  Activity:      <Activity size={15} />,
  Database:      <Database size={15} />,
};

// ── Type definitions ─────────────────────────────────────────────────────────
interface KpiConfig {
  label: string;
  table: string;
  column?: string;
  filter?: Record<string, string | number | boolean>;
  agg: 'count' | 'sum' | 'avg' | 'max';
  unit?: string;
  color: string;
  icon: string;
}

interface ChartConfig {
  title: string;
  table: string;
  groupBy: string;
  limit?: number;
}

interface SectionConf {
  subtitle: string;
  accent: string;
  kpis: KpiConfig[];
  chart?: ChartConfig;
}

// ── Section configurations ────────────────────────────────────────────────────
// One entry per sectionId — drives KPI cards and optional bar chart
// ALL values come from Supabase; no figures hardcoded here.
const SECTION_CONFIG: Record<string, SectionConf> = {
  rms: {
    subtitle: 'Road Management System',
    accent: C.cyan,
    kpis: [
      { label: 'Road Links',       table: 'road_links',            agg: 'count', color: C.cyan,   icon: 'Route'     },
      { label: 'Total km',         table: 'road_links', column: 'length_km', agg: 'sum', unit: ' km', color: C.green, icon: 'Map' },
      { label: 'Structures',       table: 'structures',            agg: 'count', color: C.orange, icon: 'Network'   },
      { label: 'Active Projects',  table: 'projects',              agg: 'count', color: C.yellow, icon: 'FolderOpen' },
    ],
    chart: { title: 'Road Links by Region', table: 'road_links', groupBy: 'region', limit: 10 },
  },
  pms: {
    subtitle: 'Pavement Management System',
    accent: C.orange,
    kpis: [
      { label: 'Road Sections',   table: 'road_links',            agg: 'count', color: C.orange, icon: 'Layers'        },
      { label: 'Inspections',     table: 'inspections',           agg: 'count', color: C.green,  icon: 'ClipboardCheck' },
      { label: 'Maint. Works',    table: 'maintenance_programme', agg: 'count', color: C.cyan,   icon: 'Wrench'        },
      { label: 'Projects',        table: 'projects',              agg: 'count', color: C.yellow, icon: 'FolderOpen'    },
    ],
    chart: { title: 'Maintenance Works by Type', table: 'maintenance_programme', groupBy: 'category', limit: 8 },
  },
  roadcondition: {
    subtitle: 'Pavement & Road Condition',
    accent: C.orange,
    kpis: [
      { label: 'Road Links',      table: 'road_links',            agg: 'count', color: C.orange, icon: 'Route'         },
      { label: 'Inspections',     table: 'inspections',           agg: 'count', color: C.green,  icon: 'ClipboardCheck' },
      { label: 'Maint. Works',    table: 'maintenance_programme', agg: 'count', color: C.cyan,   icon: 'Wrench'        },
    ],
    chart: { title: 'Inspections by Rating', table: 'inspections', groupBy: 'condition_rating', limit: 8 },
  },
  bms: {
    subtitle: 'Bridge Management System',
    accent: C.blue,
    kpis: [
      { label: 'Structures',      table: 'structures',            agg: 'count', color: C.blue,   icon: 'Network'       },
      { label: 'Inspections',     table: 'inspections',           agg: 'count', color: C.green,  icon: 'Search'        },
      { label: 'Bridge Works',    table: 'maintenance_programme', agg: 'count', color: C.pink,   icon: 'Hammer'        },
      { label: 'Projects',        table: 'projects',              agg: 'count', color: C.yellow, icon: 'FolderOpen'    },
    ],
    chart: { title: 'Structures by Type', table: 'structures', groupBy: 'structure_type', limit: 8 },
  },
  traffic: {
    subtitle: 'Traffic Information System',
    accent: C.cyan,
    kpis: [
      { label: 'ATC Stations',    table: 'atc_stations',  agg: 'count',                            color: C.cyan,   icon: 'Gauge'    },
      { label: 'Active Stations', table: 'atc_stations',  agg: 'count', filter: { status: 'Active' }, color: C.green, icon: 'Activity' },
      { label: 'Count Records',   table: 'traffic_counts', agg: 'count',                           color: C.orange, icon: 'BarChart3' },
    ],
    chart: { title: 'Stations by Region', table: 'atc_stations', groupBy: 'region', limit: 10 },
  },
  atc: {
    subtitle: 'Automatic Traffic Counter System',
    accent: C.orange,
    kpis: [
      { label: 'Total Stations',  table: 'atc_stations',  agg: 'count',                            color: C.orange, icon: 'Gauge'     },
      { label: 'Active',          table: 'atc_stations',  agg: 'count', filter: { status: 'Active' }, color: C.green, icon: 'Activity'  },
      { label: 'Count Records',   table: 'traffic_counts', agg: 'count',                           color: C.cyan,   icon: 'BarChart3' },
    ],
    chart: { title: 'Stations by County', table: 'atc_stations', groupBy: 'county', limit: 12 },
  },
  ntis: {
    subtitle: 'National Transport Information System',
    accent: C.cyan,
    kpis: [
      { label: 'ATC Stations',    table: 'atc_stations',   agg: 'count', color: C.cyan,   icon: 'Gauge'     },
      { label: 'Traffic Records', table: 'traffic_counts', agg: 'count', color: C.green,  icon: 'Activity'  },
      { label: 'Road Links',      table: 'road_links',     agg: 'count', color: C.orange, icon: 'Route'     },
    ],
    chart: { title: 'Traffic Stations by Region', table: 'atc_stations', groupBy: 'region', limit: 10 },
  },
  npms: {
    subtitle: 'National Pavement Management System',
    accent: C.orange,
    kpis: [
      { label: 'Road Sections',   table: 'road_links',            agg: 'count', color: C.orange, icon: 'Layers'        },
      { label: 'Inspections',     table: 'inspections',           agg: 'count', color: C.green,  icon: 'ClipboardCheck' },
      { label: 'Maint. Works',    table: 'maintenance_programme', agg: 'count', color: C.cyan,   icon: 'Wrench'        },
      { label: 'Projects',        table: 'projects',              agg: 'count', color: C.yellow, icon: 'FolderOpen'    },
    ],
    chart: { title: 'Works by Category', table: 'maintenance_programme', groupBy: 'category', limit: 8 },
  },
  nbms: {
    subtitle: 'National Bridge Management System',
    accent: C.blue,
    kpis: [
      { label: 'Bridge Inventory', table: 'structures',            agg: 'count', color: C.blue,   icon: 'Network'  },
      { label: 'Inspections',      table: 'inspections',           agg: 'count', color: C.green,  icon: 'Search'   },
      { label: 'Bridge Works',     table: 'maintenance_programme', agg: 'count', color: C.pink,   icon: 'Hammer'   },
    ],
    chart: { title: 'Structures by Type', table: 'structures', groupBy: 'structure_type', limit: 8 },
  },
  network: {
    subtitle: 'Network Overview',
    accent: C.cyan,
    kpis: [
      { label: 'Road Links',      table: 'road_links',    agg: 'count', color: C.cyan,   icon: 'Route'     },
      { label: 'Structures',      table: 'structures',    agg: 'count', color: C.blue,   icon: 'Building2' },
      { label: 'ATC Stations',    table: 'atc_stations',  agg: 'count', color: C.orange, icon: 'Gauge'     },
      { label: 'Projects',        table: 'projects',      agg: 'count', color: C.yellow, icon: 'FolderOpen' },
    ],
    chart: { title: 'Traffic Stations by Region', table: 'atc_stations', groupBy: 'region', limit: 10 },
  },
  roadreserve: {
    subtitle: 'Road Reserve Management',
    accent: C.green,
    kpis: [
      { label: 'Road Links',      table: 'road_links',   agg: 'count', color: C.green,  icon: 'Route'         },
      { label: 'Structures',      table: 'structures',   agg: 'count', color: C.blue,   icon: 'Building2'     },
      { label: 'Inspections',     table: 'inspections',  agg: 'count', color: C.cyan,   icon: 'ClipboardCheck' },
    ],
    chart: { title: 'Road Links by Region', table: 'road_links', groupBy: 'region', limit: 10 },
  },
  gisenterprise: {
    subtitle: 'GIS Enterprise Platform',
    accent: C.purple,
    kpis: [
      { label: 'Road Links',      table: 'road_links',    agg: 'count', color: C.purple, icon: 'Layers'    },
      { label: 'Structures',      table: 'structures',    agg: 'count', color: C.blue,   icon: 'Building2' },
      { label: 'ATC Stations',    table: 'atc_stations',  agg: 'count', color: C.orange, icon: 'Gauge'     },
    ],
    chart: { title: 'Network by Region', table: 'road_links', groupBy: 'region', limit: 10 },
  },
  bridgeworks: {
    subtitle: 'Bridge Works Programme',
    accent: C.blue,
    kpis: [
      { label: 'Structures',      table: 'structures',            agg: 'count', color: C.blue,   icon: 'Network'  },
      { label: 'Works Items',     table: 'maintenance_programme', agg: 'count', color: C.green,  icon: 'Hammer'   },
      { label: 'Inspections',     table: 'inspections',           agg: 'count', color: C.cyan,   icon: 'Search'   },
    ],
    chart: { title: 'Works by Category', table: 'maintenance_programme', groupBy: 'category', limit: 8 },
  },
  pim: {
    subtitle: 'Public Investment Management',
    accent: C.yellow,
    kpis: [
      { label: 'Projects',        table: 'projects',              agg: 'count', color: C.yellow, icon: 'Building2' },
      { label: 'Road Links',      table: 'road_links',            agg: 'count', color: C.cyan,   icon: 'Route'     },
      { label: 'Works Items',     table: 'maintenance_programme', agg: 'count', color: C.orange, icon: 'Wrench'    },
    ],
    chart: { title: 'Projects by Phase', table: 'projects', groupBy: 'phase', limit: 10 },
  },
  budget: {
    subtitle: 'Budget & Financial Management',
    accent: C.yellow,
    kpis: [
      { label: 'Projects',        table: 'projects',              agg: 'count', color: C.yellow, icon: 'DollarSign' },
      { label: 'Maint. Works',    table: 'maintenance_programme', agg: 'count', color: C.orange, icon: 'Wrench'     },
      { label: 'Road Links',      table: 'road_links',            agg: 'count', color: C.cyan,   icon: 'Route'      },
    ],
    chart: { title: 'Projects by Phase', table: 'projects', groupBy: 'phase', limit: 10 },
  },
  lifecycle: {
    subtitle: 'Life Cycle Management',
    accent: C.green,
    kpis: [
      { label: 'Road Links',      table: 'road_links',            agg: 'count', color: C.green,  icon: 'Clock'    },
      { label: 'Structures',      table: 'structures',            agg: 'count', color: C.blue,   icon: 'Building2' },
      { label: 'Works Items',     table: 'maintenance_programme', agg: 'count', color: C.orange, icon: 'Wrench'   },
    ],
    chart: { title: 'Road Links by Region', table: 'road_links', groupBy: 'region', limit: 10 },
  },
  roadatlas: {
    subtitle: 'Road Atlas',
    accent: C.cyan,
    kpis: [
      { label: 'Road Links',      table: 'road_links',   agg: 'count', color: C.cyan,   icon: 'Map'       },
      { label: 'Structures',      table: 'structures',   agg: 'count', color: C.blue,   icon: 'Building2' },
      { label: 'ATC Stations',    table: 'atc_stations', agg: 'count', color: C.orange, icon: 'Gauge'     },
    ],
    chart: { title: 'Road Links by Region', table: 'road_links', groupBy: 'region', limit: 10 },
  },
  roadvideo: {
    subtitle: 'Road Video Survey',
    accent: C.cyan,
    kpis: [
      { label: 'Road Links',      table: 'road_links',   agg: 'count', color: C.cyan,   icon: 'Route'    },
      { label: 'Inspections',     table: 'inspections',  agg: 'count', color: C.green,  icon: 'Search'   },
    ],
    chart: { title: 'Road Links by Region', table: 'road_links', groupBy: 'region', limit: 10 },
  },
  projects: {
    subtitle: 'Road Projects Tracker',
    accent: C.yellow,
    kpis: [
      { label: 'Total Projects',  table: 'projects',   agg: 'count', color: C.yellow, icon: 'FolderOpen' },
      { label: 'Road Links',      table: 'road_links', agg: 'count', color: C.cyan,   icon: 'Route'      },
    ],
    chart: { title: 'Projects by Phase', table: 'projects', groupBy: 'phase', limit: 10 },
  },
  casestudies: {
    subtitle: 'Global Case Studies',
    accent: C.cyan,
    kpis: [
      { label: 'Road Links',      table: 'road_links',   agg: 'count', color: C.cyan,   icon: 'Globe'     },
      { label: 'ATC Stations',    table: 'atc_stations', agg: 'count', color: C.orange, icon: 'Gauge'     },
    ],
  },
  admin: {
    subtitle: 'Admin Tools',
    accent: C.cyan,
    kpis: [
      { label: 'Road Links',      table: 'road_links',    agg: 'count', color: C.cyan,   icon: 'Database'  },
      { label: 'ATC Stations',    table: 'atc_stations',  agg: 'count', color: C.green,  icon: 'Gauge'     },
      { label: 'Traffic Records', table: 'traffic_counts', agg: 'count', color: C.orange, icon: 'Activity' },
      { label: 'Structures',      table: 'structures',    agg: 'count', color: C.blue,   icon: 'Network'   },
    ],
    chart: { title: 'Network Stats by Region', table: 'atc_stations', groupBy: 'region', limit: 10 },
  },
  hdm4: {
    subtitle: 'HDM-4 Analysis',
    accent: C.orange,
    kpis: [
      { label: 'Road Links',      table: 'road_links',            agg: 'count', color: C.orange, icon: 'Route'    },
      { label: 'Maint. Works',    table: 'maintenance_programme', agg: 'count', color: C.cyan,   icon: 'Wrench'   },
    ],
  },
};

const DEFAULT_CONF: SectionConf = {
  subtitle: 'Section Overview',
  accent: C.cyan,
  kpis: [
    { label: 'Road Links',      table: 'road_links',     agg: 'count', color: C.cyan,   icon: 'Route'     },
    { label: 'ATC Stations',    table: 'atc_stations',   agg: 'count', color: C.green,  icon: 'Gauge'     },
    { label: 'Traffic Records', table: 'traffic_counts', agg: 'count', color: C.orange, icon: 'BarChart3' },
    { label: 'Structures',      table: 'structures',     agg: 'count', color: C.yellow, icon: 'Building2' },
  ],
  chart: { title: 'Traffic Stations by Region', table: 'atc_stations', groupBy: 'region', limit: 10 },
};

// ── Types for runtime data ───────────────────────────────────────────────────
interface KpiResult { label: string; value: number | string; color: string; unit: string; icon: string }
interface ChartRow  { label: string; value: number }

// ── Tooltip for bar chart ────────────────────────────────────────────────────
function NeonTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(2,6,14,0.97)', border: `1px solid ${C.border}`,
      padding: '6px 10px', borderRadius: 6, fontSize: 11, color: C.text,
    }}>
      <div style={{ color: C.dim, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: C.cyan }}>{payload[0].value}</div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function SectionDashboard({
  sectionId,
  accent: accentProp,
}: {
  sectionId: string;
  accent?: string;
}) {
  const conf = SECTION_CONFIG[sectionId] ?? DEFAULT_CONF;
  const accent = accentProp ?? conf.accent;

  const [kpis,      setKpis]      = useState<KpiResult[]>([]);
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [tick,      setTick]      = useState(0); // refresh trigger

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ── KPI fetches ─────────────────────────────────────────────────────
      const kpiResults = await Promise.all(conf.kpis.map(async (k): Promise<KpiResult> => {
        try {
          if (k.agg === 'count') {
            let q = supabase.from(k.table).select('*', { count: 'exact', head: true });
            if (k.filter) {
              for (const [col, val] of Object.entries(k.filter)) q = q.eq(col, val);
            }
            const { count, error } = await q;
            if (error) throw error;
            return { label: k.label, value: count ?? 0, color: k.color, unit: k.unit ?? '', icon: k.icon };
          }

          if (k.agg === 'sum' && k.column) {
            const { data, error } = await supabase.from(k.table).select(k.column).limit(5000);
            if (error) throw error;
            const total = (data ?? []).reduce((s, r) => s + (Number(r[k.column!]) || 0), 0);
            return { label: k.label, value: Math.round(total * 10) / 10, color: k.color, unit: k.unit ?? '', icon: k.icon };
          }

          if (k.agg === 'avg' && k.column) {
            const { data, error } = await supabase.from(k.table).select(k.column).limit(5000);
            if (error) throw error;
            const arr = (data ?? []).map(r => Number(r[k.column!]) || 0).filter(v => v > 0);
            const avg = arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 10) / 10 : 0;
            return { label: k.label, value: avg, color: k.color, unit: k.unit ?? '', icon: k.icon };
          }

          return { label: k.label, value: '—', color: k.color, unit: k.unit ?? '', icon: k.icon };
        } catch {
          return { label: k.label, value: '—', color: k.color, unit: k.unit ?? '', icon: k.icon };
        }
      }));

      // ── Chart fetch ─────────────────────────────────────────────────────
      let chart: ChartRow[] = [];
      if (conf.chart) {
        const { data } = await supabase
          .from(conf.chart.table)
          .select(conf.chart.groupBy)
          .limit(conf.chart.limit ?? 500);

        if (data && data.length > 0) {
          const grouped: Record<string, number> = {};
          for (const row of data) {
            const key = String(row[conf.chart.groupBy] ?? 'Unknown');
            grouped[key] = (grouped[key] ?? 0) + 1;
          }
          chart = Object.entries(grouped)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, conf.chart.limit ?? 10);
        }
      }

      setKpis(kpiResults);
      setChartData(chart);
      setFetchedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [sectionId, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── Bar colours cycling accent shades ────────────────────────────────────
  const barColors = [accent, C.green, C.orange, C.blue, C.pink, C.yellow, C.purple, C.cyan];

  return (
    <div style={{
      minHeight: '100%',
      background: C.bg,
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      padding: '18px 20px 24px',
      overflowY: 'auto',
    }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 20, gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: `${accent}18`,
            border: `1px solid ${accent}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accent, flexShrink: 0,
          }}>
            <LayoutDashboard size={17} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
              Dashboard
            </div>
            <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>
              {conf.subtitle} · Live from Supabase
            </div>
          </div>
        </div>

        <button
          onClick={() => setTick(t => t + 1)}
          disabled={loading}
          title="Refresh"
          style={{
            background: 'none', border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
            color: loading ? C.dim : accent, display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontWeight: 600, transition: 'all 0.15s',
          }}
        >
          <RefreshCw size={11} style={{ animation: loading ? 'dash-spin 1s linear infinite' : 'none' }} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: 'rgba(255,0,110,0.08)', border: '1px solid rgba(255,0,110,0.25)',
          borderRadius: 8, padding: '10px 14px', fontSize: 11, color: C.pink, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(160px, 1fr))`,
        gap: 10, marginBottom: 20,
      }}>
        {loading && conf.kpis.map((k, i) => (
          <div key={i} style={{
            background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '14px 16px', minHeight: 80,
            animation: 'dash-pulse 1.5s ease-in-out infinite',
          }} />
        ))}

        {!loading && kpis.map((kpi, i) => (
          <div key={i} style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${kpi.color}`,
            borderRadius: 10, padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 8,
            transition: 'border-color 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: kpi.color, opacity: 0.85 }}>{ICONS[kpi.icon]}</span>
              <span style={{ fontSize: 10, color: C.dim, fontWeight: 500, letterSpacing: '0.04em' }}>
                {kpi.label}
              </span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: kpi.color, lineHeight: 1 }}>
              {kpi.value === '—' ? (
                <span style={{ fontSize: 18, color: C.dim }}>—</span>
              ) : (
                <>
                  {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
                  {kpi.unit && <span style={{ fontSize: 13, color: `${kpi.color}99`, marginLeft: 2 }}>{kpi.unit}</span>}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Bar Chart ───────────────────────────────────────────────────── */}
      {conf.chart && !loading && chartData.length > 0 && (
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: '16px 18px', marginBottom: 16,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: accent,
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
          }}>
            {conf.chart.title}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 0, right: 4, bottom: 24, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: C.dim, fontSize: 9 }}
                axisLine={{ stroke: C.border }}
                tickLine={false}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fill: C.dim, fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<NeonTooltip />} cursor={{ fill: `${accent}08` }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={barColors[idx % barColors.length]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Empty state (all KPIs are 0 or '—') ────────────────────────── */}
      {!loading && !error && kpis.length > 0 && kpis.every(k => k.value === 0 || k.value === '—') && (
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: '28px 24px', textAlign: 'center',
          color: C.dim, fontSize: 11,
        }}>
          <Database size={22} style={{ color: accent, opacity: 0.5, marginBottom: 10 }} />
          <div style={{ fontWeight: 700, marginBottom: 6, color: C.text }}>No data yet</div>
          <div>
            Connect and populate your Supabase tables to see live metrics here.
          </div>
          {fetchedAt && (
            <div style={{ marginTop: 12, fontSize: 9, color: C.dim }}>
              Last checked {fetchedAt.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      {fetchedAt && !loading && (
        <div style={{ fontSize: 9, color: C.dim, marginTop: 8 }}>
          Data fetched from Supabase · {fetchedAt.toLocaleTimeString()} ·{' '}
          <span style={{ color: accent }}>project vbidhkvzjigatfygnycg</span>
        </div>
      )}

      <style>{`
        @keyframes dash-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes dash-pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
