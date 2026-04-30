import { useState, useMemo } from 'react';
import { Activity, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import { conditionColor, conditionLabel, conditionBadge, formatDate } from '../../utils/helpers';
import type { Structure } from '../../types';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';

export default function ConditionAssessment() {
  const { state } = useBMS();
  const { structures } = state;

  const [query,    setQuery]    = useState('');
  const [selected, setSelected] = useState<Structure | null>(null);
  const [sortKey,  setSortKey]  = useState<'conditionRating' | 'priorityScore' | 'yearBuilt'>('conditionRating');

  const filtered = useMemo(() => {
    let list = [...structures];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.road.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => {
      if (sortKey === 'conditionRating') return a.conditionRating - b.conditionRating;
      if (sortKey === 'priorityScore')   return b.priorityScore - a.priorityScore;
      return a.yearBuilt - b.yearBuilt;
    });
  }, [structures, query, sortKey]);


  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Top toolbar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="bms-input pl-9 py-1.5 text-xs" placeholder="Search structures…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <select className="bms-select text-xs py-1.5" value={sortKey} onChange={e => setSortKey(e.target.value as typeof sortKey)}>
            <option value="conditionRating">Sort: Worst First</option>
            <option value="priorityScore">Sort: Priority Score</option>
            <option value="yearBuilt">Sort: Oldest First</option>
          </select>
          <span className="text-xs text-slate-500">{filtered.length} structures</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Structure list */}
        <div className="w-96 border-r border-slate-700/60 overflow-y-auto flex-shrink-0">
          {filtered.map(s => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`w-full text-left px-4 py-3 border-b border-slate-700/30 transition-colors hover:bg-slate-700/40
                ${selected?.id === s.id ? 'bg-slate-700/60 border-l-2 border-l-blue-500' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-black flex-shrink-0"
                  style={{ background: conditionColor(s.conditionRating) + '22', color: conditionColor(s.conditionRating) }}
                >
                  {s.conditionRating}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-200 truncate">{s.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{s.road} · {s.region}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge ${conditionBadge(s.conditionRating)} text-[9px]`}>{conditionLabel(s.conditionRating)}</span>
                    <span className="text-[9px] text-slate-600">Built {s.yearBuilt}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs font-bold text-slate-300">{s.priorityScore}</div>
                  <div className="text-[9px] text-slate-500">priority</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {selected ? (
            <ConditionDetail structure={selected} />
          ) : (
            <NetworkConditionOverview structures={structures} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function ConditionDetail({ structure: s }: { structure: Structure }) {
  const histData = s.conditionHistory.map(h => ({ year: String(h.year), rating: h.rating }));

  const nbiComponents = [
    { label: 'Deck',          score: Math.round(s.conditionRating * 1.8) },
    { label: 'Superstructure',score: Math.round(s.conditionRating * 1.9) },
    { label: 'Substructure',  score: Math.round(s.conditionRating * 1.7) },
    { label: 'Channel',       score: Math.round(s.conditionRating * 1.85) },
    { label: 'Approach Slabs',score: Math.round(s.conditionRating * 1.6) },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bms-card">
        <div className="flex items-start gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black flex-shrink-0"
            style={{ background: conditionColor(s.conditionRating) + '22', color: conditionColor(s.conditionRating) }}
          >
            {s.conditionRating}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`badge ${conditionBadge(s.conditionRating)}`}>
                {conditionLabel(s.conditionRating)}
              </span>
              <span className="badge badge-blue">{s.id}</span>
            </div>
            <h2 className="text-lg font-bold text-white">{s.name}</h2>
            <div className="text-xs text-slate-400 mt-0.5">{s.road} · {s.region} · Built {s.yearBuilt} · {2024 - s.yearBuilt} yrs old</div>
          </div>
        </div>

        {/* Defects */}
        {s.defects.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Recorded Defects</div>
            <div className="flex flex-wrap gap-1.5">
              {s.defects.map(d => (
                <span key={d} className="badge badge-critical text-[10px]">{d}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Condition history chart */}
      <div className="bms-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity size={15} className="text-blue-400" />
            Condition History (2018 – 2024)
          </h3>
          <span className="text-xs text-slate-500">Lower = worse</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={histData} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 5.5]} ticks={[1,2,3,4,5]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <ReferenceLine y={3} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: 'Fair', position: 'insideRight', fill: '#f59e0b', fontSize: 10 }} />
            <ReferenceLine y={2} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: 'Poor', position: 'insideRight', fill: '#ef4444', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              formatter={(v: number) => [conditionLabel(v), 'Condition Rating']}
            />
            <Line
              type="monotone"
              dataKey="rating"
              stroke={conditionColor(s.conditionRating)}
              strokeWidth={2.5}
              dot={{ r: 5, fill: conditionColor(s.conditionRating), strokeWidth: 0 }}
              animationDuration={600}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* NBI component ratings */}
      <div className="bms-card">
        <h3 className="text-sm font-bold text-white mb-4">NBI Component Ratings (0–9)</h3>
        <div className="space-y-3">
          {nbiComponents.map(c => {
            const pct = (c.score / 9) * 100;
            const color = c.score >= 6 ? '#22c55e' : c.score >= 4 ? '#f59e0b' : '#ef4444';
            return (
              <div key={c.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">{c.label}</span>
                  <span className="font-bold" style={{ color }}>{c.score}/9</span>
                </div>
                <div className="bg-slate-700 rounded-full h-2">
                  <div
                    className="rounded-full h-2 transition-all duration-700"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Last inspection info */}
      <div className="bms-card">
        <h3 className="text-sm font-bold text-white mb-3">Inspection Dates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="bms-label">Last Inspection</div>
            <div className="text-sm text-slate-200">{formatDate(s.lastInspection)}</div>
          </div>
          <div>
            <div className="bms-label">Next Due</div>
            <div className={`text-sm font-semibold ${s.inspectionDue ? 'text-red-400' : 'text-green-400'}`}>
              {formatDate(s.nextInspection)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Network overview ─────────────────────────────────────────────────────────
function NetworkConditionOverview({ structures }: { structures: Structure[] }) {
  const byCond: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  structures.forEach(s => { byCond[s.conditionRating]++; });

  const labels: Record<number, string> = { 5: 'Excellent', 4: 'Good', 3: 'Fair', 2: 'Poor', 1: 'Critical' };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bms-card">
        <h3 className="text-sm font-bold text-white mb-1">Select a structure on the left to view its full condition profile.</h3>
        <p className="text-xs text-slate-500">Network-wide condition summary below · Detailed trends available in Analytics &amp; Reports.</p>
      </div>

      <div className="bms-card">
        <h3 className="text-sm font-bold text-white mb-4">Current Condition Distribution</h3>
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map(r => (
            <div key={r}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{labels[r]}</span>
                <span className="font-medium" style={{ color: conditionColor(r) }}>{byCond[r]} structures</span>
              </div>
              <div className="bg-slate-700 rounded-full h-2">
                <div
                  className="rounded-full h-2 transition-all"
                  style={{ width: `${(byCond[r] / structures.length) * 100}%`, background: conditionColor(r) }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
