import { useState, useMemo } from 'react';
import { Plus, Search, Wrench, CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import type { WorkOrder, WorkOrderStatus, WorkOrderType, WorkOrderPriority } from '../../types';
import { formatDate, formatUGX } from '../../utils/helpers';
import { v4 as uuidv4 } from 'uuid';

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  'Planned':     'badge-blue',
  'In Progress': 'badge-fair',
  'Completed':   'badge-excellent',
  'On Hold':     'badge-slate',
  'Cancelled':   'badge-critical',
};

const STATUS_ICONS: Record<WorkOrderStatus, React.ReactNode> = {
  'Planned':     <Clock size={12} />,
  'In Progress': <Wrench size={12} />,
  'Completed':   <CheckCircle2 size={12} />,
  'On Hold':     <AlertTriangle size={12} />,
  'Cancelled':   <XCircle size={12} />,
};

const PRIORITY_BADGE: Record<WorkOrderPriority, string> = {
  'Low':      'badge-good',
  'Medium':   'badge-fair',
  'High':     'badge-poor',
  'Critical': 'badge-critical',
};

export default function MaintenanceWorks() {
  const { state, dispatch } = useBMS();
  const { workOrders, structures } = state;

  const [query,      setQuery]      = useState('');
  const [statusF,    setStatusF]    = useState<WorkOrderStatus | 'all'>('all');
  const [priorityF,  setPriorityF]  = useState<WorkOrderPriority | 'all'>('all');
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<WorkOrder | null>(null);

  const filtered = useMemo(() => {
    let list = [...workOrders].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (statusF !== 'all')   list = list.filter(w => w.status === statusF);
    if (priorityF !== 'all') list = list.filter(w => w.priority === priorityF);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(w =>
        w.structureName.toLowerCase().includes(q) ||
        w.title.toLowerCase().includes(q) ||
        w.contractor.toLowerCase().includes(q),
      );
    }
    return list;
  }, [workOrders, query, statusF, priorityF]);

  // KPIs
  const kpis = useMemo(() => ({
    planned:    workOrders.filter(w => w.status === 'Planned').length,
    active:     workOrders.filter(w => w.status === 'In Progress').length,
    completed:  workOrders.filter(w => w.status === 'Completed').length,
    totalCost:  workOrders.filter(w => w.status !== 'Cancelled').reduce((s, w) => s + w.cost, 0),
    activeCost: workOrders.filter(w => w.status === 'In Progress').reduce((s, w) => s + w.cost, 0),
  }), [workOrders]);

  function updateStatus(wo: WorkOrder, status: WorkOrderStatus) {
    dispatch({ type: 'UPDATE_WORK_ORDER', payload: { ...wo, status } });
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* KPI strip */}
      <div className="flex-shrink-0 grid grid-cols-5 gap-px bg-slate-700/40 border-b border-slate-700/60">
        <KPIStrip label="Planned"    value={kpis.planned}   color="text-blue-400" />
        <KPIStrip label="In Progress" value={kpis.active}   color="text-amber-400" />
        <KPIStrip label="Completed"  value={kpis.completed} color="text-green-400" />
        <KPIStrip label="Total Budget" value={formatUGX(kpis.totalCost)} color="text-slate-200" isText />
        <KPIStrip label="Active Spend" value={formatUGX(kpis.activeCost)} color="text-purple-400" isText />
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="bms-input pl-9 py-1.5 text-xs" placeholder="Search work orders…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <select className="bms-select text-xs py-1.5" value={statusF} onChange={e => setStatusF(e.target.value as typeof statusF)}>
            <option value="all">All Statuses</option>
            {['Planned','In Progress','Completed','On Hold','Cancelled'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="bms-select text-xs py-1.5" value={priorityF} onChange={e => setPriorityF(e.target.value as typeof priorityF)}>
            <option value="all">All Priorities</option>
            {['Critical','High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
          </select>
          <div className="flex-1" />
          <span className="text-xs text-slate-500">{filtered.length} work orders</span>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="bms-btn-primary text-xs py-1.5">
            <Plus size={13} /> New Work Order
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="bms-table">
          <thead>
            <tr>
              <th>Work Order</th>
              <th>Structure</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Cost (UGX)</th>
              <th>Contractor</th>
              <th>Engineer</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(wo => (
              <tr key={wo.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="text-xs font-semibold text-slate-200 max-w-[200px] truncate">{wo.title}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{wo.id.slice(0, 8)}…</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs text-slate-300 max-w-[150px] truncate">{wo.structureName}</div>
                  <div className="text-[10px] text-slate-500">{wo.structureId}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{wo.type}</td>
                <td className="px-4 py-3"><span className={`badge ${PRIORITY_BADGE[wo.priority]}`}>{wo.priority}</span></td>
                <td className="px-4 py-3">
                  <span className={`badge ${STATUS_COLORS[wo.status]} flex items-center gap-1`}>
                    {STATUS_ICONS[wo.status]} {wo.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(wo.startDate)}</td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(wo.endDate)}</td>
                <td className="px-4 py-3 text-xs text-slate-300 font-mono whitespace-nowrap">{formatUGX(wo.cost)}</td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-[140px] truncate">{wo.contractor}</td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-[120px] truncate">{wo.engineerInCharge}</td>
                <td className="px-4 py-3">
                  <select
                    className="bms-select text-[10px] py-0.5 px-2"
                    value={wo.status}
                    onChange={e => updateStatus(wo, e.target.value as WorkOrderStatus)}
                    onClick={e => e.stopPropagation()}
                  >
                    {['Planned','In Progress','Completed','On Hold','Cancelled'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New WO form */}
      {showForm && (
        <WorkOrderForm
          structures={structures.map(s => ({ id: s.id, name: s.name }))}
          initial={editing}
          onSave={wo => { dispatch({ type: 'ADD_WORK_ORDER', payload: wo }); setShowForm(false); }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function KPIStrip({ label, value, color, isText }: { label: string; value: number | string; color: string; isText?: boolean }) {
  return (
    <div className="flex flex-col items-center py-3 bg-slate-900">
      <div className={`${isText ? 'text-sm' : 'text-xl'} font-bold ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5 text-center px-1">{label}</div>
    </div>
  );
}

function WorkOrderForm({
  structures, initial, onSave, onClose,
}: {
  structures: { id: string; name: string }[];
  initial: WorkOrder | null;
  onSave: (wo: WorkOrder) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [f, setF] = useState<Partial<WorkOrder>>(initial ?? {
    structureId:     structures[0]?.id ?? '',
    title:           '',
    description:     '',
    type:            'Routine Maintenance',
    status:          'Planned',
    priority:        'Medium',
    startDate:       today,
    endDate:         '',
    cost:            0,
    contractor:      '',
    engineerInCharge: '',
    notes:           '',
  });

  function set(key: string, value: unknown) {
    setF(prev => ({ ...prev, [key]: value }));
  }

  function save() {
    const struct = structures.find(s => s.id === f.structureId);
    const wo: WorkOrder = {
      id:               initial?.id ?? uuidv4(),
      structureId:      f.structureId!,
      structureName:    struct?.name ?? f.structureId!,
      title:            f.title ?? 'Untitled',
      description:      f.description ?? '',
      type:             (f.type as WorkOrderType) ?? 'Routine Maintenance',
      status:           (f.status as WorkOrderStatus) ?? 'Planned',
      priority:         (f.priority as WorkOrderPriority) ?? 'Medium',
      startDate:        f.startDate!,
      endDate:          f.endDate ?? '',
      cost:             Number(f.cost ?? 0),
      contractor:       f.contractor ?? '',
      engineerInCharge: f.engineerInCharge ?? '',
      createdAt:        initial?.createdAt ?? new Date().toISOString(),
      notes:            f.notes ?? '',
    };
    onSave(wo);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-blue-400" />
            <span className="font-bold text-white">{initial ? 'Edit Work Order' : 'New Work Order'}</span>
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
          <div className="col-span-2">
            <label className="bms-label">Title</label>
            <input className="bms-input" value={f.title} onChange={e => set('title', e.target.value)} placeholder="Work order title…" />
          </div>
          <div>
            <label className="bms-label">Type</label>
            <select className="bms-select" value={f.type} onChange={e => set('type', e.target.value)}>
              {['Routine Maintenance','Preventive','Rehabilitation','Emergency Repair','Reconstruction'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="bms-label">Priority</label>
            <select className="bms-select" value={f.priority} onChange={e => set('priority', e.target.value)}>
              {['Low','Medium','High','Critical'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="bms-label">Status</label>
            <select className="bms-select" value={f.status} onChange={e => set('status', e.target.value)}>
              {['Planned','In Progress','Completed','On Hold','Cancelled'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="bms-label">Cost (UGX)</label>
            <input className="bms-input" type="number" value={f.cost} onChange={e => set('cost', e.target.value)} />
          </div>
          <div>
            <label className="bms-label">Start Date</label>
            <input className="bms-input" type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} />
          </div>
          <div>
            <label className="bms-label">End Date</label>
            <input className="bms-input" type="date" value={f.endDate} onChange={e => set('endDate', e.target.value)} />
          </div>
          <div>
            <label className="bms-label">Contractor</label>
            <input className="bms-input" value={f.contractor} onChange={e => set('contractor', e.target.value)} placeholder="Contractor name…" />
          </div>
          <div>
            <label className="bms-label">Engineer in Charge</label>
            <input className="bms-input" value={f.engineerInCharge} onChange={e => set('engineerInCharge', e.target.value)} placeholder="Engineer…" />
          </div>
          <div className="col-span-2">
            <label className="bms-label">Description</label>
            <textarea className="bms-input h-20 resize-none" value={f.description} onChange={e => set('description', e.target.value)} placeholder="Scope of works…" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="bms-btn-secondary">Cancel</button>
          <button onClick={save} className="bms-btn-primary">
            <CheckCircle2 size={14} /> Save Work Order
          </button>
        </div>
      </div>
    </div>
  );
}
