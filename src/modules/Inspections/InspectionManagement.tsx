import { useState, useMemo } from 'react';
import { Plus, Search, ClipboardCheck, Camera, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import type { Inspection, InspectionType } from '../../types';
import { conditionColor, conditionLabel, conditionBadge, formatDate, INSPECTORS } from '../../utils/helpers';
import { v4 as uuidv4 } from 'uuid';

export default function InspectionManagement() {
  const { state, dispatch } = useBMS();
  const { inspections, structures } = state;

  const [query,       setQuery]       = useState('');
  const [typeFilter,  setTypeFilter]  = useState<'all' | InspectionType>('all');
  const [showForm,    setShowForm]    = useState(false);
  const [page,        setPage]        = useState(1);
  const PAGE_SIZE = 20;

  const filtered = useMemo(() => {
    let list = [...inspections].sort((a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );
    if (typeFilter !== 'all') list = list.filter(i => i.type === typeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(i =>
        i.structureName.toLowerCase().includes(q) ||
        i.inspector.toLowerCase().includes(q) ||
        i.structureId.toLowerCase().includes(q),
      );
    }
    return list;
  }, [inspections, query, typeFilter]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Upcoming due
  const upcomingDue = useMemo(() =>
    structures.filter(s => s.inspectionDue)
      .sort((a, b) => new Date(a.nextInspection).getTime() - new Date(b.nextInspection).getTime())
      .slice(0, 8),
    [structures],
  );

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Toolbar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="bms-input pl-9 py-1.5 text-xs"
              placeholder="Search by structure, inspector…"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
            />
          </div>
          <select className="bms-select text-xs py-1.5" value={typeFilter} onChange={e => { setTypeFilter(e.target.value as typeof typeFilter); setPage(1); }}>
            <option value="all">All Types</option>
            <option value="Routine">Routine</option>
            <option value="Principal">Principal</option>
            <option value="Special">Special</option>
            <option value="Emergency">Emergency</option>
          </select>
          <div className="flex-1" />
          <span className="text-xs text-slate-500">{filtered.length} inspections</span>
          <button onClick={() => setShowForm(true)} className="bms-btn-primary text-xs py-1.5">
            <Plus size={13} /> Log Inspection
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="bms-table">
              <thead>
                <tr>
                  <th>Structure</th>
                  <th>Date</th>
                  <th>Inspector</th>
                  <th>Type</th>
                  <th>Deck</th>
                  <th>Super.</th>
                  <th>Sub.</th>
                  <th>Channel</th>
                  <th>Visual Score</th>
                  <th>Overall</th>
                  <th>Next Due</th>
                  <th>Photos</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map(insp => (
                  <InspectionRow key={insp.id} insp={insp} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-700/60 bg-slate-900/50 flex-shrink-0">
            <span className="text-xs text-slate-500">
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="bms-btn-secondary text-xs py-1 px-3 disabled:opacity-40">← Prev</button>
              <span className="text-xs text-slate-400">Page {page} / {pageCount}</span>
              <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="bms-btn-secondary text-xs py-1 px-3 disabled:opacity-40">Next →</button>
            </div>
          </div>
        </div>

        {/* Right panel: upcoming due */}
        <div className="w-72 border-l border-slate-700/60 bg-slate-900/30 flex-shrink-0 overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Inspections Due</span>
          </div>
          <div className="space-y-2">
            {upcomingDue.map(s => (
              <div key={s.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                <div className="text-xs font-semibold text-slate-200 truncate">{s.name}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">{s.road}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className={`badge ${conditionBadge(s.conditionRating)} text-[9px]`}>
                    {conditionLabel(s.conditionRating)}
                  </span>
                  <span className="text-[10px] text-red-400 font-semibold">{formatDate(s.nextInspection)}</span>
                </div>
              </div>
            ))}
            {upcomingDue.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle2 size={14} />
                All inspections current
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log Inspection Form */}
      {showForm && (
        <InspectionForm
          structures={structures.map(s => ({ id: s.id, name: s.name }))}
          onSave={(insp) => {
            dispatch({ type: 'ADD_INSPECTION', payload: insp });
            setShowForm(false);
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────
function InspectionRow({ insp }: { insp: Inspection }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr onClick={() => setExpanded(e => !e)} className="hover:bg-slate-700/30 transition-colors cursor-pointer">
        <td className="px-4 py-3">
          <div className="text-xs font-semibold text-slate-200">{insp.structureName}</div>
          <div className="text-[10px] text-slate-500">{insp.structureId}</div>
        </td>
        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(insp.date)}</td>
        <td className="px-4 py-3 text-xs text-slate-400">{insp.inspector}</td>
        <td className="px-4 py-3">
          <span className={`badge text-[10px] ${
            insp.type === 'Emergency' ? 'badge-critical' :
            insp.type === 'Special'   ? 'badge-fair' :
            insp.type === 'Principal' ? 'badge-blue' : 'badge-slate'
          }`}>{insp.type}</span>
        </td>
        <td className="px-4 py-3 text-xs text-center"><RatingDot v={insp.deckRating} /></td>
        <td className="px-4 py-3 text-xs text-center"><RatingDot v={insp.superstructureRating} /></td>
        <td className="px-4 py-3 text-xs text-center"><RatingDot v={insp.substructureRating} /></td>
        <td className="px-4 py-3 text-xs text-center"><RatingDot v={insp.channelRating} /></td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-700 rounded-full h-1.5 min-w-[40px]">
              <div
                className="rounded-full h-1.5"
                style={{ width: `${insp.visualScore}%`, background: conditionColor(insp.overallCondition) }}
              />
            </div>
            <span className="text-[10px] text-slate-400 w-7 text-right">{insp.visualScore}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`badge ${conditionBadge(insp.overallCondition)}`}>
            {insp.overallCondition} – {conditionLabel(insp.overallCondition)}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(insp.nextInspection)}</td>
        <td className="px-4 py-3 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Camera size={12} />
            <span>{insp.photos.length}</span>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-800/60">
          <td colSpan={12} className="px-6 py-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Findings</div>
                <p className="text-xs text-slate-300">{insp.findings}</p>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Recommendations</div>
                <p className="text-xs text-slate-300">{insp.recommendations}</p>
              </div>
              {insp.defects.length > 0 && (
                <div className="col-span-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Defects Recorded</div>
                  <div className="flex flex-wrap gap-1.5">
                    {insp.defects.map(d => (
                      <span key={d} className="badge badge-critical text-[9px]">{d}</span>
                    ))}
                  </div>
                </div>
              )}
              {insp.photos.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Photo Files</div>
                  <div className="flex flex-wrap gap-1">
                    {insp.photos.map(p => (
                      <code key={p} className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{p}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function RatingDot({ v }: { v: number }) {
  const color = v >= 7 ? '#22c55e' : v >= 5 ? '#f59e0b' : v >= 3 ? '#f97316' : '#ef4444';
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold"
      style={{ background: color + '22', color }}>
      {v}
    </span>
  );
}

// ─── Log Form ─────────────────────────────────────────────────────────────────
function InspectionForm({
  structures, onSave, onClose,
}: {
  structures: { id: string; name: string }[];
  onSave: (i: Inspection) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    structureId:          structures[0]?.id ?? '',
    date:                 new Date().toISOString().split('T')[0],
    inspector:            INSPECTORS[0],
    type:                 'Routine' as InspectionType,
    deckRating:           7,
    superstructureRating: 7,
    substructureRating:   7,
    channelRating:        7,
    overallCondition:     4,
    visualScore:          75,
    findings:             '',
    recommendations:      '',
    nextInspection:       '',
  });

  function set(key: string, value: string | number) {
    setF(prev => ({ ...prev, [key]: value }));
  }

  function save() {
    const struct = structures.find(s => s.id === f.structureId);
    const insp: Inspection = {
      id:                   uuidv4(),
      structureId:          f.structureId,
      structureName:        struct?.name ?? f.structureId,
      date:                 f.date,
      inspector:            f.inspector,
      type:                 f.type,
      deckRating:           Number(f.deckRating),
      superstructureRating: Number(f.superstructureRating),
      substructureRating:   Number(f.substructureRating),
      channelRating:        Number(f.channelRating),
      overallCondition:     Number(f.overallCondition) as 1|2|3|4|5,
      visualScore:          Number(f.visualScore),
      findings:             f.findings,
      defects:              [],
      recommendations:      f.recommendations,
      photos:               [],
      nextInspection:       f.nextInspection || new Date(new Date(f.date).setMonth(new Date(f.date).getMonth() + 24)).toISOString().split('T')[0],
      completedAt:          new Date().toISOString(),
    };
    onSave(insp);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={18} className="text-blue-400" />
            <span className="font-bold text-white">Log New Inspection</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4 overflow-y-auto max-h-[70vh]">
          <div className="col-span-2">
            <label className="bms-label">Structure</label>
            <select className="bms-select" value={f.structureId} onChange={e => set('structureId', e.target.value)}>
              {structures.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
            </select>
          </div>
          <FormField label="Date" type="date" value={f.date} onChange={v => set('date', v)} />
          <div>
            <label className="bms-label">Inspector</label>
            <select className="bms-select" value={f.inspector} onChange={e => set('inspector', e.target.value)}>
              {INSPECTORS.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="bms-label">Inspection Type</label>
            <select className="bms-select" value={f.type} onChange={e => set('type', e.target.value)}>
              {['Routine', 'Principal', 'Special', 'Emergency'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <FormField label="Overall Condition (1-5)" type="number" value={f.overallCondition} onChange={v => set('overallCondition', v)} min={1} max={5} />
          <FormField label="Deck Rating (NBI 0-9)"          type="number" value={f.deckRating}           onChange={v => set('deckRating', v)} min={0} max={9} />
          <FormField label="Superstructure Rating (0-9)"    type="number" value={f.superstructureRating} onChange={v => set('superstructureRating', v)} min={0} max={9} />
          <FormField label="Substructure Rating (0-9)"      type="number" value={f.substructureRating}   onChange={v => set('substructureRating', v)} min={0} max={9} />
          <FormField label="Channel Rating (0-9)"           type="number" value={f.channelRating}        onChange={v => set('channelRating', v)} min={0} max={9} />
          <FormField label="Visual Score (0-100)"           type="number" value={f.visualScore}          onChange={v => set('visualScore', v)} min={0} max={100} />
          <FormField label="Next Inspection Date"           type="date"   value={f.nextInspection}       onChange={v => set('nextInspection', v)} />
          <div className="col-span-2">
            <label className="bms-label">Findings</label>
            <textarea className="bms-input h-24 resize-none" value={f.findings} onChange={e => set('findings', e.target.value)} placeholder="Describe observations…" />
          </div>
          <div className="col-span-2">
            <label className="bms-label">Recommendations</label>
            <textarea className="bms-input h-20 resize-none" value={f.recommendations} onChange={e => set('recommendations', e.target.value)} placeholder="Actions required…" />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="bms-btn-secondary">Cancel</button>
          <button onClick={save} className="bms-btn-primary">
            <CheckCircle2 size={14} /> Save Inspection
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label, type, value, onChange, min, max,
}: {
  label: string; type: string; value: string | number;
  onChange: (v: string) => void;
  min?: number; max?: number;
}) {
  return (
    <div>
      <label className="bms-label">{label}</label>
      <input
        className="bms-input"
        type={type}
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
