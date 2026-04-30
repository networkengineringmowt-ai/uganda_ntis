import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, LineChart, Line, Cell,
} from 'recharts';
import { TrendingUp, Truck } from 'lucide-react';
import { loadPlatformAnalytics, type PlatformAnalytics } from '../../data/platformData';
import { NEON, REGION_NEON, Bar3D, GlowDefs, Chart3DWrap, TT_NEON, TICK, AX_LINE } from '../../lib/chart3d';

export default function TrafficView() {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);

  useEffect(() => {
    loadPlatformAnalytics().then(setAnalytics).catch(console.error);
  }, []);

  const a = analytics;

  const trafficTrend = a?.trafficYears.map(t => ({
    year:      String(t.year),
    Motorised: Math.round(t.network_weighted_motorised_aadt),
    'Non-Motorised': Math.round(t.network_weighted_non_motorised_aadt),
    vkm:       Math.round(t.total_vehicle_km / 1_000_000),
  })) ?? [];

  const regionData = (a?.regionTraffic2025 ?? [])
    .slice()
    .sort((a, b) => b.network_weighted_motorised_aadt - a.network_weighted_motorised_aadt)
    .map(r => ({
      region: r.region,
      AADT:   Math.round(r.network_weighted_motorised_aadt),
      km:     Math.round(r.covered_length_km),
      vkm:    Math.round(r.total_vehicle_km / 1_000_000),
    }));

  const growth = a?.trafficGrowth ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(185,103,255,0.15)', border: '1px solid rgba(185,103,255,0.3)' }}>
          <Truck size={20} style={{ color: '#b967ff' }}/>
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Traffic & Demand</h1>
          <p className="text-xs text-slate-400">Network-weighted AADT · Road traffic surveys 2017–2025</p>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Network AADT (2025)', value: a ? Math.round(a.trafficYears.find(t=>t.year===2025)?.network_weighted_motorised_aadt??2562).toLocaleString() : '2,562', sub:'Motorised vehicles/day', color:'text-purple-400' },
          { label:'Growth 2017→2025',    value: a ? `+${(((a.trafficYears.find(t=>t.year===2025)?.network_weighted_motorised_aadt??2562)/(a.trafficYears.find(t=>t.year===2017)?.network_weighted_motorised_aadt??1733)-1)*100).toFixed(1)}%` : '+47.9%', sub:'Motorised AADT growth', color:'text-green-400' },
          { label:'Vehicle-km/year (2025)', value: a ? `${((a.trafficYears.find(t=>t.year===2025)?.total_vehicle_km??0)/1e9).toFixed(1)}B` : '19.2B', sub:'Total vehicle-km on network', color:'text-blue-400' },
          { label:'Highest Region (2025)', value: regionData[0]?.region ?? 'Central', sub:`${regionData[0]?.AADT.toLocaleString() ?? ''} AADT`, color:'text-amber-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bms-card">
            <div className={`text-xl font-black ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs font-semibold text-slate-300 mt-1">{kpi.label}</div>
            <div className="text-[10px] text-slate-500">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── AADT trend ── */}
      <div className="bms-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-bold text-white">National AADT Trend</div>
            <div className="text-[10px] text-slate-500">Length-weighted average across covered network links</div>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block" style={{ background: '#4d9fff' }}/> Motorised</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-500 inline-block"/> Non-Motorised</span>
          </div>
        </div>
        <Chart3DWrap>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trafficTrend} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
              <GlowDefs id="traffic" />
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
              <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false}/>
              <YAxis tick={TICK} axisLine={false} tickLine={false} width={50}/>
              <Tooltip {...TT_NEON} formatter={(v:number, name:string) => [v.toLocaleString(), name]}/>
              <Line
                type="monotone"
                dataKey="Motorised"
                stroke="#4d9fff"
                strokeWidth={3}
                dot={{ fill: '#4d9fff', r: 5 }}
                animationDuration={1000}
                filter="url(#trafficglow)"
              />
              <Line
                type="monotone"
                dataKey="Non-Motorised"
                stroke="rgba(148,163,184,0.5)"
                strokeWidth={2}
                dot={{ fill: '#64748b', r: 4 }}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        </Chart3DWrap>
        {/* Growth chips */}
        {growth.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {growth.map(g => (
              <div key={`${g.from_year}-${g.to_year}`}
                className="bg-slate-700/60 rounded-lg px-3 py-2">
                <div className="text-xs font-bold text-green-400">
                  +{g.motorised_aadt_growth_pct.toFixed(1)}%
                </div>
                <div className="text-[9px] text-slate-500">{g.from_year}→{g.to_year}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Region AADT 2025 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bms-card">
          <div className="text-sm font-bold text-white mb-4">AADT by Region (2025)</div>
          <Chart3DWrap>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={regionData} layout="vertical" margin={{ top: 0, right: 16, left: 70, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" horizontal={false}/>
                <XAxis type="number" tick={TICK} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="region" tick={TICK} axisLine={false} tickLine={false} width={68}/>
                <Tooltip {...TT_NEON} formatter={(v:number) => [v.toLocaleString(), 'Motorised AADT']}/>
                <Bar dataKey="AADT" radius={[0,4,4,0]} animationDuration={1000} shape={<Bar3D />}>
                  {regionData.map(r => <Cell key={r.region} fill={REGION_NEON[r.region] ?? '#475569'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>

        {/* Vehicle-km by region */}
        <div className="bms-card">
          <div className="text-sm font-bold text-white mb-4">Vehicle-km by Region (2025, M)</div>
          <Chart3DWrap>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={regionData} layout="vertical" margin={{ top: 0, right: 16, left: 70, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" horizontal={false}/>
                <XAxis type="number" tick={TICK} axisLine={false} tickLine={false}
                  tickFormatter={(v:number) => `${(v/1000).toFixed(0)}B`}/>
                <YAxis type="category" dataKey="region" tick={TICK} axisLine={false} tickLine={false} width={68}/>
                <Tooltip {...TT_NEON} formatter={(v:number) => [`${(v).toLocaleString()} M veh-km`, 'Vehicle-km']}/>
                <Bar dataKey="vkm" radius={[0,4,4,0]} animationDuration={1000} shape={<Bar3D />}>
                  {regionData.map(r => <Cell key={r.region} fill={(REGION_NEON[r.region] ?? '#475569') + 'bb'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>
      </div>

      {/* ── Region table ── */}
      <div className="bms-card">
        <div className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-400"/> Detailed Region Summary (2025)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                {['Region','Motorised AADT','Non-Motorised AADT','Covered Length (km)','Vehicle-km (M)'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(a?.regionTraffic2025 ?? []).sort((a,b) => b.network_weighted_motorised_aadt - a.network_weighted_motorised_aadt).map(r => (
                <tr key={r.region} className="border-b border-slate-800 hover:bg-slate-800/40">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: REGION_NEON[r.region] ?? '#64748b'}}/>
                      <span className="text-slate-200 font-semibold">{r.region}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-blue-400 font-mono">{Math.round(r.network_weighted_motorised_aadt).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-slate-400 font-mono">{Math.round(r.network_weighted_non_motorised_aadt ?? 0).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-slate-300 font-mono">{Math.round(r.covered_length_km).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-slate-300 font-mono">{(r.total_vehicle_km/1e6).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-[10px] text-slate-600">
          Sources: Traffic_2017,2020.xlsx · Traffic_2020-2021.xlsx · Length-weighted aggregation per maintenance region
        </div>
      </div>
    </div>
  );
}
