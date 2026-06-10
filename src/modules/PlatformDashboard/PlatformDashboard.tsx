import { useEffect, useState, useMemo, useRef } from 'react';
import {
  AlertTriangle, CheckCircle2,
  Construction, Map, Truck, ArrowRight,
  CheckCircle, AlertCircle, XCircle, Shield, Globe, Activity,
  Network as NetworkIcon, TrendingUp, BarChart3, Layers, Database, BookOpen,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from 'recharts';
import { useBMS } from '../../store/BMSContext';
import { loadPlatformAnalytics, type PlatformAnalytics } from '../../data/platformData';
import { useSectionData } from '../../hooks/useSectionData';
import type { ActiveView } from '../../types';
import { NEON, REGION_NEON, Bar3D, GlowDefs, Chart3DWrap, AreaGradDefs, TT_NEON, TICK, AX_LINE } from '../../lib/chart3d';
import SourceTableButton from '../../shared/SourceTableButton';

// ── RMS-style module health + quick-nav data (Network Overview context) ──────
const NETWORK_MODULE_HEALTH: { id: string; name: string; status: 'ok' | 'warn' | 'info'; note: string; view: ActiveView }[] = [
  { id: 'NETMAP',  name: 'Road Network Map',         status: 'ok',   note: '21,302 km · GeoJSON live · NDPIV FY25/26 mapping current', view: 'roadnetwork' },
  { id: 'STORY',   name: 'Network Story',            status: 'ok',   note: 'Scrollytelling narrative 1986 → present loaded',            view: 'networkstory' },
  { id: 'PMS',     name: 'Pavement Management (PMS)', status: 'ok',  note: 'Condition survey 2023/24; calibration current',             view: 'roadcondition' },
  { id: 'BMS',     name: 'Bridge Management (BMS)',  status: 'ok',   note: '1,019 structures registered; inspections tracked',          view: 'bms' },
  { id: 'TIS',     name: 'Traffic Information (TIS)', status: 'ok',  note: '25 ATC stations active; 2025 count data loaded',            view: 'traffic' },
  { id: 'NDPIV',   name: 'Projects & NDP IV',        status: 'warn', note: '8/14 projects behind schedule; financial data Q3 2025',     view: 'projects' },
  { id: 'ARCH',    name: 'Platform Architecture',    status: 'ok',   note: 'System architecture diagram v2.0 — current build',          view: 'mlarchitecture' },
];

const NETWORK_QUICK_NAV: Array<{ label: string; icon: React.ReactNode; view: ActiveView; color: string }> = [
  { label: 'RMS — Road Mgmt System', icon: <Shield size={14}/>,      view: 'rms' as ActiveView,         color: '#00f5ff' },
  { label: 'Pavement Mgmt (PMS)',    icon: <Activity size={14}/>,    view: 'roadcondition',             color: '#ff6b35' },
  { label: 'Bridge Mgmt (BMS)',      icon: <NetworkIcon size={14}/>, view: 'bms',                       color: '#4d9fff' },
  { label: 'Traffic Info (TIS)',     icon: <TrendingUp size={14}/>,  view: 'traffic',                   color: '#00f5ff' },
  { label: 'HDM-4 Analysis',         icon: <BarChart3 size={14}/>,   view: 'hdm4',                      color: '#b967ff' },
  { label: 'NDPIV / Projects',       icon: <Layers size={14}/>,      view: 'projects',                  color: '#00ff88' },
  { label: 'Budget & Maint.',        icon: <Database size={14}/>,    view: 'budget',                    color: '#ffd23f' },
  { label: 'Lifecycle Mgmt',         icon: <Shield size={14}/>,      view: 'lifecycle',                 color: '#00d4aa' },
  { label: 'Sources & Evidence',     icon: <BookOpen size={14}/>,    view: 'sources',                   color: '#94a3b8' },
];

// ── Shared RMS-style UI atoms (definition chip + animated stat tile) ─────────
function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 8, padding: '2px 7px', borderRadius: 4, fontWeight: 800,
      background: `rgba(${hexRgb(color)},0.12)`, color,
      border: `1px solid rgba(${hexRgb(color)},0.2)`,
    }}>{label}</span>
  );
}

function useCountUp(target: number, duration = 900): number {
  const [count, setCount] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setCount(Math.round(eased * target));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return count;
}

function StatTile({ label, value, unit, color, tooltip, navChips, onNav }: {
  label: string; value: string; unit?: string; color: string; tooltip?: string;
  navChips?: Array<{ label: string; view: ActiveView }>;
  onNav: (v: ActiveView) => void;
}) {
  const numericPart = parseFloat(value.replace(/[^0-9.]/g, ''));
  const prefix = value.match(/^[^0-9]*/)?.[0] ?? '';
  const suffix = value.match(/[^0-9.]+$/)?.[0] ?? '';
  const isNumeric = !isNaN(numericPart) && value.trim() !== '';
  const animated = useCountUp(isNumeric ? numericPart : 0);
  const displayValue = isNumeric ? `${prefix}${animated.toLocaleString()}${suffix}` : value;

  return (
    <div
      title={tooltip}
      style={{
        background: `rgba(${hexRgb(color)},0.06)`,
        border: `1px solid rgba(${hexRgb(color)},0.2)`,
        borderRadius: 10, padding: '11px 14px',
        cursor: tooltip ? 'help' : 'default',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 16px rgba(${hexRgb(color)},0.15)`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
    >
      <div style={{ fontSize: 21, fontWeight: 900, color, lineHeight: 1 }}>
        {displayValue}<span style={{ fontSize: 11, fontWeight: 500, marginLeft: 3 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)',
        marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.09em' }}>{label}</div>
      {navChips && navChips.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
          {navChips.map(chip => (
            <button key={chip.view} onClick={(e) => { e.stopPropagation(); onNav(chip.view); }}
              style={{
                fontSize: 8, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                background: `rgba(${hexRgb(color)},0.15)`, border: `1px solid rgba(${hexRgb(color)},0.3)`,
                color, fontWeight: 700,
              }}>
              → {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlatformDashboard() {
  const { navigate, state } = useBMS();
  const { structures } = state;
  const { networkSummary } = useSectionData();
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);

  useEffect(() => {
    loadPlatformAnalytics().then(setAnalytics).catch(() => {});
  }, []);

  const bridgeStats = useMemo(() => {
    const critical = structures.filter(s => s.conditionRating <= 2).length;
    const overdue  = structures.filter(s => s.inspectionDue).length;
    return { critical, overdue };
  }, [structures]);

  const a = analytics;

  // Paved stock area chart data
  const pavedStock = a?.wtssTimeline.map(w => ({
    year:    w.financial_year.replace('/2', '/'),
    km:      w.stock_of_paved_roads_km,
    pct:     w.percent_paved_network,
    ndp:     w.ndp,
  })) ?? [];

  // Traffic AADT trend
  const trafficTrend = a?.trafficYears.map(t => ({
    year:     String(t.year),
    motorised: Math.round(t.network_weighted_motorised_aadt),
    nmot:     Math.round(t.network_weighted_non_motorised_aadt),
  })) ?? [];

  // Region breakdown (paved km)
  const regionData = a
    ? Object.entries(a.regionPavedKm).map(([region, km]) => ({ region, km: Math.round(km) })).sort((a, b) => b.km - a.km)
    : [];

  function nav(v: ActiveView) { navigate(v); }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 animate-fade-in">

      {/* ── Definition card (RMS-style) ── */}
      <div style={{
        background: 'rgba(77,159,255,0.04)',
        border: '1px solid rgba(77,159,255,0.15)',
        borderRadius: 14, padding: '14px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(77,159,255,0.2), rgba(0,245,255,0.1))',
            border: '1px solid rgba(77,159,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Map size={20} style={{ color: '#4d9fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#e2eaf4', marginBottom: 6 }}>
              Uganda National Roads Management Platform — Network Overview
            </div>
            <div style={{ fontSize: 12, color: 'rgba(203,213,225,0.8)', lineHeight: 1.7 }}>
              The <strong style={{ color: '#4d9fff' }}>DNR Road Network Repository</strong> consolidates Uganda's
              full <strong>21,302 km</strong> national road network — paved and unsealed links, bridges, traffic
              count stations, and project pipelines — into a single GIS-integrated platform for the Department of
              National Roads (DNR), Ministry of Works and Transport. Use the tabs above to explore the live road
              network map, the network's historical story (1986 → present), and the platform's system architecture.
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['GIS Integrated', 'NDPIV FY25/26', 'GeoJSON Live', 'ML-Enhanced', '6 Regions · 23 Stations'].map(t => (
                <Chip key={t} label={t} color="#4d9fff" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat tiles (RMS-style animated KPI banner) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
        <StatTile label="Total Network" value="21302" unit="km" color="#4d9fff" onNav={nav}
          tooltip="Official NDPIV FY 2025/26 figure · 6 regions · 23 maintenance stations · Source: MoWT/DNR"
          navChips={[{ label: 'Road Network', view: 'roadnetwork' }]} />
        <StatTile label="Paved Roads" value="6405" unit="km" color="#00ff88" onNav={nav}
          tooltip="6,405 km paved (bituminous + DBST) · 30.1% of national network"
          navChips={[{ label: 'Condition', view: 'roadcondition' }]} />
        <StatTile label="Total Links" value="1013" unit="" color="#ffd23f" onNav={nav}
          tooltip={`${structures.filter(s => s.type === 'bridge').length || 483} bridges · ${networkSummary?.stations_count || 23} stations · GeoJSON-mapped (142 km gap)`}
          navChips={[{ label: 'GIS Map', view: 'roadnetwork' }]} />
        <StatTile label="Avg Condition" value={String(networkSummary?.avg_iri_national || 3.31)} unit="IRI" color="#b967ff" onNav={nav}
          tooltip="International Roughness Index — network-wide weighted average"
          navChips={[{ label: 'Traffic', view: 'traffic' }]} />
        <StatTile label="Paved Condition" value={String(a?.pavedFairToGoodPct ?? 94.2)} unit="%" color="#00ff88" onNav={nav}
          tooltip="Paved network rated fair-to-good · National roads assessment FY 2023/24" />
        <StatTile label="Inspections Due" value={String(bridgeStats.overdue)} unit="" color="#ffd23f" onNav={nav}
          tooltip="Structure inspections overdue across the network"
          navChips={[{ label: 'Inspections', view: 'inspections' }]} />
      </div>

      {/* ── Network figures consistency banner ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
        background: 'rgba(77,159,255,0.04)', border: '1px solid rgba(77,159,255,0.1)',
        borderRadius: 8, padding: '7px 12px', fontSize: 10,
      }}>
        <span style={{ color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 6 }}>Network Figures</span>
        <span style={{ color: '#4d9fff', fontWeight: 800 }}>Official: 21,302 km</span>
        <span style={{ color: 'rgba(148,163,184,0.35)', margin: '0 6px' }}>|</span>
        <span style={{ color: 'rgba(148,163,184,0.7)' }}>Source: NDPIV FY25-26 (MoWT)</span>
        <span style={{ color: 'rgba(148,163,184,0.35)', margin: '0 6px' }}>|</span>
        <span style={{ color: '#00d4aa', fontWeight: 800 }}>Mapped in GeoJSON: 21,160 km (1,013 links)</span>
        <span style={{ color: 'rgba(148,163,184,0.35)', margin: '0 6px' }}>|</span>
        <span style={{ color: '#ffd23f' }}>Gap: 142 km (unmapped/rural)</span>
        <span style={{ color: 'rgba(148,163,184,0.35)', margin: '0 6px' }}>|</span>
        <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 9 }}>Condition % based on surveyed links only</span>
      </div>

      {/* ── System health + Quick navigation (RMS-style 2-column) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* System Health */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#4d9fff',
            marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            System Health — Module Status
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {NETWORK_MODULE_HEALTH.map(m => {
              const color = m.status === 'ok' ? '#00ff88' : m.status === 'warn' ? '#ffd23f' : '#94a3b8';
              const Icon  = m.status === 'ok' ? CheckCircle : m.status === 'warn' ? AlertCircle : XCircle;
              return (
                <button key={m.id} onClick={() => nav(m.view)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 13px', borderRadius: 9,
                  background: `rgba(${hexRgb(color)},0.05)`,
                  border: `1px solid rgba(${hexRgb(color)},0.15)`,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  <Icon size={14} style={{ color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#d4dde8' }}>{m.name}</div>
                    <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.7)', marginTop: 1 }}>{m.note}</div>
                  </div>
                  <ArrowRight size={11} style={{ color: 'rgba(100,116,139,0.4)', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Navigation grid */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#4d9fff',
            marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Quick Navigation — All Modules
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {NETWORK_QUICK_NAV.map(q => (
              <button key={q.view} onClick={() => nav(q.view)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px', borderRadius: 8,
                background: `rgba(${hexRgb(q.color)},0.06)`,
                border: `1px solid rgba(${hexRgb(q.color)},0.2)`,
                cursor: 'pointer', color: '#d4dde8', fontSize: 11, fontWeight: 600,
              }}>
                <span style={{ color: q.color }}>{q.icon}</span>
                <span>{q.label}</span>
                <ArrowRight size={10} style={{ color: 'rgba(100,116,139,0.4)', marginLeft: 'auto' }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Paved stock growth */}
        <div className="bms-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-white">Paved Road Stock Growth</div>
              <div className="text-[10px] text-slate-500">NDP II & III (2015/16 – 2022/23)</div>
            </div>
            <div className="flex items-center gap-2">
              <SourceTableButton anchor="tbl-005" />
              <button onClick={() => nav('roadcondition')} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                Full report <ArrowRight size={10}/>
              </button>
            </div>
          </div>
          <Chart3DWrap>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={pavedStock} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <AreaGradDefs id="pgPlatform" color="#00ff88" />
                <GlowDefs id="pgp" />
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
                <XAxis dataKey="year" tick={{ fill:'rgba(148,163,184,0.5)', fontSize:9 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:'rgba(148,163,184,0.5)', fontSize:9 }} axisLine={false} tickLine={false} width={46}
                  tickFormatter={(v:number) => `${v.toLocaleString()}`}/>
                <Tooltip {...TT_NEON} formatter={(v:number) => [`${v.toLocaleString()} km`, 'Paved stock']}/>
                <Area type="monotone" dataKey="km" stroke="#00ff88" strokeWidth={2} fill="url(#pgPlatform)" dot={{ fill:'#00ff88', r:3 }} animationDuration={1000}/>
              </AreaChart>
            </ResponsiveContainer>
          </Chart3DWrap>
          {pavedStock.length > 0 && (
            <div className="mt-2 text-[10px] text-slate-500 text-right">
              Latest: {pavedStock[pavedStock.length-1]?.km?.toLocaleString()} km ({pavedStock[pavedStock.length-1]?.pct}%)
            </div>
          )}
        </div>

        {/* Traffic AADT trend */}
        <div className="bms-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-white">Network Traffic Growth</div>
              <div className="text-[10px] text-slate-500">Length-weighted motorised AADT</div>
            </div>
            <div className="flex items-center gap-2">
              <SourceTableButton anchor="tbl-008" />
              <button onClick={() => nav('traffic')} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                Detail <ArrowRight size={10}/>
              </button>
            </div>
          </div>
          <Chart3DWrap>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trafficTrend} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
                <XAxis dataKey="year" tick={{ fill:'rgba(148,163,184,0.5)', fontSize:9 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:'rgba(148,163,184,0.5)', fontSize:9 }} axisLine={false} tickLine={false} width={46}/>
                <Tooltip {...TT_NEON} formatter={(v:number, name:string) => [v.toLocaleString(), name === 'motorised' ? 'Motorised AADT' : 'Non-motorised AADT']}/>
                <Bar dataKey="motorised" fill="#4d9fff" radius={[4,4,0,0]} animationDuration={1000} shape={<Bar3D />}/>
                <Bar dataKey="nmot" fill="rgba(148,163,184,0.4)" radius={[4,4,0,0]} animationDuration={1000} shape={<Bar3D />}/>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
          {a && (
            <div className="mt-2 flex gap-3 text-[10px] text-slate-500">
              <span>2017→2025 motorised growth: <strong className="text-green-400">+{((( a.trafficYears.find(t=>t.year===2025)?.network_weighted_motorised_aadt??2562) / (a.trafficYears.find(t=>t.year===2017)?.network_weighted_motorised_aadt??1733) -1)*100).toFixed(1)}%</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Regional paved km */}
        <div className="bms-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold text-white">Paved Road Length by Region</div>
            <div className="flex items-center gap-2">
              <SourceTableButton anchor="tbl-003" />
              <button onClick={() => nav('roadnetwork')} className="text-[10px] text-blue-400 hover:text-blue-300">Map →</button>
            </div>
          </div>
          <Chart3DWrap>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={regionData} layout="vertical" margin={{ top: 0, right: 16, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" horizontal={false}/>
                <XAxis type="number" tick={{ fill:'rgba(148,163,184,0.5)', fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={(v:number)=>`${v}km`}/>
                <YAxis type="category" dataKey="region" tick={{ fill:'rgba(148,163,184,0.5)', fontSize:9 }} axisLine={false} tickLine={false} width={58}/>
                <Tooltip {...TT_NEON} formatter={(v:number) => [`${v.toLocaleString()} km`, 'Paved']}/>
                <Bar dataKey="km" radius={[0,4,4,0]} animationDuration={1000} shape={<Bar3D />}>
                  {regionData.map(r => (
                    <Cell key={r.region} fill={REGION_NEON[r.region] ?? '#475569'}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>

        {/* Network Condition */}
        <div className="bms-card">
          <div className="text-sm font-bold text-white mb-4">Network Condition</div>
          <div className="space-y-3">
            {[
              { label:'Paved fair-to-good',   pct: a?.pavedFairToGoodPct ?? 94.2,                     color:'#00ff88' },
              { label:'Paved poor',            pct: 100 - (a?.pavedFairToGoodPct ?? 94.2),             color:'#ff2d78' },
              { label:'Unpaved fair-to-good',  pct: a?.unpavedFairToGoodPct ?? 62.0,                   color:'#ffd23f' },
              { label:'Unpaved poor',          pct: 100 - (a?.unpavedFairToGoodPct ?? 62.0),           color:'#ff2d78' },
            ].map(c => (
              <div key={c.label}>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>{c.label}</span>
                  <span style={{ color: c.color }}>{c.pct.toFixed(1)}%</span>
                </div>
                <div className="bg-slate-700 rounded-full h-2">
                  <div className="rounded-full h-2 transition-all" style={{ width:`${c.pct}%`, background: c.color }}/>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700 text-[10px] text-slate-500">
            National roads assessment survey · FY 2023/24
          </div>
        </div>
      </div>

      {/* ── RMS Quick-access ── */}
      <div className="bms-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-bold text-white">Bridge Management System</div>
            <div className="text-[10px] text-slate-500">DNR BMS · {structures.length} structures across the national network</div>
          </div>
          <button onClick={() => nav('dashboard')} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
            Open BMS <ArrowRight size={10}/>
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label:'Bridges',    value: structures.filter(s=>s.type==='bridge').length,  hex:'#4d9fff', view:'registry'    as ActiveView },
            { label:'Culverts',   value: structures.filter(s=>s.type==='culvert').length, hex:'#00f5ff', view:'registry'    as ActiveView },
            { label:'Critical',   value: bridgeStats.critical,                            hex:'#ff2d78', view:'priority'    as ActiveView },
            { label:'Insp. Due',  value: bridgeStats.overdue,                             hex:'#ffd23f', view:'inspections' as ActiveView },
          ].map(item => {
            const rgb = hexRgb(item.hex);
            return (
              <button key={item.label} onClick={() => nav(item.view)} style={{
                background:`rgba(${rgb},0.08)`, border:`1px solid rgba(${rgb},0.2)`,
                borderLeft:`3px solid ${item.hex}`, borderRadius:12,
                padding:'14px 16px', textAlign:'left', cursor:'pointer',
                boxShadow:`0 0 14px rgba(${rgb},0.08)`, transition:'box-shadow .2s',
              }}>
                <div style={{ fontSize:26, fontWeight:900, color:item.hex,
                  textShadow:`0 0 14px rgba(${rgb},0.6)`,
                  fontVariantNumeric:'tabular-nums' }}>{item.value}</div>
                <div style={{ fontSize:11, color:'rgba(148,163,184,0.65)', marginTop:4 }}>{item.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Neon colour map ───────────────────────────────────────────────────────────
const NEON_MAP: Record<string, string> = {
  blue:   '#4d9fff', green: '#00ff88', amber: '#ffd23f',
  purple: '#b967ff', red:   '#ff2d78', cyan:  '#00f5ff', teal: '#00d4aa',
};
function hexRgb(h: string): string {
  const c = h.replace('#','');
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function BigKPI({ label, value, sub, icon, color, onClick }: {
  label: string; value: string; sub: string; icon: React.ReactNode;
  color: 'blue'|'green'|'amber'|'purple'|'red'; onClick?: ()=>void;
}) {
  const hex = NEON_MAP[color] ?? '#4d9fff';
  const rgb = hexRgb(hex);
  return (
    <div onClick={onClick} style={{
      background:`rgba(${rgb},0.07)`,
      border:`1px solid rgba(${rgb},0.18)`,
      borderLeft:`4px solid ${hex}`,
      borderRadius:14, padding:'16px 18px',
      cursor: onClick ? 'pointer' : 'default',
      boxShadow:`0 0 22px rgba(${rgb},0.12), inset 0 1px 0 rgba(255,255,255,0.04)`,
      backdropFilter:'blur(20px)',
      display:'flex', alignItems:'flex-start', gap:12,
      transition:'box-shadow .2s',
    }}>
      <div style={{ width:38, height:38, borderRadius:10,
        background:`rgba(${rgb},0.15)`, border:`1px solid rgba(${rgb},0.25)`,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:hex }}>
        {icon}
      </div>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:22, fontWeight:900, color:hex, lineHeight:1.1,
          fontVariantNumeric:'tabular-nums',
          textShadow:`0 0 18px rgba(${rgb},0.65)` }}>{value}</div>
        <div style={{ fontSize:12, fontWeight:700, color:'#e2eaf4', marginTop:2 }}>{label}</div>
        <div style={{ fontSize:10, color:'rgba(148,163,184,0.5)', marginTop:1 }}>{sub}</div>
      </div>
    </div>
  );
}

function SmallKPI({ label, value, sub, color, onClick }: {
  label: string; value: string; sub: string; color: 'green'|'amber'|'red'|'blue'; onClick?: ()=>void;
}) {
  const hex = NEON_MAP[color] ?? '#4d9fff';
  const rgb = hexRgb(hex);
  return (
    <div onClick={onClick} style={{
      background:`rgba(${rgb},0.07)`,
      border:`1px solid rgba(${rgb},0.16)`,
      borderLeft:`4px solid ${hex}`,
      borderRadius:14, padding:'14px 18px',
      cursor: onClick ? 'pointer' : 'default',
      boxShadow:`0 0 16px rgba(${rgb},0.09)`,
      backdropFilter:'blur(20px)',
    }}>
      <div style={{ fontSize:26, fontWeight:900, color:hex, lineHeight:1.1,
        fontVariantNumeric:'tabular-nums',
        textShadow:`0 0 16px rgba(${rgb},0.6)` }}>{value}</div>
      <div style={{ fontSize:12, fontWeight:700, color:'#e2eaf4', marginTop:4 }}>{label}</div>
      <div style={{ fontSize:10, color:'rgba(148,163,184,0.5)', marginTop:1 }}>{sub}</div>
    </div>
  );
}

function QuickLink({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: ()=>void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                 bg-slate-700/60 hover:bg-slate-600 text-slate-300 transition-colors">
      {icon}{label}
    </button>
  );
}
