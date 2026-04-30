import { useEffect, useState, useMemo } from 'react';
import { Construction, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { loadProjects } from '../../data/platformData';
import type { OngoingProject } from '../../types';

const TT = {
  contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8 },
  labelStyle:   { color: '#f1f5f9', fontSize: 11 },
  itemStyle:    { color: '#94a3b8', fontSize: 10 },
};

const FUNDER_COLORS: Record<string, string> = {
  'GOU':      '#3b82f6',
  'GoU':      '#3b82f6',
  'AFDB':     '#10b981',
  'AfDB':     '#10b981',
  'BADEA/OFID': '#f59e0b',
  'World Bank': '#8b5cf6',
  'ADB':      '#06b6d4',
  'JICA':     '#ec4899',
  'EU':       '#f97316',
  'EXIM':     '#a855f7',
  'CHINA EXIM': '#a855f7',
};

function funderColor(agency: string): string {
  for (const [key, color] of Object.entries(FUNDER_COLORS)) {
    if (agency.toUpperCase().includes(key.toUpperCase())) return color;
  }
  return '#64748b';
}

function ProgressBar({ planned, actual, financial }: { planned: number|null; actual: number|null; financial: number|null }) {
  return (
    <div className="space-y-1">
      {[
        { label:'Physical', val: actual,    color:'#3b82f6' },
        { label:'Financial', val: financial, color:'#10b981' },
        { label:'Planned',   val: planned,   color:'#475569' },
      ].map(b => (
        <div key={b.label}>
          <div className="flex justify-between text-[8px] text-slate-500 mb-0.5">
            <span>{b.label}</span>
            <span>{b.val !== null ? `${b.val.toFixed(0)}%` : '—'}</span>
          </div>
          <div className="bg-slate-700 rounded-full h-1.5">
            {b.val !== null && (
              <div className="rounded-full h-1.5 transition-all"
                style={{ width:`${Math.min(b.val,100)}%`, background: b.color }}/>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProjectsView() {
  const [projects, setProjects] = useState<OngoingProject[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [regionF,  setRegionF]  = useState('all');
  const [behindF,  setBehindF]  = useState<'all'|'yes'|'no'>('all');
  const [sortCol,  setSortCol]  = useState<'length'|'actual'|'financial'>('actual');
  const [view,     setView]     = useState<'table'|'cards'>('cards');

  useEffect(() => {
    loadProjects().then(p => { setProjects(p); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const regions = useMemo(() => {
    const s = new Set<string>();
    projects.forEach(p => p.regions.split(',').forEach(r => s.add(r.trim())));
    return [...s].filter(Boolean).sort();
  }, [projects]);

  const filtered = useMemo(() => {
    return projects
      .filter(p => {
        if (search && !p.project_name.toLowerCase().includes(search.toLowerCase()) &&
            !p.location.toLowerCase().includes(search.toLowerCase()) &&
            !p.contractor.toLowerCase().includes(search.toLowerCase())) return false;
        if (regionF !== 'all' && !p.regions.includes(regionF)) return false;
        if (behindF === 'yes' && !p.behind_schedule) return false;
        if (behindF === 'no' && p.behind_schedule) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortCol === 'length') return b.parsed_length_km - a.parsed_length_km;
        if (sortCol === 'actual') return (b.actual_progress_pct ?? 0) - (a.actual_progress_pct ?? 0);
        return (b.financial_progress_pct ?? 0) - (a.financial_progress_pct ?? 0);
      });
  }, [projects, search, regionF, behindF, sortCol]);

  // Stats
  const stats = useMemo(() => ({
    total:      projects.length,
    behindSch:  projects.filter(p => p.behind_schedule).length,
    totalKm:    projects.reduce((sum, p) => sum + p.parsed_length_km, 0),
    avgActual:  projects.filter(p => p.actual_progress_pct !== null).reduce((sum,p) => sum + (p.actual_progress_pct??0), 0) /
                Math.max(1, projects.filter(p => p.actual_progress_pct !== null).length),
  }), [projects]);

  // Funder breakdown
  const funderBreakdown = useMemo(() => {
    const map: Record<string, { count: number; km: number }> = {};
    projects.forEach(p => {
      const key = p.funding_agency;
      if (!map[key]) map[key] = { count: 0, km: 0 };
      map[key].count++;
      map[key].km += p.parsed_length_km;
    });
    return Object.entries(map)
      .map(([agency, v]) => ({ agency, ...v }))
      .sort((a, b) => b.km - a.km)
      .slice(0, 8);
  }, [projects]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin mx-auto"/>
          <div className="text-sm text-slate-400">Loading projects…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <Construction size={20} className="text-amber-400"/>
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Projects & Road Development</h1>
          <p className="text-xs text-slate-400">Ongoing road upgrading & construction · FY 2024/25</p>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bms-card">
          <div className="text-2xl font-black text-amber-400">{stats.total}</div>
          <div className="text-xs font-semibold text-slate-300 mt-1">Ongoing Projects</div>
          <div className="text-[10px] text-slate-500">Road development contracts</div>
        </div>
        <div className="bms-card">
          <div className="text-2xl font-black text-blue-400">{stats.totalKm.toFixed(0)} km</div>
          <div className="text-xs font-semibold text-slate-300 mt-1">Total Project Scope</div>
          <div className="text-[10px] text-slate-500">Combined road length</div>
        </div>
        <div className="bms-card">
          <div className="text-2xl font-black text-red-400">{stats.behindSch}</div>
          <div className="text-xs font-semibold text-slate-300 mt-1">Behind Schedule</div>
          <div className="text-[10px] text-slate-500">{((stats.behindSch/stats.total)*100).toFixed(0)}% of active projects</div>
        </div>
        <div className="bms-card">
          <div className="text-2xl font-black text-green-400">{stats.avgActual.toFixed(0)}%</div>
          <div className="text-xs font-semibold text-slate-300 mt-1">Avg. Physical Progress</div>
          <div className="text-[10px] text-slate-500">Across all projects</div>
        </div>
      </div>

      {/* ── Funder breakdown ── */}
      <div className="bms-card">
        <div className="text-sm font-bold text-white mb-4">Projects by Funding Agency (km scope)</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={funderBreakdown} layout="vertical" margin={{ top: 0, right: 16, left: 100, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false}/>
            <XAxis type="number" tick={{ fill:'#64748b', fontSize:9 }} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="agency" tick={{ fill:'#94a3b8', fontSize:9 }} axisLine={false} tickLine={false} width={98}/>
            <Tooltip {...TT} formatter={(v:number, name:string) => [name === 'km' ? `${v.toFixed(0)} km` : v, name]}/>
            <Bar dataKey="km" radius={[0,4,4,0]} animationDuration={600}>
              {funderBreakdown.map(f => <Cell key={f.agency} fill={funderColor(f.agency)}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Filters + view toggle ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects, location, contractor…"
            className="bms-input pl-8 w-full text-xs"/>
        </div>
        <select value={regionF} onChange={e => setRegionF(e.target.value)}
          className="bms-input text-xs">
          <option value="all">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={behindF} onChange={e => setBehindF(e.target.value as 'all'|'yes'|'no')}
          className="bms-input text-xs">
          <option value="all">All status</option>
          <option value="yes">Behind schedule</option>
          <option value="no">On schedule</option>
        </select>
        <select value={sortCol} onChange={e => setSortCol(e.target.value as 'length'|'actual'|'financial')}
          className="bms-input text-xs">
          <option value="actual">Sort: Physical %</option>
          <option value="financial">Sort: Financial %</option>
          <option value="length">Sort: Length</option>
        </select>
        <div className="flex gap-1">
          {(['cards','table'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-xs px-3 py-1.5 rounded capitalize ${view === v ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
              {v}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">{filtered.length} of {stats.total}</span>
      </div>

      {/* ── Projects cards ── */}
      {view === 'cards' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((p, i) => (
            <div key={i} className={`bms-card border-l-4 ${p.behind_schedule ? 'border-red-500' : 'border-green-500'}`}>
              {/* Title row */}
              <div className="flex items-start gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white leading-snug line-clamp-2">{p.project_name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{p.location}</span>
                    <span>·</span>
                    <span>{p.parsed_length_km.toFixed(0)} km</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {p.behind_schedule
                    ? <span className="flex items-center gap-1 text-[9px] text-red-400 font-semibold bg-red-900/30 border border-red-800/50 px-1.5 py-0.5 rounded"><AlertTriangle size={9}/> Behind</span>
                    : <span className="flex items-center gap-1 text-[9px] text-green-400 font-semibold bg-green-900/30 border border-green-800/50 px-1.5 py-0.5 rounded"><CheckCircle2 size={9}/> On Track</span>
                  }
                </div>
              </div>

              {/* Progress bars */}
              <ProgressBar planned={p.planned_progress_pct} actual={p.actual_progress_pct} financial={p.financial_progress_pct}/>

              {/* Footer */}
              <div className="mt-3 pt-2 border-t border-slate-700 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[9px] text-slate-500">Funding</div>
                  <div className="text-[10px] font-semibold" style={{ color: funderColor(p.funding_agency) }}>
                    {p.funding_agency.length > 24 ? p.funding_agency.slice(0, 24)+'…' : p.funding_agency}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500">Target Completion</div>
                  <div className="text-[10px] font-semibold text-slate-300">{p.target_completion_date || '—'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[9px] text-slate-500">Contractor</div>
                  <div className="text-[10px] text-slate-300 truncate">{p.contractor || '—'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Projects table ── */}
      {view === 'table' && (
        <div className="bms-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Project','Location','Length','Physical%','Financial%','Funding','Target','Status'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 max-w-[200px]">
                      <div className="text-slate-200 font-semibold text-[10px] leading-snug line-clamp-2">{p.project_name}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[10px] whitespace-nowrap">{p.regions}</td>
                    <td className="py-2.5 px-3 text-blue-400 font-mono whitespace-nowrap">{p.parsed_length_km.toFixed(0)} km</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 bg-slate-700 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-blue-500" style={{ width:`${Math.min(p.actual_progress_pct??0,100)}%`}}/>
                        </div>
                        <span className="text-[10px] text-slate-300 font-mono">{p.actual_progress_pct?.toFixed(0) ?? '—'}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 bg-slate-700 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-green-500" style={{ width:`${Math.min(p.financial_progress_pct??0,100)}%`}}/>
                        </div>
                        <span className="text-[10px] text-slate-300 font-mono">{p.financial_progress_pct?.toFixed(0) ?? '—'}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[10px]">
                      <span style={{ color: funderColor(p.funding_agency) }}>
                        {p.funding_agency.length > 18 ? p.funding_agency.slice(0,18)+'…' : p.funding_agency}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[10px] whitespace-nowrap">{p.target_completion_date || '—'}</td>
                    <td className="py-2.5 px-3">
                      {p.behind_schedule
                        ? <span className="text-[9px] text-red-400 font-semibold bg-red-900/30 px-1.5 py-0.5 rounded border border-red-800/50">Behind</span>
                        : <span className="text-[9px] text-green-400 font-semibold bg-green-900/30 px-1.5 py-0.5 rounded border border-green-800/50">On Track</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

