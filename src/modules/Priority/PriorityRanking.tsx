import { useMemo, useState } from 'react';
import { AlertTriangle, TrendingUp, Filter } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import { conditionColor, conditionLabel, conditionBadge, formatUGX, CONDITION_COLORS } from '../../utils/helpers';
import type { Structure } from '../../types';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

type FilterMode = 'all' | 'bridges' | 'culverts' | 'critical' | 'poor';

export default function PriorityRanking() {
  const { state }    = useBMS();
  const { structures } = state;
  const [mode, setMode] = useState<FilterMode>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const filtered = useMemo(() => {
    let list = [...structures].sort((a, b) => b.priorityScore - a.priorityScore);
    if (mode === 'bridges')  list = list.filter(s => s.type === 'bridge');
    if (mode === 'culverts') list = list.filter(s => s.type === 'culvert');
    if (mode === 'critical') list = list.filter(s => s.conditionRating === 1);
    if (mode === 'poor')     list = list.filter(s => s.conditionRating <= 2);
    return list;
  }, [structures, mode]);

  const top10 = filtered.slice(0, 10);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);

  // Scatter data: priority score vs age
  const scatterData = useMemo(() =>
    structures.slice(0, 200).map(s => ({
      x: 2024 - s.yearBuilt,
      y: s.priorityScore,
      rating: s.conditionRating,
      name: s.name,
      id: s.id,
    })),
    [structures],
  );

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header / filter bar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-900/50">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={14} className="text-slate-500" />
          {(['all','bridges','culverts','critical','poor'] as FilterMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors
                ${mode === m ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            >{m}</button>
          ))}
          <div className="flex-1" />
          <span className="text-xs text-slate-500">{filtered.length} structures ranked</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main ranked list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top 10 spotlight */}
          <div className="flex-shrink-0 p-4 border-b border-slate-700/60">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Top 10 Highest Priority</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {top10.map((s, i) => (
                <TopCard key={s.id} structure={s} rank={i + 1} />
              ))}
            </div>
          </div>

          {/* Full table */}
          <div className="flex-1 overflow-auto">
            <table className="bms-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Road</th>
                  <th>Region</th>
                  <th>Condition</th>
                  <th>Traffic</th>
                  <th>Age (yrs)</th>
                  <th>Strategic Imp.</th>
                  <th>Priority Score</th>
                  <th>Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((s, i) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0
                          ${i + ((page-1)*PAGE_SIZE) < 3 ? 'bg-red-500 text-white' :
                            i + ((page-1)*PAGE_SIZE) < 10 ? 'bg-orange-500/20 text-orange-400' :
                            'bg-slate-700 text-slate-400'}`}
                        >
                          {s.priorityRank}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-blue-400 font-bold">{s.id}</td>
                    <td className="px-4 py-3 text-xs text-slate-200 font-medium max-w-[180px] truncate">{s.name}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${s.type === 'bridge' ? 'badge-blue' : 'badge-purple'}`}>{s.type}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-[150px] truncate">{s.road}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{s.region}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${conditionBadge(s.conditionRating)}`}>
                        {s.conditionRating} – {conditionLabel(s.conditionRating)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${
                        s.traffic === 'Very High' ? 'badge-critical' :
                        s.traffic === 'High'      ? 'badge-poor' :
                        s.traffic === 'Medium'    ? 'badge-fair' : 'badge-good'
                      }`}>{s.traffic}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{2024 - s.yearBuilt}</td>
                    <td className="px-4 py-3">
                      <StarRating value={s.strategicImportance} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-700 rounded-full h-2 min-w-[50px]">
                          <div
                            className="rounded-full h-2"
                            style={{ width: `${s.priorityScore}%`, background: conditionColor(s.conditionRating) }}
                          />
                        </div>
                        <span className="text-xs font-bold" style={{ color: conditionColor(s.conditionRating) }}>
                          {s.priorityScore}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {formatUGX(s.estimatedReplacementCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-700/60 bg-slate-900/50 flex-shrink-0">
            <span className="text-xs text-slate-500">Showing {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="bms-btn-secondary text-xs py-1 px-3 disabled:opacity-40">← Prev</button>
              <span className="text-xs text-slate-400">Page {page}/{pageCount}</span>
              <button onClick={() => setPage(p => Math.min(pageCount, p+1))} disabled={page===pageCount} className="bms-btn-secondary text-xs py-1 px-3 disabled:opacity-40">Next →</button>
            </div>
          </div>
        </div>

        {/* Right: scatter plot */}
        <div className="w-80 border-l border-slate-700/60 bg-slate-900/30 flex-shrink-0 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-blue-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Age vs Priority Score</span>
          </div>

          <div className="bms-card p-3">
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart margin={{ top:4, right:8, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="x" name="Age (yrs)" tick={{ fill:'#64748b', fontSize:9 }} label={{ value:'Age (yrs)', position:'insideBottom', fill:'#475569', fontSize:10, dy:8 }} />
                <YAxis dataKey="y" name="Priority" tick={{ fill:'#64748b', fontSize:9 }} label={{ value:'Priority', angle:-90, position:'insideLeft', fill:'#475569', fontSize:10 }} />
                <Tooltip
                  cursor={{ strokeDasharray:'3 3', stroke:'#475569' }}
                  contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:8, fontSize:10 }}
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="p-2 text-[10px]">
                        <div className="font-bold text-white">{d.name}</div>
                        <div className="text-slate-400">Age: {d.x} yrs · Priority: {d.y}</div>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData} animationDuration={800}>
                  {scatterData.map((d, i) => (
                    <Cell key={i} fill={CONDITION_COLORS[d.rating as 1|2|3|4|5]} fillOpacity={0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="space-y-1.5">
            {[5,4,3,2,1].map(r => (
              <div key={r} className="flex items-center gap-2 text-[10px]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: CONDITION_COLORS[r] }} />
                <span className="text-slate-400">Condition {r} – {conditionLabel(r)}</span>
              </div>
            ))}
          </div>

          {/* Score formula explanation */}
          <div className="bms-card p-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Score Formula</div>
            <div className="text-[10px] text-slate-400 space-y-1 font-mono">
              <div>Condition:  × 3 (max 12)</div>
              <div>Traffic:    × 2 (max 8)</div>
              <div>Age:        × 1 (max 4)</div>
              <div>Strategic:  × 1 (max 5)</div>
              <div className="border-t border-slate-700 pt-1 text-slate-300">Total → scaled 0–100</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Top 10 Card ──────────────────────────────────────────────────────────────
function TopCard({ structure: s, rank }: { structure: Structure; rank: number }) {
  return (
    <div
      className="flex-shrink-0 w-52 rounded-xl border p-3 cursor-default"
      style={{
        background: conditionColor(s.conditionRating) + '11',
        borderColor: conditionColor(s.conditionRating) + '44',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
          style={{ background: rank <= 3 ? '#ef4444' : '#f97316' }}
        >{rank}</span>
        <span className="text-xs font-bold text-slate-200 truncate">{s.name}</span>
      </div>
      <div className="text-[10px] text-slate-500 truncate mb-2">{s.road}</div>
      <div className="flex items-center justify-between">
        <span className={`badge ${conditionBadge(s.conditionRating)} text-[9px]`}>{conditionLabel(s.conditionRating)}</span>
        <span className="text-sm font-black" style={{ color: conditionColor(s.conditionRating) }}>{s.priorityScore}</span>
      </div>
    </div>
  );
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`text-xs ${i <= value ? 'text-amber-400' : 'text-slate-600'}`}>★</span>
      ))}
    </div>
  );
}
