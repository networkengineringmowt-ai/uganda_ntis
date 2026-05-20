import { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
  Cell, ReferenceLine, PieChart, Pie,
} from 'recharts';
import {
  Activity, CheckCircle2, AlertTriangle, Camera, Filter,
  TrendingUp, DollarSign, MapPin, Zap,
} from 'lucide-react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { GeoJsonObject, Feature, Geometry } from 'geojson';
import type { Layer, PathOptions } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { loadPlatformAnalytics, type PlatformAnalytics } from '../../data/platformData';
import {
  NEON, REGION_NEON, Bar3D, Chart3DWrap, AreaGradDefs, TT_NEON, TICK,
} from '../../lib/chart3d';

const BASE = import.meta.env.BASE_URL;

// ─── Types ────────────────────────────────────────────────────────────────────
interface ImageDefectSummary {
  model: string; images_processed: number;
  defect_distribution: Record<string, number>;
  severity_distribution: Record<string, number>;
  top_damaged_links: Array<{
    link_id: string; dominant_defect: string; image_count: number; avg_severity: string;
  }>;
}
interface PavementImage {
  image_path: string; filename: string; folder: string; link_id: string | null;
  defect_type: string; confidence: number; severity: string; area_pct: number;
}
interface CondBand {
  good_pct: number; fair_pct: number; poor_pct: number; very_poor_pct: number;
}
interface CurvePt { year: number; avg_iri: number; ci_low: number; ci_high: number }
interface BudgetPt {
  year: number; routine_usd: number; reseal_usd: number; overlay_usd: number;
  rehab_usd: number; reconstruct_usd: number; regravelling_usd: number; total_usd: number;
}
interface TriggerItem {
  link_id: string; road_name: string; region: string; road_class: string;
  surface_cat: string; trigger_year: number; treatment: string;
  iri: number; length_km: number; total_cost_usd: number;
  priority_score: number; urgency: 'now' | 'urgent' | 'soon' | 'planned';
}
interface DetSummary {
  model_type: string; r_squared: number; links_projected: number;
  projection_period: string; generated_at: string;
  network_condition_2024: CondBand; network_condition_2030: CondBand;
  class_deterioration_curves: Record<string, CurvePt[]>;
  intervention_schedule: TriggerItem[];
  budget_schedule_2024_2030: BudgetPt[];
  total_maintenance_budget_2024_2030_usd: number;
  intervention_thresholds_iri: Record<string, number>;
  unit_costs_usd_per_km: Record<string, number>;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT = '#6366f1';
const BG_CARD = 'rgba(15,23,42,0.55)';
const CLASS_COLORS: Record<string, string> = {
  A: '#00f5ff', B: '#00ff88', C: '#ffd23f', M: '#b967ff',
};
const URGENCY_COLOR: Record<string, string> = {
  now: '#ff2d78', urgent: '#ff6b35', soon: '#ffd23f', planned: '#00ff88',
};
const DEFECT_COLOR: Record<string, string> = {
  pothole: '#ff2d78', alligator_crack: '#ff6b35', longitudinal_crack: '#ffd23f',
  transverse_crack: '#ffd23f', rutting: '#ff9500', raveling: '#94a3b8', good: '#00ff88',
};
const DEFECT_LABEL: Record<string, string> = {
  pothole: 'Pothole', alligator_crack: 'Alligator Crack', longitudinal_crack: 'Long. Crack',
  transverse_crack: 'Trans. Crack', rutting: 'Rutting', raveling: 'Raveling', good: 'Good',
};
type FilterKey = 'all' | 'pothole' | 'crack' | 'rutting' | 'raveling' | 'good';
const FILTER_PILLS: Array<{ key: FilterKey; label: string; color: string }> = [
  { key: 'all', label: 'All', color: '#00f5ff' },
  { key: 'pothole', label: 'Pothole', color: '#ff2d78' },
  { key: 'crack', label: 'Crack', color: '#ffd23f' },
  { key: 'rutting', label: 'Rutting', color: '#ff9500' },
  { key: 'raveling', label: 'Raveling', color: '#94a3b8' },
  { key: 'good', label: 'Good', color: '#00ff88' },
];

function matchesFilter(defect: string, f: FilterKey) {
  if (f === 'all') return true;
  if (f === 'crack') return defect.endsWith('_crack');
  return defect === f;
}
function toAppPath(p: string) { return BASE + p.replace(/^public\//, ''); }

// ─── Loaders ──────────────────────────────────────────────────────────────────
async function loadDetSummary(): Promise<DetSummary | null> {
  try { const r = await fetch(BASE + 'data/deterioration_summary.json'); return r.json(); }
  catch { return null; }
}
async function loadRoadGeo(): Promise<GeoJsonObject | null> {
  try { const r = await fetch(BASE + 'road_network.geojson'); return r.json(); }
  catch { return null; }
}

// ─── Condition KPI cards ──────────────────────────────────────────────────────
function CondKPIs({ c24, c30 }: { c24: CondBand; c30: CondBand }) {
  const bands = [
    { key: 'good_pct' as const,      label: 'Good',      color: '#00ff88', sub: 'IRI < 3.5' },
    { key: 'fair_pct' as const,      label: 'Fair',      color: '#ffd23f', sub: 'IRI 3.5–6.5' },
    { key: 'poor_pct' as const,      label: 'Poor',      color: '#ff6b35', sub: 'IRI 6.5–9.0' },
    { key: 'very_poor_pct' as const, label: 'Very Poor', color: '#ff2d78', sub: 'IRI > 9.0' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {bands.map(b => {
        const v = c24[b.key]; const delta = +(c30[b.key] - v).toFixed(1);
        return (
          <div key={b.key}
            style={{ background: BG_CARD, backdropFilter: 'blur(20px)', borderLeft: `4px solid ${b.color}` }}
            className="rounded-xl p-4 border border-slate-700/30">
            <div className="text-2xl font-black" style={{ color: b.color }}>{v}%</div>
            <div className="text-xs font-semibold text-slate-300 mt-1">{b.label}</div>
            <div className="text-[10px] text-slate-500">{b.sub}</div>
            <div className="mt-2 text-[10px] flex gap-1">
              <span className="text-slate-400">2030:</span>
              <span style={{ color: b.color }} className="font-bold">{c30[b.key]}%</span>
              <span className={delta > 0 ? 'text-red-400' : delta < 0 ? 'text-green-400' : 'text-slate-500'}>
                ({delta > 0 ? '+' : ''}{delta}%)
              </span>
            </div>
            <div className="mt-1.5 bg-slate-700/60 rounded-full h-1.5">
              <div className="rounded-full h-1.5" style={{ width: `${v}%`, background: b.color }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Deterioration curves ─────────────────────────────────────────────────────
function DetCurves({
  curves, thresholds,
}: { curves: Record<string, CurvePt[]>; thresholds: Record<string, number> }) {
  const years = Object.values(curves)[0]?.map(p => p.year) ?? [];
  const data = years.map((yr, i) => {
    const row: Record<string, number> = { year: yr };
    for (const [cls, pts] of Object.entries(curves)) {
      if (pts[i]) row[cls] = +pts[i].avg_iri.toFixed(2);
    }
    return row;
  });
  const classes = Object.keys(curves).sort();
  return (
    <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
         className="rounded-xl border border-slate-700/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp size={15} style={{ color: ACCENT }}/> Deterioration Curves 2024–2035
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Network-average IRI by road class · HDM-4 calibrated · ±18% CI
          </div>
        </div>
        <div className="flex gap-3 flex-wrap justify-end">
          {classes.map(c => (
            <div key={c} className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-3 h-1.5 rounded" style={{ background: CLASS_COLORS[c] ?? NEON[0] }}/>
              Class {c}
            </div>
          ))}
        </div>
      </div>
      <Chart3DWrap>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 20, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
            <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false}/>
            <YAxis tick={TICK} axisLine={false} tickLine={false} width={36}
              label={{ value:'IRI (m/km)', angle:-90, position:'insideLeft',
                fill:'rgba(148,163,184,0.35)', fontSize:9, dy:28 }}/>
            <Tooltip {...TT_NEON}
              formatter={(v: number, name: string) => [`${v.toFixed(2)} m/km`, `Class ${name}`]}/>
            {Object.entries(thresholds).map(([name, val]) => (
              <ReferenceLine key={name} y={val} stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4 2"
                label={{ value: name.replace(/_/g,' ')+` (${val})`,
                  position:'insideTopRight', fill:'rgba(148,163,184,0.3)', fontSize:8 }}/>
            ))}
            {classes.map(cls => (
              <Line key={cls} type="monotone" dataKey={cls}
                stroke={CLASS_COLORS[cls] ?? NEON[0]}
                strokeWidth={2.2} dot={false} animationDuration={900}/>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Chart3DWrap>
      <div className="mt-3 flex flex-wrap gap-3">
        {[{v:3.5,l:'Routine'},{v:5.0,l:'Reseal'},{v:6.5,l:'Overlay'},{v:9.0,l:'Rehab'},{v:12.0,l:'Reconstruct'}].map(t => (
          <span key={t.l} className="text-[9px] text-slate-500">
            <span className="inline-block w-4 align-middle mr-1"
              style={{ borderTop:'1px dashed rgba(255,255,255,0.15)' }}/>
            {t.l} {t.v}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Intervention map ─────────────────────────────────────────────────────────
function InterventionMap({
  triggers, geo,
}: { triggers: TriggerItem[]; geo: GeoJsonObject | null }) {
  const urgMap = useMemo(() => {
    const m: Record<string, TriggerItem> = {};
    triggers.forEach(t => { m[t.link_id] = t; });
    return m;
  }, [triggers]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    triggers.forEach(t => { c[t.urgency] = (c[t.urgency] ?? 0) + 1; });
    return c;
  }, [triggers]);

  const styleF = (f?: Feature<Geometry>): PathOptions => {
    const lid = (f?.properties as Record<string,string> | undefined)?.link_id;
    const t = lid ? urgMap[lid] : undefined;
    if (!t) return { color: '#334155', weight: 1, opacity: 0.3 };
    return {
      color: URGENCY_COLOR[t.urgency],
      weight: t.urgency === 'now' ? 3.5 : t.urgency === 'urgent' ? 2.5 : 1.8,
      opacity: t.urgency === 'now' ? 1.0 : 0.75,
    };
  };

  const onEach = (f: Feature<Geometry>, layer: Layer) => {
    const lid = (f.properties as Record<string,string> | undefined)?.link_id;
    const t = lid ? urgMap[lid] : undefined;
    if (!t) return;
    (layer as unknown as { bindTooltip(s: string, o?: object): void }).bindTooltip(
      `<b style="color:${URGENCY_COLOR[t.urgency]}">${t.road_name}</b><br/>` +
      `${t.treatment} · IRI ${t.iri.toFixed(1)}<br/>${t.trigger_year} · ` +
      `$${t.total_cost_usd >= 1e6 ? (t.total_cost_usd/1e6).toFixed(1)+'M' : (t.total_cost_usd/1000).toFixed(0)+'k'}`,
      { sticky: true }
    );
  };

  return (
    <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
         className="rounded-xl border border-slate-700/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <MapPin size={15} style={{ color: ACCENT }}/> Intervention Schedule Map
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Road colour = treatment urgency · top 50 priority links shown
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {(['now','urgent','soon','planned'] as const).map(u => (
            <span key={u} className="flex items-center gap-1 text-[10px]"
                  style={{ color: URGENCY_COLOR[u] }}>
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: URGENCY_COLOR[u] }}/>
              {u === 'now' ? '2024' : u === 'urgent' ? '2025' : u === 'soon' ? '2026–27' : '2028+'}
              <span className="text-slate-500">({counts[u] ?? 0})</span>
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ height: 340 }}>
        {geo ? (
          <MapContainer center={[1.37, 32.29]} zoom={6}
            style={{ height: '100%', width: '100%', background: '#0a0f1e' }}
            zoomControl={false}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap &copy; CARTO"/>
            <GeoJSON key="urgency" data={geo} style={styleF} onEachFeature={onEach}/>
          </MapContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-600 text-sm">
            Loading map…
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Priority table ───────────────────────────────────────────────────────────
function PriorityTable({ triggers }: { triggers: TriggerItem[] }) {
  return (
    <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
         className="rounded-xl border border-slate-700/30 p-4">
      <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <Zap size={15} style={{ color: ACCENT }}/> Top 10 Priority Interventions
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700/50">
              <th className="text-left pb-2">Road Name</th>
              <th className="text-left pb-2">Region</th>
              <th className="text-left pb-2">Treatment</th>
              <th className="text-right pb-2">IRI</th>
              <th className="text-right pb-2">Year</th>
              <th className="text-right pb-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {triggers.slice(0, 10).map((t, i) => (
              <tr key={i}
                  className="border-b border-slate-800/40 hover:bg-slate-700/10 transition-colors">
                <td className="py-1.5 text-slate-200 font-medium">
                  {t.road_name.length > 28 ? t.road_name.slice(0,26)+'…' : t.road_name}
                </td>
                <td className="py-1.5 text-slate-400">{t.region}</td>
                <td className="py-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{ background: URGENCY_COLOR[t.urgency]+'22', color: URGENCY_COLOR[t.urgency] }}>
                    {t.treatment}
                  </span>
                </td>
                <td className="py-1.5 text-right font-mono" style={{
                  color: t.iri >= 12 ? '#ff2d78' : t.iri >= 9 ? '#ff6b35' : t.iri >= 6.5 ? '#ffd23f' : '#00ff88',
                }}>
                  {t.iri.toFixed(1)}
                </td>
                <td className="py-1.5 text-right text-slate-400">{t.trigger_year}</td>
                <td className="py-1.5 text-right font-mono" style={{ color: ACCENT }}>
                  ${t.total_cost_usd >= 1e6
                    ? (t.total_cost_usd/1e6).toFixed(1)+'M'
                    : (t.total_cost_usd/1000).toFixed(0)+'k'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Budget stacked bar ───────────────────────────────────────────────────────
function BudgetPlanner({ budget, total }: { budget: BudgetPt[]; total: number }) {
  const data = budget.map(b => ({
    year: b.year,
    Routine:     +(b.routine_usd / 1e6).toFixed(2),
    Reseal:      +(b.reseal_usd  / 1e6).toFixed(2),
    Overlay:     +(b.overlay_usd / 1e6).toFixed(2),
    Rehab:       +(b.rehab_usd   / 1e6).toFixed(2),
    Reconstruct: +((b.reconstruct_usd + b.regravelling_usd) / 1e6).toFixed(2),
  }));
  const STACKS = [
    { k: 'Routine',     c: '#00ff88' }, { k: 'Reseal',      c: '#00f5ff' },
    { k: 'Overlay',     c: '#ffd23f' }, { k: 'Rehab',       c: '#ff6b35' },
    { k: 'Reconstruct', c: '#ff2d78' },
  ];
  return (
    <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
         className="rounded-xl border border-slate-700/30 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign size={15} style={{ color: ACCENT }}/> Maintenance Budget Plan 2024–2030
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            USD millions by treatment type · MoWT unit costs
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black" style={{ color: ACCENT }}>
            ${(total/1e9).toFixed(2)}B
          </div>
          <div className="text-[10px] text-slate-500">7-year total</div>
        </div>
      </div>
      <Chart3DWrap>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
            <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false}/>
            <YAxis tick={TICK} axisLine={false} tickLine={false} width={46}
              tickFormatter={(v: number) => `$${v}M`}/>
            <Tooltip {...TT_NEON}
              formatter={(v: number, name: string) => [`$${v.toFixed(1)}M`, name]}/>
            {STACKS.map((s, i) => (
              <Bar key={s.k} dataKey={s.k} stackId="a" fill={s.c} fillOpacity={0.85}
                radius={i === STACKS.length - 1 ? [4,4,0,0] : [0,0,0,0]}
                animationDuration={900}/>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Chart3DWrap>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {STACKS.map(s => (
          <div key={s.k} className="text-center">
            <div className="w-full h-1.5 rounded-full mb-1" style={{ background: s.c }}/>
            <div className="text-[9px] text-slate-500">{s.k}</div>
            <div className="text-[10px] font-bold" style={{ color: s.c }}>
              ${(data.reduce((a, b) => a + ((b as Record<string,number>)[s.k] ?? 0), 0)).toFixed(0)}M
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
type TabId = 'overview' | 'deterioration' | 'interventions' | 'budget';

export default function RoadConditionView() {
  const [analytics, setAnalytics]         = useState<PlatformAnalytics | null>(null);
  const [det, setDet]                     = useState<DetSummary | null>(null);
  const [roadGeo, setRoadGeo]             = useState<GeoJsonObject | null>(null);
  const [defectSummary, setDefectSummary] = useState<ImageDefectSummary | null>(null);
  const [pavementImages, setPavImgs]      = useState<PavementImage[]>([]);
  const [defectFilter, setDefectFilter]   = useState<FilterKey>('all');
  const [imgError, setImgError]           = useState<Set<string>>(new Set());
  const [tab, setTab]                     = useState<TabId>('overview');

  useEffect(() => {
    loadPlatformAnalytics().then(setAnalytics).catch(() => {});
    loadDetSummary().then(setDet).catch(() => {});
    loadRoadGeo().then(setRoadGeo).catch(() => {});
    fetch(BASE + 'data/image_defects_summary.json').then(r => r.json()).then(setDefectSummary).catch(() => {});
    fetch(BASE + 'data/pavement_images.json').then(r => r.json()).then(setPavImgs).catch(() => {});
  }, []);

  const a = analytics;
  const d = det;

  const wtssData = a?.wtssTimeline.map(w => ({
    year: w.financial_year, km: w.stock_of_paved_roads_km,
    added: w.annual_increase_km, ndp: w.ndp,
  })) ?? [];

  const regionPaved = a
    ? Object.entries(a.regionPavedKm)
        .map(([region, km]) => ({ region, km: Math.round(km) }))
        .sort((x, y) => y.km - x.km)
    : [];

  const defectBarData = defectSummary
    ? Object.entries(defectSummary.defect_distribution)
        .map(([type, count]) => ({
          name: DEFECT_LABEL[type] ?? type, count,
          fill: DEFECT_COLOR[type] ?? '#4d9fff',
        }))
        .sort((x, y) => y.count - x.count)
    : [];

  const severityPieData = defectSummary ? [
    { name: 'High',   value: defectSummary.severity_distribution['High']   ?? 0, fill: '#ff2d78' },
    { name: 'Medium', value: defectSummary.severity_distribution['Medium'] ?? 0, fill: '#ffd23f' },
    { name: 'Low',    value: defectSummary.severity_distribution['Low']    ?? 0, fill: '#00ff88' },
  ] : [];

  const filteredImages = pavementImages
    .filter(img => matchesFilter(img.defect_type, defectFilter))
    .sort((x, y) => y.confidence - x.confidence)
    .slice(0, 24);

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'overview',      label: 'Network Overview'    },
    { id: 'deterioration', label: 'Deterioration Curves' },
    { id: 'interventions', label: 'Intervention Map'    },
    { id: 'budget',        label: 'Budget Planner'      },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 animate-fade-in"
         style={{ background: '#0a0f1e', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
             style={{ background: ACCENT + '22' }}>
          <Activity size={20} style={{ color: ACCENT }}/>
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">
            Road Condition &amp; Pavement Management
          </h1>
          <p className="text-xs text-slate-400">
            HDM-4 deterioration model
            {d
              ? ` · R²=${d.r_squared.toFixed(3)} · ${d.links_projected.toLocaleString()} links ${d.projection_period}`
              : ' · loading model…'}
          </p>
        </div>
      </div>

      {/* Model stat badges */}
      {d && (
        <div className="flex flex-wrap gap-2">
          {[
            { l: 'Model',        v: 'HDM-4 + MLP',                                     c: ACCENT },
            { l: 'R²',           v: d.r_squared.toFixed(4),                             c: '#00ff88' },
            { l: 'Links',        v: d.links_projected.toLocaleString(),                  c: '#00f5ff' },
            { l: 'Budget 24–30', v: `$${(d.total_maintenance_budget_2024_2030_usd/1e9).toFixed(2)}B`, c: '#ffd23f' },
          ].map(b => (
            <div key={b.l} className="px-3 py-1.5 rounded-lg border border-slate-700/40 text-[10px]"
                 style={{ background: BG_CARD }}>
              <span className="text-slate-400">{b.l}: </span>
              <span className="font-bold" style={{ color: b.c }}>{b.v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl p-1 border border-slate-700/40"
           style={{ background: 'rgba(2,6,14,0.6)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={tab === t.id
              ? { background: ACCENT, color: '#fff' }
              : { color: 'rgba(148,163,184,0.7)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ OVERVIEW ══════════ */}
      {tab === 'overview' && (
        <>
          {d && <CondKPIs c24={d.network_condition_2024} c30={d.network_condition_2030}/>}

          {/* Official survey */}
          <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
               className="rounded-xl border border-slate-700/30 p-4">
            <div className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-400"/>
              Official Survey — Condition Overview (FY 2023/24)
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[
                { label:'Paved — Excellent/Good', pct: a?.pavedFairToGoodPct ?? 94.2,         color:'#00ff88' },
                { label:'Paved — Poor/Bad',       pct: 100-(a?.pavedFairToGoodPct ?? 94.2),   color:'#ff2d78' },
                { label:'Unpaved — Fair/Good',    pct: a?.unpavedFairToGoodPct ?? 62,          color:'#ffd23f' },
                { label:'Unpaved — Poor',         pct: 100-(a?.unpavedFairToGoodPct ?? 62),    color:'#ff6b35' },
              ].map(c => (
                <div key={c.label}
                     className="rounded-xl p-4 border border-slate-700/30"
                     style={{ background: 'rgba(15,23,42,0.4)' }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-slate-300">{c.label}</span>
                    <span className="text-xl font-black" style={{ color: c.color }}>
                      {c.pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="bg-slate-700/60 rounded-full h-2">
                    <div className="rounded-full h-2 transition-all"
                         style={{ width:`${c.pct}%`, background: c.color }}/>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10px] text-slate-600">
              Source: OPM Infrastructure Development Cluster NAPR 2023/24
            </div>
          </div>

          {/* Paved stock growth */}
          <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
               className="rounded-xl border border-slate-700/30 p-4">
            <div className="text-sm font-bold text-white mb-1">
              Paved Road Stock Growth (NDP II &amp; III)
            </div>
            <div className="text-[10px] text-slate-500 mb-4">
              Annual additions to the paved national road network
            </div>
            <Chart3DWrap>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={wtssData} margin={{ top:8, right:20, left:8, bottom:0 }}>
                  <AreaGradDefs id="rcGreen" color="#00ff88"/>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
                  <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false}/>
                  <YAxis tick={TICK} axisLine={false} tickLine={false} width={52}
                    tickFormatter={(v: number) => v.toLocaleString()}/>
                  <Tooltip {...TT_NEON} formatter={(v: number, name: string) => [
                    name === 'km' ? `${v.toLocaleString()} km` : `+${v.toLocaleString()} km`,
                    name === 'km' ? 'Paved stock' : 'Added',
                  ]}/>
                  <ReferenceLine y={5000} stroke="#475569" strokeDasharray="4 4"
                    label={{ value:'5,000 km', fill:'#64748b', fontSize:9 }}/>
                  <Area type="monotone" dataKey="km" stroke="#00ff88" strokeWidth={2.5}
                    fill="url(#rcGreen)" dot={{ fill:'#00ff88', r:4 }} animationDuration={1100}
                    filter="url(#rcGreenglow)"/>
                </AreaChart>
              </ResponsiveContainer>
            </Chart3DWrap>
            <div className="mt-3 flex flex-wrap gap-2">
              {['NDP II','NDP III'].map(ndp => {
                const items = wtssData.filter(w => w.ndp === ndp);
                const tot   = items.reduce((s, w) => s + (w.added || 0), 0);
                return (
                  <div key={ndp} className="bg-slate-700/60 rounded-lg px-3 py-2 text-center">
                    <div className="text-sm font-black text-white">{tot.toFixed(0)} km</div>
                    <div className="text-[9px] text-slate-400">{ndp} additions</div>
                    <div className="text-[9px] text-slate-500">
                      {items[0]?.year} – {items[items.length-1]?.year}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Region paved + network summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
                 className="rounded-xl border border-slate-700/30 p-4">
              <div className="text-sm font-bold text-white mb-4">Paved km by Region (July 2025)</div>
              <div className="space-y-2">
                {regionPaved.map(r => {
                  const col = REGION_NEON[r.region] ?? '#4d9fff';
                  return (
                    <div key={r.region}>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: col }}/>
                          {r.region}
                        </span>
                        <span className="text-slate-400">{r.km.toLocaleString()} km</span>
                      </div>
                      <div className="bg-slate-700 rounded-full h-1.5">
                        <div className="rounded-full h-1.5 transition-all"
                          style={{ width:`${(r.km/(regionPaved[0]?.km||1))*100}%`, background:col }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
                 className="rounded-xl border border-slate-700/30 p-4">
              <div className="text-sm font-bold text-white mb-4">Network Summary</div>
              <div className="space-y-3">
                {[
                  { label:'Total Network',  col:'#94a3b8',
                    val: a ? `${a.totalNetworkKm.toLocaleString(undefined,{maximumFractionDigits:0})} km` : '21,292 km' },
                  { label:'Paved',          col:'#00ff88',
                    val: a ? `${a.pavedKm.toLocaleString(undefined,{maximumFractionDigits:0})} km` : '6,312 km' },
                  { label:'Paved Share',    col:'#00f5ff',
                    val: a ? `${a.percentPaved.toFixed(1)}%` : '29.6%' },
                  { label:'Links Modelled', col: ACCENT,
                    val: d ? d.links_projected.toLocaleString() : '—' },
                  { label:'Budget 24–30',   col:'#ffd23f',
                    val: d ? `$${(d.total_maintenance_budget_2024_2030_usd/1e9).toFixed(2)}B` : '—' },
                ].map(row => (
                  <div key={row.label}
                       className="flex justify-between items-center border-b border-slate-700/30 pb-2">
                    <span className="text-[10px] text-slate-400">{row.label}</span>
                    <span className="text-sm font-bold" style={{ color: row.col }}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Image defect analysis */}
          {defectSummary && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Camera size={20} className="text-purple-400"/>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Image Defect Analysis</h2>
                  <p className="text-[10px] text-slate-400">
                    {defectSummary.images_processed.toLocaleString()} images · {defectSummary.model}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
                     className="rounded-xl border border-slate-700/30 p-4">
                  <div className="text-xs font-bold text-white mb-3">Defect Frequency</div>
                  <Chart3DWrap>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={defectBarData} layout="vertical"
                                margin={{ top:0, right:16, left:4, bottom:0 }}>
                        <CartesianGrid strokeDasharray="3 3"
                          stroke="rgba(148,163,184,0.06)" horizontal={false}/>
                        <XAxis type="number" tick={TICK} axisLine={false} tickLine={false}/>
                        <YAxis type="category" dataKey="name" tick={TICK}
                          axisLine={false} tickLine={false} width={96}/>
                        <Tooltip {...TT_NEON}
                          formatter={(v: number) => [v.toLocaleString(), 'Images']}/>
                        <Bar dataKey="count" radius={[0,4,4,0]}
                             animationDuration={900} shape={<Bar3D/>}>
                          {defectBarData.map(dd => <Cell key={dd.name} fill={dd.fill}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Chart3DWrap>
                </div>
                <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
                     className="rounded-xl border border-slate-700/30 p-4 flex flex-col">
                  <div className="text-xs font-bold text-white mb-3">Severity Distribution</div>
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <PieChart width={200} height={160}>
                      <Pie data={severityPieData} cx="50%" cy="50%"
                        innerRadius={44} outerRadius={68} paddingAngle={3}
                        dataKey="value" animationDuration={900}>
                        {severityPieData.map(s => <Cell key={s.name} fill={s.fill}/>)}
                      </Pie>
                      <Tooltip {...TT_NEON}
                        formatter={(v: number) => [v.toLocaleString(), 'Images']}/>
                    </PieChart>
                    <div className="flex gap-4 mt-1">
                      {severityPieData.map(s => (
                        <div key={s.name} className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background:s.fill }}/>
                          <span className="text-[10px] text-slate-300">{s.name}</span>
                          <span className="text-[10px] font-bold text-white">
                            {s.value.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
                   className="rounded-xl border border-slate-700/30 p-4">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Filter size={12} className="text-slate-400"/>
                  {FILTER_PILLS.map(pill => (
                    <button key={pill.key} onClick={() => setDefectFilter(pill.key)}
                      className="px-3 py-1 rounded-full text-[10px] font-semibold transition-all border"
                      style={{
                        background:  defectFilter === pill.key ? pill.color+'33' : 'rgba(30,41,59,0.8)',
                        borderColor: defectFilter === pill.key ? pill.color : 'rgba(148,163,184,0.15)',
                        color:       defectFilter === pill.key ? pill.color : '#94a3b8',
                      }}>
                      {pill.label}
                    </button>
                  ))}
                </div>
                {filteredImages.length === 0 ? (
                  <div className="text-center text-slate-500 py-8 text-xs">
                    No images for this filter
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {filteredImages.map(img => {
                      const appPath = toAppPath(img.image_path);
                      const color   = DEFECT_COLOR[img.defect_type] ?? '#4d9fff';
                      const label   = DEFECT_LABEL[img.defect_type] ?? img.defect_type;
                      const pct     = Math.round(img.confidence * 100);
                      const errored = imgError.has(img.image_path);
                      return (
                        <div key={img.image_path}
                          className="rounded-xl overflow-hidden bg-slate-800/60 border border-slate-700/40 group">
                          <div className="relative aspect-video bg-slate-900">
                            {errored ? (
                              <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                                <Camera size={20}/>
                              </div>
                            ) : (
                              <img src={appPath} alt={label} loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={() => setImgError(prev => new Set(prev).add(img.image_path))}/>
                            )}
                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold"
                              style={{ background: color+'dd', color:'#fff' }}>{label}</span>
                            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-semibold"
                              style={{ background: img.severity==='High' ? '#ff2d78aa' : img.severity==='Medium' ? '#ffd23faa' : '#00ff88aa', color:'#fff' }}>
                              {img.severity}
                            </span>
                          </div>
                          <div className="px-2 pt-1.5 pb-2">
                            <div className="text-[9px] text-slate-400 truncate">
                              {img.link_id ?? img.folder}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <div className="flex-1 bg-slate-700 rounded-full h-1">
                                <div className="h-1 rounded-full"
                                  style={{ width:`${pct}%`, background:color }}/>
                              </div>
                              <span className="text-[8px] text-slate-400 w-6 text-right">
                                {pct}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
               className="rounded-xl border border-slate-700/30 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5"/>
              <div className="text-[10px] text-slate-400 leading-relaxed">
                <strong className="text-slate-300">Data sources:</strong> Condition survey FY 2023/24
                (OPM NAPR). Network inventory July 2025 (MoWT). HDM-4 calibrated Dec 2023 for Uganda.
                MLP R²={d ? d.r_squared.toFixed(4) : '…'}.
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════ DETERIORATION CURVES ══════════ */}
      {tab === 'deterioration' && (
        d ? (
          <>
            <DetCurves
              curves={d.class_deterioration_curves}
              thresholds={d.intervention_thresholds_iri}/>
            <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
                 className="rounded-xl border border-slate-700/30 p-4">
              <div className="text-sm font-bold text-white mb-4">
                Network Condition Shift 2024 → 2030
              </div>
              <div className="grid grid-cols-2 gap-6">
                {(['2024','2030'] as const).map(yr => {
                  const cond = yr === '2024'
                    ? d.network_condition_2024
                    : d.network_condition_2030;
                  return (
                    <div key={yr}>
                      <div className="text-xs font-semibold text-slate-300 mb-3">
                        Condition {yr}
                      </div>
                      {([
                        { label:'Good',      pct:cond.good_pct,      color:'#00ff88' },
                        { label:'Fair',      pct:cond.fair_pct,      color:'#ffd23f' },
                        { label:'Poor',      pct:cond.poor_pct,      color:'#ff6b35' },
                        { label:'Very Poor', pct:cond.very_poor_pct, color:'#ff2d78' },
                      ]).map(b => (
                        <div key={b.label} className="mb-2">
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-slate-400">{b.label}</span>
                            <span style={{ color:b.color }}>{b.pct}%</span>
                          </div>
                          <div className="bg-slate-700/60 rounded-full h-2">
                            <div className="rounded-full h-2"
                              style={{ width:`${b.pct}%`, background:b.color }}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div style={{ background: BG_CARD }}
               className="rounded-xl p-8 text-center text-slate-500 border border-slate-700/30">
            Loading deterioration data…
          </div>
        )
      )}

      {/* ══════════ INTERVENTIONS ══════════ */}
      {tab === 'interventions' && (
        <>
          <InterventionMap
            triggers={d?.intervention_schedule ?? []}
            geo={roadGeo}/>
          {d
            ? <PriorityTable triggers={d.intervention_schedule}/>
            : <div style={{ background: BG_CARD }}
                   className="rounded-xl p-8 text-center text-slate-500 border border-slate-700/30">
                Loading…
              </div>
          }
        </>
      )}

      {/* ══════════ BUDGET ══════════ */}
      {tab === 'budget' && (
        d ? (
          <>
            <BudgetPlanner
              budget={d.budget_schedule_2024_2030}
              total={d.total_maintenance_budget_2024_2030_usd}/>
            <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
                 className="rounded-xl border border-slate-700/30 p-4">
              <div className="text-sm font-bold text-white mb-3">
                MoWT Unit Costs (USD/km)
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(d.unit_costs_usd_per_km).map(([k, v]) => (
                  <div key={k} className="rounded-lg p-3 border border-slate-700/30"
                       style={{ background:'rgba(15,23,42,0.4)' }}>
                    <div className="text-[10px] text-slate-500 capitalize">
                      {k.replace(/_/g,' ')}
                    </div>
                    <div className="text-sm font-bold mt-1" style={{ color: ACCENT }}>
                      ${(v as number).toLocaleString()}/km
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ background: BG_CARD }}
               className="rounded-xl p-8 text-center text-slate-500 border border-slate-700/30">
            Loading budget data…
          </div>
        )
      )}

    </div>
  );
}
