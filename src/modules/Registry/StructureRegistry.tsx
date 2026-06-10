import { useState, useMemo } from 'react';
import { Search, Filter, Download, ChevronUp, ChevronDown, Eye } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import type { Structure } from '../../types';
import { conditionLabel, conditionColor, conditionBadge, formatDate, formatUGX } from '../../utils/helpers';
import { downloadGeoJSON, downloadKML } from '../../utils/downloads';
import StructureDetailModal from './StructureDetailModal';

type SortKey = keyof Structure;

export default function StructureRegistry() {
  const { state } = useBMS();
  const { structures } = state;

  const [query,     setQuery]     = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'bridge' | 'culvert'>('all');
  const [condFilter, setCondFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [regionFilter, setRegion]  = useState('all');
  const [sortKey,   setSortKey]   = useState<SortKey>('priorityRank');
  const [sortAsc,   setSortAsc]   = useState(true);
  const [page,      setPage]      = useState(1);
  const [selected,  setSelected]  = useState<Structure | null>(null);
  const PAGE_SIZE = 25;

  const regions = useMemo(() => {
    const r = new Set(structures.map(s => s.region).filter(Boolean));
    return ['all', ...Array.from(r).sort()];
  }, [structures]);

  const filtered = useMemo(() => {
    let list = structures;
    if (typeFilter !== 'all') list = list.filter(s => s.type === typeFilter);
    if (condFilter !== 'all') list = list.filter(s => String(s.conditionRating) === condFilter);
    if (regionFilter !== 'all') list = list.filter(s => s.region === regionFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.road.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q) ||
        s.river.toLowerCase().includes(q),
      );
    }
    // Sort
    list = [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortAsc ? av - bv : bv - av;
      }
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return list;
  }, [structures, query, typeFilter, condFilter, regionFilter, sortKey, sortAsc]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function sort(key: SortKey) {
    if (key === sortKey) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
    setPage(1);
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (k !== sortKey) return <ChevronUp size={12} className="text-slate-600" />;
    return sortAsc
      ? <ChevronUp size={12} className="text-blue-400" />
      : <ChevronDown size={12} className="text-blue-400" />;
  }

  function exportCSV() {
    const rows = [
      ['ID','Name','Type','Road','Region','Chainage(km)','Lat','Lng','Span(m)','Spans','Lanes','Width(m)',
       'Material','Year Built','Condition','Last Inspection','Next Inspection','Traffic','Priority Score','Priority Rank',
       'Est. Replacement Cost (UGX)'].join(','),
      ...filtered.map(s => [
        s.id, `"${s.name}"`, s.type, `"${s.road}"`, s.region, s.chainage,
        s.lat, s.lng, s.spanLength, s.noOfSpans, s.noOfLanes, s.width,
        `"${s.material}"`, s.yearBuilt, conditionLabel(s.conditionRating),
        s.lastInspection, s.nextInspection, s.traffic, s.priorityScore, s.priorityRank,
        s.estimatedReplacementCost,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'DNR_Structures_Registry.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const Th = ({ label, k }: { label: string; k: SortKey }) => (
    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-900 border-b border-slate-700 whitespace-nowrap cursor-pointer hover:text-slate-200 select-none" onClick={() => sort(k)}>
      <span className="flex items-center gap-1">{label} <SortIcon k={k} /></span>
    </th>
  );

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Toolbar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="bms-input pl-9 py-1.5 text-xs"
              placeholder="Name, ID, road, region…"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1">
            <Filter size={13} className="text-slate-500" />
            <select className="bms-select text-xs py-1.5" value={typeFilter} onChange={e => { setTypeFilter(e.target.value as typeof typeFilter); setPage(1); }}>
              <option value="all">All Types</option>
              <option value="bridge">Bridges</option>
              <option value="culvert">Culverts</option>
            </select>
          </div>
          <select className="bms-select text-xs py-1.5" value={condFilter} onChange={e => { setCondFilter(e.target.value as typeof condFilter); setPage(1); }}>
            <option value="all">All Conditions</option>
            <option value="5">5 - Excellent</option>
            <option value="4">4 - Good</option>
            <option value="3">3 - Fair</option>
            <option value="2">2 - Poor</option>
            <option value="1">1 - Critical</option>
          </select>
          <select className="bms-select text-xs py-1.5" value={regionFilter} onChange={e => { setRegion(e.target.value); setPage(1); }}>
            {regions.map(r => (
              <option key={r} value={r}>{r === 'all' ? 'All Regions' : r}</option>
            ))}
          </select>

          {/* Spacer + count + export */}
          <div className="flex-1" />
          <span className="text-xs text-slate-500">{filtered.length.toLocaleString()} structures</span>
          <button onClick={exportCSV} className="bms-btn-secondary text-xs py-1.5">
            <Download size={13} /> CSV
          </button>
          <button
            onClick={() => downloadGeoJSON(filtered, `Department of National Roads_Structures_${new Date().toISOString().slice(0,10)}.geojson`)}
            className="bms-btn-secondary text-xs py-1.5"
          >
            <Download size={13} /> GeoJSON
          </button>
          <button
            onClick={() => downloadKML(filtered, `Department of National Roads_Structures_${new Date().toISOString().slice(0,10)}.kml`)}
            className="bms-btn-secondary text-xs py-1.5"
          >
            <Download size={13} /> KML
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="bms-table">
          <thead>
            <tr>
              <Th label="Rank"        k="priorityRank" />
              <Th label="ID"          k="id" />
              <Th label="Name"        k="name" />
              <Th label="Type"        k="type" />
              <Th label="Road"        k="road" />
              <Th label="Region"      k="region" />
              <Th label="Chainage km" k="chainage" />
              <Th label="Span m"      k="spanLength" />
              <Th label="Spans"       k="noOfSpans" />
              <Th label="Lanes"       k="noOfLanes" />
              <Th label="Material"    k="material" />
              <Th label="Year Built"  k="yearBuilt" />
              <Th label="Condition"   k="conditionRating" />
              <Th label="Last Insp."  k="lastInspection" />
              <Th label="Next Insp."  k="nextInspection" />
              <Th label="Traffic"     k="traffic" />
              <Th label="Priority"    k="priorityScore" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-900 border-b border-slate-700">Details</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map(s => (
              <tr key={s.id} onClick={() => setSelected(s)} className="hover:bg-slate-700/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-slate-400 text-xs font-mono">#{s.priorityRank}</td>
                <td className="px-4 py-3 text-xs font-mono text-blue-400 font-bold">{s.id}</td>
                <td className="px-4 py-3 text-sm text-slate-200 font-medium max-w-[200px] truncate">{s.name}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${s.type === 'bridge' ? 'badge-blue' : 'badge-purple'}`}>
                    {s.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-[160px] truncate">{s.road}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{s.region}</td>
                <td className="px-4 py-3 text-xs text-slate-400 font-mono">{s.chainage.toFixed(1)}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{s.spanLength} m</td>
                <td className="px-4 py-3 text-xs text-slate-400 text-center">{s.noOfSpans}</td>
                <td className="px-4 py-3 text-xs text-slate-400 text-center">{s.noOfLanes}</td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-[120px] truncate">{s.material}</td>
                <td className="px-4 py-3 text-xs text-slate-400 font-mono">{s.yearBuilt}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${conditionBadge(s.conditionRating)}`}>
                    {s.conditionRating} – {conditionLabel(s.conditionRating)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(s.lastInspection)}</td>
                <td className="px-4 py-3 text-xs whitespace-nowrap">
                  <span className={s.inspectionDue ? 'text-red-400 font-semibold' : 'text-slate-400'}>
                    {formatDate(s.nextInspection)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${
                    s.traffic === 'Very High' ? 'badge-critical' :
                    s.traffic === 'High' ? 'badge-poor' :
                    s.traffic === 'Medium' ? 'badge-fair' : 'badge-good'
                  }`}>{s.traffic}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-700 rounded-full h-1.5 min-w-[40px]">
                      <div
                        className="rounded-full h-1.5 transition-all"
                        style={{ width: `${s.priorityScore}%`, background: conditionColor(s.conditionRating) }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 font-mono w-6 text-right">{s.priorityScore}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={e => { e.stopPropagation(); setSelected(s); }}
                    className="p-1.5 rounded-md bg-slate-700 hover:bg-blue-600/30 text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    <Eye size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t border-slate-700/60 bg-slate-900/50">
        <span className="text-xs text-slate-500">
          Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="bms-btn-secondary text-xs py-1 px-3 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate-400">Page {page} / {pageCount}</span>
          <button
            onClick={() => setPage(p => Math.min(pageCount, p + 1))}
            disabled={page === pageCount}
            className="bms-btn-secondary text-xs py-1 px-3 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Detail modal */}
      {selected && <StructureDetailModal structure={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
