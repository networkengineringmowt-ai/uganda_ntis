import { useMemo } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, TrendingUp,
  Building2, Layers, Wrench, BarChart2,
} from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import { conditionColor, conditionLabel, formatUGX, formatDate } from '../../utils/helpers';

export default function Dashboard() {
  const { state, navigate } = useBMS();
  const { structures, workOrders, inspections } = state;

  const stats = useMemo(() => {
    const bridges  = structures.filter(s => s.type === 'bridge');
    const culverts = structures.filter(s => s.type === 'culvert');

    const byCond: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    structures.forEach(s => { byCond[s.conditionRating]++; });

    const overdue   = structures.filter(s => s.inspectionDue).length;
    const critical  = byCond[1];
    const poor      = byCond[2];
    const activeWOs = workOrders.filter(w => w.status === 'In Progress').length;
    const totalCost = workOrders.reduce((sum, w) => sum + w.cost, 0);

    // Region breakdown
    const byRegion: Record<string, number> = {};
    structures.forEach(s => {
      const r = s.region || 'Unknown';
      byRegion[r] = (byRegion[r] || 0) + 1;
    });

    return {
      totalBridges: bridges.length,
      totalCulverts: culverts.length,
      totalStructures: structures.length,
      byCond,
      overdue,
      critical,
      poor,
      activeWOs,
      totalCost,
      byRegion,
    };
  }, [structures, workOrders]);

  // Most critical structures for alert panel
  const topCritical = useMemo(() =>
    structures
      .filter(s => s.conditionRating <= 2)
      .sort((a, b) => a.conditionRating - b.conditionRating || b.priorityScore - a.priorityScore)
      .slice(0, 8),
    [structures],
  );

  // Recent inspections
  const recentInsp = useMemo(() =>
    [...inspections]
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 6),
    [inspections],
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in">
      {/* ─── KPI Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Bridges"
          value={stats.totalBridges}
          icon={<Building2 size={20} />}
          color="blue"
          sub={`${stats.totalStructures} total structures`}
          onClick={() => navigate('registry')}
        />
        <KPICard
          label="Major Culverts"
          value={stats.totalCulverts}
          icon={<Layers size={20} />}
          color="cyan"
          sub={`Across Uganda road network`}
          onClick={() => navigate('registry')}
        />
        <KPICard
          label="Critical Structures"
          value={stats.critical + stats.poor}
          icon={<AlertTriangle size={20} />}
          color="red"
          sub={`${stats.critical} critical · ${stats.poor} poor`}
          onClick={() => navigate('priority')}
          pulse={stats.critical > 0}
        />
        <KPICard
          label="Inspections Due"
          value={stats.overdue}
          icon={<Clock size={20} />}
          color="amber"
          sub={`${stats.activeWOs} works in progress`}
          onClick={() => navigate('inspections')}
        />
      </div>

      {/* ─── Second Row: KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Condition ≥ Good"  value={stats.byCond[5] + stats.byCond[4]} icon={<CheckCircle2 size={20}/>} color="green"  sub="Excellent + Good" />
        <KPICard label="Fair Condition"    value={stats.byCond[3]}                   icon={<BarChart2 size={20}/>}    color="amber"  sub="Monitoring required" />
        <KPICard label="Active Work Orders" value={stats.activeWOs}                  icon={<Wrench size={20}/>}       color="purple" sub="In progress" onClick={() => navigate('maintenance')} />
        <KPICard label="Maintenance Budget" value={formatUGX(stats.totalCost)} icon={<TrendingUp size={20}/>} color="blue" sub="Total committed" isText />
      </div>

      {/* ─── Bottom Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Critical alert list */}
        <div className="bms-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              Critical & Poor Structures
            </h3>
            <button onClick={() => navigate('priority')} className="text-xs text-blue-400 hover:text-blue-300">All {stats.critical + stats.poor} →</button>
          </div>
          <div className="space-y-2">
            {topCritical.map(s => (
              <div
                key={s.id}
                onClick={() => { navigate('registry'); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-700/40 hover:bg-slate-700/70 cursor-pointer transition-colors"
                style={{ borderLeft: `2px solid ${conditionColor(s.conditionRating)}` }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: conditionColor(s.conditionRating) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">{s.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{s.road}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-bold" style={{ color: conditionColor(s.conditionRating) }}>
                    {conditionLabel(s.conditionRating)}
                  </div>
                  <div className="text-[10px] text-slate-500">Score {s.priorityScore}</div>
                </div>
              </div>
            ))}
            {topCritical.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No critical structures — network in good health.</p>
            )}
          </div>
        </div>

        {/* Recent inspections */}
        <div className="bms-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-400" />
              Recent Inspections
            </h3>
            <button onClick={() => navigate('inspections')} className="text-xs text-blue-400 hover:text-blue-300">All inspections →</button>
          </div>
          <div className="space-y-2">
            {recentInsp.map(insp => (
              <div key={insp.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-700/40">
                <div
                  className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-sm font-bold"
                  style={{
                    background: conditionColor(insp.overallCondition) + '22',
                    color: conditionColor(insp.overallCondition),
                    boxShadow: `0 0 8px ${conditionColor(insp.overallCondition)}44`,
                  }}
                >
                  {insp.overallCondition}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">{insp.structureName}</div>
                  <div className="text-[10px] text-slate-500">{insp.inspector} · {insp.type}</div>
                </div>
                <div className="text-[10px] text-slate-500 flex-shrink-0">{formatDate(insp.date)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Region breakdown ─── */}
      <div className="bms-card">
        <h3 className="text-sm font-semibold text-white mb-4">Structures by Region</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(stats.byRegion)
            .sort(([, a], [, b]) => b - a)
            .map(([region, count]) => (
              <div key={region} className="bg-slate-700/40 hover:shadow-lg rounded-lg px-4 py-3 border border-slate-600/40 hover:border-slate-500/60 transition-all">
                <div className="text-lg font-bold text-white">{count}</div>
                <div className="text-xs text-slate-400 mt-0.5">{region}</div>
                <div className="mt-2 bg-slate-600 rounded-full h-1">
                  <div
                    className="rounded-full h-1 transition-all"
                    style={{
                      width: `${(count / stats.totalStructures) * 100}%`,
                      background: '#4d9fff',
                      boxShadow: '0 0 6px rgba(77,159,255,0.5)',
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KPICard({
  label, value, icon, color, sub, onClick, pulse, isText,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'blue' | 'cyan' | 'red' | 'amber' | 'green' | 'purple';
  sub?: string;
  onClick?: () => void;
  pulse?: boolean;
  isText?: boolean;
}) {
  const colors = {
    blue:   { bg:'bg-[#4d9fff]/10', icon:'bg-[#4d9fff]/20 text-[#4d9fff]', val:'text-[#4d9fff]' },
    cyan:   { bg:'bg-[#00f5ff]/10', icon:'bg-[#00f5ff]/20 text-[#00f5ff]', val:'text-[#00f5ff]' },
    red:    { bg:'bg-[#ff2d78]/10', icon:'bg-[#ff2d78]/20 text-[#ff2d78]', val:'text-[#ff2d78]' },
    amber:  { bg:'bg-[#ffd23f]/10', icon:'bg-[#ffd23f]/20 text-[#ffd23f]', val:'text-[#ffd23f]' },
    green:  { bg:'bg-[#00ff88]/10', icon:'bg-[#00ff88]/20 text-[#00ff88]', val:'text-[#00ff88]' },
    purple: { bg:'bg-[#b967ff]/10', icon:'bg-[#b967ff]/20 text-[#b967ff]', val:'text-[#b967ff]' },
  };
  const c = colors[color];

  return (
    <div
      className={`bms-card flex items-start gap-4 ${onClick ? 'cursor-pointer hover:bg-slate-700 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon} ${pulse ? 'animate-pulse' : ''}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className={`text-2xl font-bold leading-tight ${c.val} ${isText ? 'text-lg' : ''}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="text-xs font-semibold text-slate-300 mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-slate-500 mt-1">{sub}</div>}
      </div>
    </div>
  );
}
