/**
 * OverloadingSection — Pavement overloading analytics
 *
 * ESAL methodology (SATCC/TRH4, standard axle = 80 kN):
 *   - HGV at legal weight: 2.4 ESALs → overloaded +25%: 5.86 ESALs (4th power law)
 *   - Bus at legal weight: 1.6 ESALs → overloaded +10%: 2.34 ESALs
 *   - Risk index = min(100, heavy_veh_per_day / 1000 × 100) × surface/class multipliers
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  MapContainer, TileLayer, ZoomControl, GeoJSON,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { Truck, AlertTriangle, Info, Activity } from 'lucide-react';
import {
  REGION_NEON, Bar3D, Chart3DWrap, TT_NEON, TICK,
} from '../../lib/chart3d';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';

// ── Risk colour palette ───────────────────────────────────────────────────────
const RISK_COLOR: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#eab308',
  Low:      '#22c55e',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface OverloadingKPIs {
  total_links:          number;
  total_daily_esals:    number;
  annual_esal_millions: number;
  avg_hgv_pct:          number;
  critical_links:       number;
  high_risk_links:      number;
  mean_esals_per_link:  number;
}
interface RegionRow {
  region:             string;
  total_esals_daily:  number;
  avg_hgv_pct:        number;
  critical_links:     number;
  high_risk_links:    number;
  overload_risk_score: number;
  link_count:         number;
}
interface LinkRow {
  link_id:              string;
  road_name:            string;
  road_no:              string;
  region:               string;
  road_class:           string;
  surface_type:         string;
  length_km:            number;
  aadt:                 number;
  hgv_pct:              number;
  estimated_daily_esals: number;
  overload_risk_index:  number;
  risk_category:        string;
  pavement_damage_factor: number;
}
interface LinkRisk { rc: string; idx: number; hpct: number; esal: number }
interface OverloadingSummary {
  network_kpis:            OverloadingKPIs;
  esal_breakdown_by_class: Record<string, number>;
  risk_distribution:       Record<string, number>;
  overloading_by_region:   RegionRow[];
  top_overloaded_links:    LinkRow[];
  link_risk_map:           Record<string, LinkRisk>;
}

// ── Leaflet risk map layer ────────────────────────────────────────────────────
function RiskLayer({
  features, linkRiskMap, onSelect,
}: {
  features: any[];
  linkRiskMap: Record<string, LinkRisk>;
  onSelect: (feat: any) => void;
}) {
  const styleF = useCallback((feat?: any) => {
    if (!feat?.properties) return {};
    const lid   = feat.properties.link_id ?? '';
    const lr    = linkRiskMap[lid];
    const color = lr ? (RISK_COLOR[lr.rc] ?? '#94a3b8') : '#475569';
    const rc    = feat.properties.road_class ?? '';
    const weight = rc === 'A' ? 3.5 : rc === 'B' ? 2.5 : rc === 'M' ? 4 : 2;
    return { color, weight, opacity: 0.88, fillOpacity: 0 };
  }, [linkRiskMap]);

  const onEach = useCallback((feat: any, layer: L.Layer) => {
    const path = layer as L.Path;
    path.on({
      click:     () => onSelect(feat.properties),
      mouseover: (e: L.LeafletMouseEvent) => (e.target as L.Path).setStyle({ weight: 5, opacity: 1 }),
      mouseout:  (e: L.LeafletMouseEvent) => (e.target as L.Path).setStyle(styleF(feat) as L.PathOptions),
    });
  }, [onSelect, styleF]);

  const geo = useMemo(() => ({ type: 'FeatureCollection' as const, features }), [features]);
  return <GeoJSON data={geo as any} style={styleF as any} onEachFeature={onEach as any} />;
}

// ── KPI glass card ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="bms-card flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `rgba(${hexRgbInline(color)},0.12)`, border: `1px solid rgba(${hexRgbInline(color)},0.25)` }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-xl font-black mt-0.5" style={{ color }}>{value}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}
function hexRgbInline(hex: string) {
  if (hex.startsWith('#')) {
    return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
  }
  return '148,163,184';
}

// ── Selected link popup ───────────────────────────────────────────────────────
function SelectedLinkPanel({ props, onClose }: { props: any; onClose: () => void }) {
  const lid   = props?.link_id ?? '';
  return (
    <div style={{
      position: 'absolute', top: 10, right: 10, zIndex: 1000, width: 260,
      background: 'rgba(10,15,30,0.96)', border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 12, padding: '12px 14px', backdropFilter: 'blur(14px)',
    }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-white">{props?.link_name ?? lid}</span>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">×</button>
      </div>
      <div className="text-[9px] text-slate-400 space-y-1">
        <div className="flex justify-between">
          <span>Risk</span>
          <span style={{ color: RISK_COLOR[props?.rc ?? 'Low'] ?? '#94a3b8' }} className="font-bold">
            {props?.rc ?? '—'}
          </span>
        </div>
        <div className="flex justify-between"><span>Risk index</span><span className="text-slate-200">{props?.idx?.toFixed(1) ?? '—'}</span></div>
        <div className="flex justify-between"><span>HGV %</span><span className="text-slate-200">{props?.hpct?.toFixed(1) ?? '—'}%</span></div>
        <div className="flex justify-between"><span>Daily ESALs</span><span className="text-slate-200">{props?.esal?.toLocaleString(undefined,{maximumFractionDigits:0}) ?? '—'}</span></div>
      </div>
    </div>
  );
}

// ── Custom donut label ────────────────────────────────────────────────────────
function DonutLabel({ cx, cy, midAngle, outerRadius, name, value, total }: any) {
  if (!value || value / total < 0.03) return null;
  const RADIAN = Math.PI / 180;
  const r = outerRadius + 22;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  const pct = ((value / total) * 100).toFixed(0);
  return (
    <text x={x} y={y} fill="rgba(148,163,184,0.75)" fontSize={9} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {name} {pct}%
    </text>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function OverloadingSection() {
  const [summary,      setSummary]      = useState<OverloadingSummary | null>(null);
  const [geoFeatures,  setGeoFeatures]  = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedLink, setSelectedLink] = useState<any>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/overloading_summary.json`).then(r => r.json()),
      fetch(`${base}data/traffic_predictions.geojson`).then(r => r.json()),
    ]).then(([sum, gj]) => {
      setSummary(sum as OverloadingSummary);
      setGeoFeatures((gj.features ?? []) as any[]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const kpis        = summary?.network_kpis;
  const riskDist    = summary?.risk_distribution ?? {};
  const byRegion    = summary?.overloading_by_region ?? [];
  const top20       = summary?.top_overloaded_links ?? [];
  const linkRiskMap = summary?.link_risk_map ?? {};
  const esalBreak   = summary?.esal_breakdown_by_class ?? {};

  // ESAL donut data — filter Motorcycles (=0)
  const donutData = useMemo(() => {
    const total = Object.values(esalBreak).reduce((a, b) => a + b, 0);
    return Object.entries(esalBreak)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, total }))
      .sort((a, b) => b.value - a.value);
  }, [esalBreak]);
  const donutTotal = donutData.reduce((a, b) => a + b.value, 0);

  const DONUT_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#4d9fff'];

  // Regional chart data sorted by ESALs
  const regionChart = byRegion.map(r => ({
    region: r.region,
    ESALs:  Math.round(r.total_esals_daily / 1000),  // thousands
    Risk:   r.overload_risk_score,
    color:  REGION_NEON[r.region] ?? '#475569',
  })).sort((a, b) => b.ESALs - a.ESALs);

  // Risk distribution bar
  const riskBar = [
    { name: 'Critical', count: riskDist.Critical ?? 0, color: RISK_COLOR.Critical },
    { name: 'High',     count: riskDist.High     ?? 0, color: RISK_COLOR.High     },
    { name: 'Medium',   count: riskDist.Medium   ?? 0, color: RISK_COLOR.Medium   },
    { name: 'Low',      count: riskDist.Low       ?? 0, color: RISK_COLOR.Low      },
  ];

  function onLinkClick(props: any) {
    const lr = linkRiskMap[props?.link_id ?? ''];
    setSelectedLink(lr ? { ...lr, link_name: props?.link_name ?? props?.link_id } : null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Computing ESAL risk indices…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <Truck size={20} style={{ color: '#ef4444' }}/>
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Overloading Analytics</h1>
          <p className="text-xs text-slate-400">
            ESAL risk index · SATCC/TRH4 methodology · Uganda legal limits 10/16/24/48 t
          </p>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Daily ESALs"
          value={kpis ? `${(kpis.total_daily_esals / 1_000_000).toFixed(1)}M` : '—'}
          sub="Equiv. standard axle loads / day"
          color="#ef4444"
          icon={<Activity size={18}/>}
        />
        <KpiCard
          label="Critical Risk Links"
          value={kpis ? kpis.critical_links.toString() : '—'}
          sub={`+ ${kpis?.high_risk_links ?? 0} High risk links`}
          color="#f97316"
          icon={<AlertTriangle size={18}/>}
        />
        <KpiCard
          label="Avg Network HGV %"
          value={kpis ? `${kpis.avg_hgv_pct.toFixed(1)}%` : '—'}
          sub="Heavy vehicles as % of AADT"
          color="#eab308"
          icon={<Truck size={18}/>}
        />
        <KpiCard
          label="Annual Pavement Damage"
          value={kpis ? `${kpis.annual_esal_millions.toFixed(0)}M` : '—'}
          sub="Million ESALs / year (network)"
          color="#a78bfa"
          icon={<Activity size={18}/>}
        />
      </div>

      {/* ── Map + Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ minHeight: 440 }}>

        {/* Risk map */}
        <div className="lg:col-span-3 bms-card relative overflow-hidden" style={{ minHeight: 400 }}>
          <div className="text-sm font-bold text-white mb-2">Road Network Overloading Risk Map</div>
          <div className="text-[10px] text-slate-500 mb-3">
            Lines coloured by risk category · Click any road for details
          </div>

          {/* Legend strip */}
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            {Object.entries(RISK_COLOR).map(([cat, col]) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div className="w-7 h-1.5 rounded-full" style={{ background: col }}/>
                <span className="text-[10px]" style={{ color: col }}>{cat}</span>
                <span className="text-[9px] text-slate-600">({riskDist[cat] ?? 0})</span>
              </div>
            ))}
          </div>

          {/* Map */}
          <div style={{ height: 320, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
            <MapContainer
              center={[1.37, 32.3]} zoom={7} zoomControl={false}
              style={{ height: '100%', width: '100%', background: '#0a0f1e' }}
            >
              <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery}/>
              <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.65}/>
              <ZoomControl position="bottomright"/>
              {geoFeatures.length > 0 && (
                <RiskLayer
                  features={geoFeatures}
                  linkRiskMap={linkRiskMap}
                  onSelect={onLinkClick}
                />
              )}
            </MapContainer>

            {selectedLink && (
              <SelectedLinkPanel
                props={selectedLink}
                onClose={() => setSelectedLink(null)}
              />
            )}
          </div>
        </div>

        {/* Charts column */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* ESAL breakdown donut */}
          <div className="bms-card flex-1">
            <div className="text-sm font-bold text-white mb-1">ESAL Load by Vehicle Class</div>
            <div className="text-[10px] text-slate-500 mb-2">Daily overloaded ESALs</div>
            <Chart3DWrap tilt={0}>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Tooltip
                    {...TT_NEON}
                    formatter={(v: number) => [v.toLocaleString(), 'ESALs/day']}
                  />
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={(p) => <DonutLabel {...p} total={donutTotal}/>}
                    animationDuration={800}
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]}/>
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </Chart3DWrap>
          </div>

          {/* Risk distribution mini-bar */}
          <div className="bms-card">
            <div className="text-xs font-bold text-white mb-3">Risk Distribution</div>
            <div className="space-y-2">
              {riskBar.map(item => {
                const pct = kpis ? (item.count / kpis.total_links) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-16 text-[10px] font-semibold" style={{ color: item.color }}>{item.name}</div>
                    <div className="flex-1 h-4 rounded-sm overflow-hidden bg-slate-800/60">
                      <div
                        className="h-full rounded-sm transition-all duration-700"
                        style={{ width: `${pct}%`, background: item.color, opacity: 0.8 }}
                      />
                    </div>
                    <div className="w-10 text-right text-[10px] text-slate-400">{item.count}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[9px] text-slate-600">{kpis?.total_links ?? 0} road links total</div>
          </div>
        </div>
      </div>

      {/* ── Regional ESALs bar chart ── */}
      <div className="bms-card">
        <div className="text-sm font-bold text-white mb-1">Daily ESAL Load by Region (thousands)</div>
        <div className="text-[10px] text-slate-500 mb-4">
          Total estimated equivalent standard axle loads per day · overloaded HGV +25%, bus +10%
        </div>
        <Chart3DWrap>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={regionChart} layout="vertical" margin={{ top: 0, right: 16, left: 90, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" horizontal={false}/>
              <XAxis type="number" tick={TICK} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `${v.toLocaleString()}k`}/>
              <YAxis type="category" dataKey="region" tick={TICK} axisLine={false} tickLine={false} width={88}/>
              <Tooltip {...TT_NEON}
                formatter={(v: number) => [`${(v * 1000).toLocaleString()}`, 'ESALs/day']}/>
              <Bar dataKey="ESALs" radius={[0, 4, 4, 0]} animationDuration={900} shape={<Bar3D/>}>
                {regionChart.map(r => <Cell key={r.region} fill={REGION_NEON[r.region] ?? '#475569'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Chart3DWrap>
      </div>

      {/* ── Top 20 overloaded roads table ── */}
      <div className="bms-card">
        <div className="text-sm font-bold text-white mb-1 flex items-center gap-2">
          <AlertTriangle size={15} style={{ color: '#ef4444' }}/>
          Top 20 Highest-Risk Road Links
        </div>
        <div className="text-[10px] text-slate-500 mb-4">Ranked by estimated daily ESAL load</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                {['Road', 'Region', 'Class', 'HGV %', 'Daily ESALs', 'Dmg Factor', 'Risk', 'Surface'].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top20.map((r, i) => (
                <tr key={r.link_id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-slate-600 font-mono w-5 flex-shrink-0">{i + 1}</span>
                      <span className="text-slate-200 font-medium truncate max-w-[180px]" title={r.road_name}>
                        {r.road_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-slate-400 text-[10px]">{r.region}</td>
                  <td className="py-2 px-2">
                    <span className="text-[10px] font-bold" style={{ color: r.road_class === 'A' ? '#00f5ff' : r.road_class === 'B' ? '#00ff88' : '#ffd23f' }}>
                      {r.road_class}
                    </span>
                  </td>
                  <td className="py-2 px-2 font-mono text-amber-400 text-[10px]">{r.hgv_pct.toFixed(1)}%</td>
                  <td className="py-2 px-2 font-mono text-slate-200 text-[10px]">{r.estimated_daily_esals.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="py-2 px-2 font-mono text-slate-300 text-[10px]">{r.pavement_damage_factor.toFixed(2)}×</td>
                  <td className="py-2 px-2">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: `rgba(${hexRgbInline(RISK_COLOR[r.risk_category] ?? '#94a3b8')},0.15)`,
                        color: RISK_COLOR[r.risk_category] ?? '#94a3b8',
                        border: `1px solid rgba(${hexRgbInline(RISK_COLOR[r.risk_category] ?? '#94a3b8')},0.3)`,
                      }}
                    >
                      {r.risk_category}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-[10px] text-slate-400 capitalize">{r.surface_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Info panel ── */}
      <div className="bms-card" style={{ borderColor: 'rgba(167,139,250,0.15)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Info size={15} style={{ color: '#a78bfa' }}/>
          <div className="text-sm font-bold text-white">Methodology & Legal Standards</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-[11px] text-slate-400 leading-relaxed">

          <div>
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2">
              Uganda Legal Axle Load Limits
            </div>
            <div className="space-y-1">
              {[
                ['Single axle',   '10 t'],
                ['Tandem axle',   '16 t'],
                ['Tridem axle',   '24 t'],
                ['Gross vehicle', '48 t (54 t for 5-axle)'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-500">{k}</span>
                  <span className="text-slate-200 font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">
              4th Power Law — Pavement Damage
            </div>
            <p>
              Damage ∝ (axle_load / standard_axle)<sup>4</sup>. Standard axle = 80 kN (8.16 t).
              A vehicle 20% overloaded causes <span className="text-amber-300 font-semibold">2.1× the pavement damage</span> of
              a legal vehicle. At Uganda's typical +25% HGV overloading, an HGV
              generates <span className="text-red-400 font-semibold">5.86 ESALs</span> vs 2.4 at legal weight.
            </p>
          </div>

          <div>
            <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">
              Risk Index Calculation
            </div>
            <p>
              <span className="text-slate-300">Base score</span> = min(100, heavy_veh_day / 1000 × 100).
              Multiplied by surface vulnerability: unpaved ×1.3, Class&nbsp;C ×1.2.
              Sources: SATCC/TRH4 ESAL factors · AFCAP Uganda overloading surveys
              (+25% HGV, +10% bus) · UNRA traffic count surveys 2017–2025.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
