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
    loadPlatformAnalytics().then(setAnalytics).catch(console.error);
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
            { label:'Bridges',     value: structures.filter(s=>s.type==='bridge').length,  icon:'●', color:'text-blue-400',  view:'registry' as ActiveView },
            { label:'Culverts',    value: structures.filter(s=>s.type==='culvert').length, icon:'◆', color:'text-cyan-400',  view:'registry' as ActiveView },
            { label:'Critical',    value: bridgeStats.critical,  icon:'!', color:'text-red-400',   view:'priority' as ActiveView },
            { label:'Insp. Due',   value: bridgeStats.overdue,   icon:'⏰', color:'text-amber-400', view:'inspections' as ActiveView },
          ].map(item => (
            <button key={item.label} onClick={() => nav(item.view)}
              className="bg-slate-700/40 hover:bg-slate-600 rounded-xl p-4 text-left transition-colors group">
              <div className={`text-2xl font-black ${item.color}`}>{item.value}</div>
              <div className="text-xs text-slate-400 mt-1 group-hover:text-slate-300">{item.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function BigKPI({ label, value, sub, icon, color, onClick }: {
  label: string; value: string; sub: string; icon: React.ReactNode;
  color: 'blue'|'green'|'amber'|'purple'|'red'; onClick?: ()=>void;
}) {
  const cls = {
    blue:   { bg:'bg-blue-500/10',   ic:'bg-blue-500/20 text-blue-400',   tx:'text-blue-400' },
    green:  { bg:'bg-green-500/10',  ic:'bg-green-500/20 text-green-400', tx:'text-green-400' },
    amber:  { bg:'bg-amber-500/10',  ic:'bg-amber-500/20 text-amber-400', tx:'text-amber-400' },
    purple: { bg:'bg-purple-500/10', ic:'bg-purple-500/20 text-purple-400', tx:'text-purple-400' },
    red:    { bg:'bg-red-500/10',    ic:'bg-red-500/20 text-red-400',     tx:'text-red-400' },
  }[color];
  return (
    <div className={`bms-card flex items-start gap-3 ${onClick?'cursor-pointer hover:bg-slate-700 transition-colors':''}`} onClick={onClick}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cls.ic}`}>{icon}</div>
      <div className="min-w-0">
        <div className={`text-xl font-black leading-tight ${cls.tx}`}>{value}</div>
        <div className="text-xs font-semibold text-slate-300 mt-0.5">{label}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function SmallKPI({ label, value, sub, color, onClick }: {
  label: string; value: string; sub: string; color: 'green'|'amber'|'red'|'blue'; onClick?: ()=>void;
}) {
  const tx = { green:'text-green-400', amber:'text-amber-400', red:'text-red-400', blue:'text-blue-400' }[color];
  return (
    <div className={`bms-card ${onClick?'cursor-pointer hover:bg-slate-700 transition-colors':''}`} onClick={onClick}>
      <div className={`text-2xl font-black ${tx}`}>{value}</div>
      <div className="text-xs font-semibold text-slate-300 mt-1">{label}</div>
      <div className="text-[10px] text-slate-500">{sub}</div>
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
