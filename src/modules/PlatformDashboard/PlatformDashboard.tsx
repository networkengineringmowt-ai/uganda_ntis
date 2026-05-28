import { useEffect, useState, useMemo } from 'react';
import {
  AlertTriangle, CheckCircle2,
  Construction, Map, Truck, ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from 'recharts';
import { useBMS } from '../../store/BMSContext';
import { loadPlatformAnalytics, type PlatformAnalytics } from '../../data/platformData';
import type { ActiveView } from '../../types';
import { NEON, REGION_NEON, Bar3D, GlowDefs, Chart3DWrap, AreaGradDefs, TT_NEON, TICK, AX_LINE } from '../../lib/chart3d';

export default function PlatformDashboard() {
  const { navigate, state } = useBMS();
  const { structures } = state;
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
    <div className="flex-1 overflow-y-auto p-5 space-y-5 animate-fade-in">

      {/* ── Platform banner ── */}
      <div
        className="rounded-2xl bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80
                    border border-blue-700/30 px-6 py-5 flex items-center gap-6"
        style={{ borderLeft: '3px solid rgba(0,245,255,0.4)' }}
      >
        <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
          <Map size={28} className="text-blue-400" />
        </div>
        <div className="flex-1">
          <div className="text-xl font-black text-white tracking-tight">
            Uganda National Roads Management Platform
          </div>
          <div className="text-sm text-slate-400 mt-0.5">
            Department of National Roads · Ministry of Works and Transport
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"/> National Network: <strong className="text-white ml-1">{a ? `${a.totalNetworkKm.toLocaleString(undefined, {maximumFractionDigits:0})} km` : '21,292 km'}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500"/> Paved: <strong className="text-white ml-1">{a ? `${a.pavedKm.toLocaleString(undefined, {maximumFractionDigits:0})} km (${a.percentPaved.toFixed(1)}%)` : '6,312 km'}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"/> Unsealed: <strong className="text-white ml-1">{a ? `${a.unsealedKm.toLocaleString(undefined, {maximumFractionDigits:0})} km` : '14,979 km'}</strong>
            </span>
          </div>
        </div>
        <div className="hidden lg:flex gap-2">
          <QuickLink label="Road Network" icon={<Map size={14}/>} onClick={() => nav('roadnetwork')} />
          <QuickLink label="Projects" icon={<Construction size={14}/>} onClick={() => nav('projects')} />
          <QuickLink label="Traffic" icon={<Truck size={14}/>} onClick={() => nav('traffic')} />
        </div>
      </div>

      {/* ── Top KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BigKPI label="Total Network" value={a ? `${(a.totalNetworkKm/1000).toFixed(2)}k km` : '21.3k km'}
          sub="National roads" icon={<Map size={20}/>} color="blue" onClick={() => nav('roadnetwork')} />
        <BigKPI label="Paved Roads" value={a ? `${a.pavedKm.toLocaleString(undefined,{maximumFractionDigits:0})} km` : '6,312 km'}
          sub={`${a ? a.percentPaved.toFixed(1) : '29.6'}% of network`} icon={<CheckCircle2 size={20}/>} color="green" onClick={() => nav('roadcondition')} />
        <BigKPI label="Active Projects" value={String(a?.activeProjects ?? 26)}
          sub={`${a ? a.projectsKm.toLocaleString(undefined,{maximumFractionDigits:0}) : '1,384'} km under development`}
          icon={<Construction size={20}/>} color="amber" onClick={() => nav('projects')} />
        <BigKPI label="Network Traffic" value={a ? `${Math.round(a.trafficYears.find(t=>t.year===2025)?.network_weighted_motorised_aadt ?? 2562)} AADT` : '2,562 AADT'}
          sub="Motorised vehicles (2025)" icon={<Truck size={20}/>} color="purple" onClick={() => nav('traffic')} />
      </div>

      {/* ── Condition KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SmallKPI label="Paved Condition" value={`${a?.pavedFairToGoodPct ?? 94.2}%`} sub="Fair to good (2023/24)" color="green" />
        <SmallKPI label="Unpaved Condition" value={`${a?.unpavedFairToGoodPct ?? 62}%`} sub="Fair to good (2023/24)" color="amber" />
        <SmallKPI label="Inspections Overdue" value={String(bridgeStats.overdue)} sub="Structure inspections" color="amber" onClick={() => nav('inspections')} />
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Paved stock growth */}
        <div className="bms-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-white">Paved Road Stock Growth</div>
              <div className="text-[10px] text-slate-500">NDP II & III (2015/16 – 2022/23)</div>
            </div>
            <button onClick={() => nav('roadcondition')} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
              Full report <ArrowRight size={10}/>
            </button>
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
            <button onClick={() => nav('traffic')} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
              Detail <ArrowRight size={10}/>
            </button>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Regional paved km */}
        <div className="bms-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold text-white">Paved Road Length by Region</div>
            <button onClick={() => nav('roadnetwork')} className="text-[10px] text-blue-400 hover:text-blue-300">Map →</button>
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
