import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts';
import { Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import { loadPlatformAnalytics, type PlatformAnalytics } from '../../data/platformData';
import { NEON, REGION_NEON, Bar3D, GlowDefs, Chart3DWrap, AreaGradDefs, TT_NEON, TICK, AX_LINE } from '../../lib/chart3d';

export default function RoadConditionView() {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);

  useEffect(() => {
    loadPlatformAnalytics().then(setAnalytics).catch(console.error);
  }, []);

  const a = analytics;

  const wtssData = a?.wtssTimeline.map(w => ({
    year:    w.financial_year,
    km:      w.stock_of_paved_roads_km,
    added:   w.annual_increase_km,
    pct:     w.percent_paved_network,
    ndp:     w.ndp,
  })) ?? [];

  const regionPaved = a
    ? Object.entries(a.regionPavedKm)
        .map(([region, km]) => ({ region, km: Math.round(km) }))
        .sort((a, b) => b.km - a.km)
    : [];

  const conditionSummary = [
    { label:'Paved — Excellent/Good', pct: a?.pavedFairToGoodPct ?? 94.2, color:'#00ff88', bg:'bg-green-500/10', border:'border-green-500/20' },
    { label:'Paved — Poor/Bad',       pct: 100 - (a?.pavedFairToGoodPct ?? 94.2), color:'#ff2d78', bg:'bg-red-500/10', border:'border-red-500/20' },
    { label:'Unpaved — Fair/Good',    pct: a?.unpavedFairToGoodPct ?? 62, color:'#ffd23f', bg:'bg-amber-500/10', border:'border-amber-500/20' },
    { label:'Unpaved — Poor',         pct: 100 - (a?.unpavedFairToGoodPct ?? 62), color:'#ff2d78', bg:'bg-red-900/20', border:'border-red-800/30' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
          <Activity size={20} className="text-green-400"/>
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Road Condition</h1>
          <p className="text-xs text-slate-400">Pavement stock, condition indices, and NDP-period growth</p>
        </div>
      </div>

      {/* ── Condition KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bms-card border-l-4 border-green-500">
          <div className="text-2xl font-black text-green-400">{a?.pavedFairToGoodPct ?? 94.2}%</div>
          <div className="text-xs font-semibold text-slate-300 mt-1">Paved Roads — Fair to Good</div>
          <div className="text-[10px] text-slate-500">FY 2023/24 condition survey</div>
        </div>
        <div className="bms-card border-l-4 border-amber-500">
          <div className="text-2xl font-black text-amber-400">{a?.unpavedFairToGoodPct ?? 62}%</div>
          <div className="text-xs font-semibold text-slate-300 mt-1">Unpaved Roads — Fair to Good</div>
          <div className="text-[10px] text-slate-500">FY 2023/24 condition survey</div>
        </div>
        <div className="bms-card border-l-4" style={{ borderColor: '#00f5ff' }}>
          <div className="text-2xl font-black" style={{ color: '#00f5ff' }}>{a ? `${a.pavedKm.toLocaleString(undefined,{maximumFractionDigits:0})} km` : '6,312 km'}</div>
          <div className="text-xs font-semibold text-slate-300 mt-1">Paved Network Length</div>
          <div className="text-[10px] text-slate-500">July 2025 inventory</div>
        </div>
        <div className="bms-card border-l-4" style={{ borderColor: '#b967ff' }}>
          <div className="text-2xl font-black" style={{ color: '#b967ff' }}>{a ? `${a.percentPaved.toFixed(1)}%` : '29.6%'}</div>
          <div className="text-xs font-semibold text-slate-300 mt-1">Paved Share of Network</div>
          <div className="text-[10px] text-slate-500">21,292 km total national network</div>
        </div>
      </div>

      {/* ── Condition bars ── */}
      <div className="bms-card">
        <div className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-400"/> Condition Overview (FY 2023/24)
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {conditionSummary.map(c => (
            <div key={c.label} className={`rounded-xl p-4 border ${c.bg} ${c.border}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-300">{c.label}</span>
                <span className="text-xl font-black" style={{ color: c.color }}>{c.pct.toFixed(1)}%</span>
              </div>
              <div className="bg-slate-700/60 rounded-full h-3">
                <div className="rounded-full h-3 transition-all" style={{ width:`${c.pct}%`, background: c.color }}/>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-[10px] text-slate-600">
          Source: OPM Infrastructure Development Cluster NAPR 2023/24
        </div>
      </div>

      {/* ── Paved stock growth ── */}
      <div className="bms-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-bold text-white">Paved Road Stock Growth (NDP II & III)</div>
            <div className="text-[10px] text-slate-500">Annual additions to the paved national road network</div>
          </div>
        </div>
        <Chart3DWrap>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={wtssData} margin={{ top: 8, right: 20, left: 8, bottom: 0 }}>
              <AreaGradDefs id="rcGreen" color="#00ff88" />
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
              <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false}/>
              <YAxis tick={TICK} axisLine={false} tickLine={false} width={52}
                tickFormatter={(v:number) => `${v.toLocaleString()}`}/>
              <Tooltip {...TT_NEON}
                formatter={(v: number, name: string) => [
                  name === 'km' ? `${v.toLocaleString()} km total paved` : `+${v.toLocaleString()} km added`,
                  name === 'km' ? 'Paved stock' : 'Annual addition',
                ]}
              />
              <ReferenceLine y={5000} stroke="#475569" strokeDasharray="4 4" label={{ value:'5,000 km', fill:'#64748b', fontSize:9 }}/>
              <Area
                type="monotone"
                dataKey="km"
                stroke="#00ff88"
                strokeWidth={2.5}
                fill="url(#rcGreen)"
                dot={{ fill: '#00ff88', r: 4 }}
                animationDuration={1100}
                filter="url(#rcGreenglow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Chart3DWrap>

        {/* NDP period chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {['NDP II', 'NDP III'].map(ndp => {
            const items = wtssData.filter(w => w.ndp === ndp);
            const total = items.reduce((sum, w) => sum + (w.added || 0), 0);
            return (
              <div key={ndp} className="bg-slate-700/60 rounded-lg px-3 py-2 text-center">
                <div className="text-sm font-black text-white">{total.toFixed(0)} km</div>
                <div className="text-[9px] text-slate-400">{ndp} additions</div>
                <div className="text-[9px] text-slate-500">{items[0]?.year} – {items[items.length-1]?.year}</div>
              </div>
            );
          })}
          <div className="bg-slate-700/60 rounded-lg px-3 py-2 text-center">
            <div className="text-sm font-black text-white">
              {a ? `${a.percentPaved.toFixed(1)}%` : '29.6%'}
            </div>
            <div className="text-[9px] text-slate-400">of network paved</div>
            <div className="text-[9px] text-slate-500">July 2025</div>
          </div>
        </div>
      </div>

      {/* ── Annual additions bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bms-card">
          <div className="text-sm font-bold text-white mb-4">Annual Paving Additions (km)</div>
          <Chart3DWrap>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={wtssData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
                <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false}/>
                <YAxis tick={TICK} axisLine={false} tickLine={false} width={40}/>
                <Tooltip {...TT_NEON} formatter={(v:number) => [`+${v.toLocaleString()} km`, 'Paved added']}/>
                <Bar dataKey="added" radius={[4,4,0,0]} animationDuration={1000} shape={<Bar3D />}>
                  {wtssData.map(w => (
                    <Cell key={w.year}
                      fill={w.ndp === 'NDP II' ? '#4d9fff' : '#00ff88'}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
          <div className="mt-2 flex gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded inline-block" style={{ background: '#4d9fff' }}/> NDP II
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded inline-block" style={{ background: '#00ff88' }}/> NDP III
            </span>
          </div>
        </div>

        {/* Region paved breakdown */}
        <div className="bms-card">
          <div className="text-sm font-bold text-white mb-4">Paved km by Region (July 2025)</div>
          <div className="space-y-2">
            {regionPaved.map(r => (
              <div key={r.region}>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: REGION_NEON[r.region] ?? '#4d9fff'}}/>
                    {r.region}
                  </span>
                  <span className="text-slate-400">{r.km.toLocaleString()} km</span>
                </div>
                <div className="bg-slate-700 rounded-full h-2">
                  <div className="rounded-full h-2 transition-all" style={{
                    width: `${(r.km / (regionPaved[0]?.km || 1)) * 100}%`,
                    background: REGION_NEON[r.region] ?? '#4d9fff',
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Data note ── */}
      <div className="bms-card bg-slate-800/40 border-slate-700/50">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5"/>
          <div className="text-[10px] text-slate-400 leading-relaxed">
            <strong className="text-slate-300">Data sources:</strong> Paved stock timeline from the Uganda national roads inventory (2015–2023).
            Condition percentages from the national roads assessment survey, FY 2023/24.
            Network lengths from the MoWT National Road Network inventory (July 2025).
            IRI and rutting assessment records are available in the Road Condition Data archive
            for detailed link-level condition analysis.
          </div>
        </div>
      </div>
    </div>
  );
}
