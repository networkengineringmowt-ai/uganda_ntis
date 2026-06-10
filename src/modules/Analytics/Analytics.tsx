import { useMemo, useState, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { Download, FileImage, FileText } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import { downloadCSV } from '../../utils/downloads';
import { conditionLabel, formatUGX, CONDITION_COLORS } from '../../utils/helpers';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  PieChart, Pie,
  AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line,
} from 'recharts';
import { NEON, REGION_NEON, Bar3D, GlowDefs, Chart3DWrap, AreaGradDefs, TT_NEON, TICK, TICK_SM, AX_LINE } from '../../lib/chart3d';

type Tab = 'condition' | 'age' | 'cost' | 'region' | 'radar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'condition', label: 'Condition Distribution' },
  { id: 'age',       label: 'Age Analysis' },
  { id: 'cost',      label: 'Cost Trends' },
  { id: 'region',    label: 'Road-by-Road' },
  { id: 'radar',     label: 'Risk Radar' },
];

export default function Analytics() {
  const { state }  = useBMS();
  const { structures, workOrders } = state;
  const [tab, setTab] = useState<Tab>('condition');
  const chartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const exportPNG = useCallback(async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(chartRef.current, {
        backgroundColor: '#0f172a',
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Department of National Roads_Analytics_${tab}_${new Date().toISOString().slice(0,10)}.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  }, [tab]);

  const exportPDF = useCallback(async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(chartRef.current, { backgroundColor: '#0f172a', pixelRatio: 2 });
      const w = window.open('', '_blank');
      if (!w) return;
      const tabLabel = TABS.find(t => t.id === tab)?.label ?? tab;
      w.document.write(`<!DOCTYPE html><html><head><title>Department of National Roads Analytics — ${tabLabel}</title>
        <style>
          body { margin:0; background:#0f172a; display:flex; flex-direction:column; align-items:center; padding:32px; font-family:sans-serif; color:#e2e8f0; }
          h1 { font-size:18px; margin-bottom:8px; }
          p  { font-size:12px; color:#64748b; margin-bottom:24px; }
          img{ max-width:100%; border-radius:12px; }
        </style></head><body>
        <h1>Department of National Roads Bridge Management System — ${tabLabel}</h1>
        <p>Generated ${new Date().toLocaleString()} · ${structures.length.toLocaleString()} structures</p>
        <img src="${dataUrl}" />
        <script>window.onload=()=>window.print();</script>
        </body></html>`);
      w.document.close();
    } finally {
      setExporting(false);
    }
  }, [tab, structures.length]);

  // ─── Condition distribution ───────────────────────────────────────────────
  const condData = useMemo(() => {
    const cnt: Record<number, number> = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    structures.forEach(s => cnt[s.conditionRating]++);
    return [5,4,3,2,1].map(r => ({
      name:    `${r} – ${conditionLabel(r)}`,
      bridges: structures.filter(s => s.type === 'bridge' && s.conditionRating === r).length,
      culverts:structures.filter(s => s.type === 'culvert'&& s.conditionRating === r).length,
      total:   cnt[r],
      color:   CONDITION_COLORS[r],
    }));
  }, [structures]);

  // ─── Age analysis ─────────────────────────────────────────────────────────
  const ageData = useMemo(() => {
    const bands = [
      { label: '<10yr', min: 2015, max: 2099 },
      { label: '10-20', min: 2005, max: 2014 },
      { label: '20-30', min: 1995, max: 2004 },
      { label: '30-40', min: 1985, max: 1994 },
      { label: '40-50', min: 1975, max: 1984 },
      { label: '>50yr', min: 0,    max: 1974 },
    ];
    return bands.map(b => {
      const inBand = structures.filter(s => s.yearBuilt >= b.min && s.yearBuilt <= b.max);
      const avgCond = inBand.length
        ? inBand.reduce((s, x) => s + x.conditionRating, 0) / inBand.length
        : 0;
      return { label: b.label, count: inBand.length, avgCond: parseFloat(avgCond.toFixed(2)) };
    });
  }, [structures]);

  // ─── Cost trends (yearly aggregate) ──────────────────────────────────────
  const costTrend = useMemo(() => {
    const byYear: Record<number, { routine: number; rehab: number; emergency: number }> = {};
    [2020, 2021, 2022, 2023, 2024].forEach(y => {
      byYear[y] = { routine: 0, rehab: 0, emergency: 0 };
    });
    workOrders.forEach(wo => {
      const yr = new Date(wo.startDate).getFullYear();
      if (!byYear[yr]) return;
      if (wo.type === 'Routine Maintenance' || wo.type === 'Preventive') byYear[yr].routine += wo.cost;
      else if (wo.type === 'Emergency Repair') byYear[yr].emergency += wo.cost;
      else byYear[yr].rehab += wo.cost;
    });
    return Object.entries(byYear).map(([yr, v]) => ({
      year:      yr,
      Routine:   Math.round(v.routine / 1_000_000),
      Rehab:     Math.round(v.rehab   / 1_000_000),
      Emergency: Math.round(v.emergency / 1_000_000),
    }));
  }, [workOrders]);

  // ─── Road-by-road breakdown ───────────────────────────────────────────────
  const roadData = useMemo(() => {
    const byRoad: Record<string, { total: number; critical: number; poor: number; avgCond: number }> = {};
    structures.forEach(s => {
      const road = s.road || 'Unknown';
      if (!byRoad[road]) byRoad[road] = { total: 0, critical: 0, poor: 0, avgCond: 0 };
      byRoad[road].total++;
      if (s.conditionRating === 1) byRoad[road].critical++;
      if (s.conditionRating === 2) byRoad[road].poor++;
      byRoad[road].avgCond += s.conditionRating;
    });
    return Object.entries(byRoad)
      .map(([road, v]) => ({
        road: road.length > 28 ? road.slice(0, 28) + '…' : road,
        total:   v.total,
        critical:v.critical,
        poor:    v.poor,
        avgCond: parseFloat((v.avgCond / v.total).toFixed(2)),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }, [structures]);

  // ─── Risk radar ───────────────────────────────────────────────────────────
  const radarData = useMemo(() => {
    const regions = [...new Set(structures.map(s => s.region))].filter(Boolean);
    return regions.map(region => {
      const rs = structures.filter(s => s.region === region);
      const avgPriority = rs.reduce((s, x) => s + x.priorityScore, 0) / rs.length;
      const critPct     = (rs.filter(s => s.conditionRating <= 2).length / rs.length) * 100;
      const avgAge      = rs.reduce((s, x) => s + (2024 - x.yearBuilt), 0) / rs.length;
      return {
        subject: region,
        avgPriority: Math.round(avgPriority),
        critPct:     Math.round(critPct),
        avgAge:      Math.round(avgAge / 10) * 10,
      };
    });
  }, [structures]);

  // Condition history for line chart
  const condHistory = useMemo(() => {
    return [2018,2019,2020,2021,2022,2023,2024].map(year => {
      const cnt: Record<number,number> = {1:0,2:0,3:0,4:0,5:0};
      structures.slice(0,300).forEach(s => {
        const h = s.conditionHistory.find(c => c.year === year);
        cnt[h?.rating ?? s.conditionRating]++;
      });
      return { year, ...cnt };
    });
  }, [structures]);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Tab bar */}
      <div className="flex-shrink-0 flex items-center gap-1 px-6 py-3 border-b border-slate-700/60 bg-slate-900/50 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors
              ${tab !== t.id ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50' : ''}`}
            style={tab === t.id
              ? { background: 'rgba(0,245,255,0.15)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.3)', borderRadius: 8 }
              : undefined}
          >{t.label}</button>
        ))}
        <div className="flex-1" />
        <button
          onClick={exportPNG}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 disabled:opacity-50 whitespace-nowrap"
        >
          <FileImage size={12} /> {exporting ? 'Exporting…' : 'PNG'}
        </button>
        <button
          onClick={exportPDF}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 disabled:opacity-50 whitespace-nowrap"
        >
          <FileText size={12} /> PDF
        </button>
        <button
          onClick={() => downloadCSV(structures, `Department of National Roads_Structures_${new Date().toISOString().slice(0,10)}.csv`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 whitespace-nowrap"
        >
          <Download size={12} /> CSV
        </button>
      </div>

      <div ref={chartRef} className="flex-1 overflow-y-auto p-6">
        {tab === 'condition' && <ConditionTab condData={condData} condHistory={condHistory} />}
        {tab === 'age'       && <AgeTab ageData={ageData} />}
        {tab === 'cost'      && <CostTab costTrend={costTrend} workOrders={workOrders} />}
        {tab === 'region'    && <RegionTab roadData={roadData} />}
        {tab === 'radar'     && <RadarTab radarData={radarData} />}
      </div>
    </div>
  );
}

// ─── Condition Tab ────────────────────────────────────────────────────────────
function ConditionTab({ condData, condHistory }: { condData: any[]; condHistory: any[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stacked bar */}
        <div className="bms-card">
          <h3 className="text-sm font-bold text-white mb-4">Condition by Category (Bridges vs Culverts)</h3>
          <Chart3DWrap>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={condData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.06)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ ...TICK }} axisLine={false} tickLine={false} />
                <YAxis tick={{ ...TICK }} axisLine={false} tickLine={false} />
                <Tooltip {...TT_NEON} />
                <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
                <Bar dataKey="bridges"  name="Bridges"  fill="#4d9fff" radius={[4,4,0,0]} animationDuration={1200} shape={<Bar3D />} />
                <Bar dataKey="culverts" name="Culverts" fill="#00f5ff" radius={[4,4,0,0]} animationDuration={1200} shape={<Bar3D />} />
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>

        {/* Pie */}
        <div className="bms-card">
          <h3 className="text-sm font-bold text-white mb-4">Overall Condition Split</h3>
          <Chart3DWrap>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <GlowDefs id="pie" />
                <Pie
                  data={condData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="total"
                  animationDuration={1200}
                  label={({ name, percent }) => `${(percent*100).toFixed(0)}%`}
                  labelLine={{ stroke:'#475569' }}
                  style={{ filter: 'url(#pieglow)' }}
                >
                  {condData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip {...TT_NEON} formatter={(v: number, n: string, p: any) => [v, p.payload.name]} />
              </PieChart>
            </ResponsiveContainer>
          </Chart3DWrap>
          <div className="flex flex-wrap gap-3 mt-2">
            {condData.map((d: any) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                <span className="text-slate-400">{d.name} ({d.total})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Network trend over time */}
      <div className="bms-card">
        <h3 className="text-sm font-bold text-white mb-4">Network Condition Trend 2018–2024</h3>
        <Chart3DWrap>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={condHistory} margin={{ top:4, right:12, left:0, bottom:0 }}>
              <GlowDefs id="cond" />
              <CartesianGrid stroke="rgba(148,163,184,0.06)" strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ ...TICK }} axisLine={false} tickLine={false} />
              <YAxis tick={{ ...TICK }} axisLine={false} tickLine={false} />
              <Tooltip {...TT_NEON} />
              <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
              {[5,4,3,2,1].map(r => (
                <Area key={r} type="monotone" dataKey={r} name={conditionLabel(r)}
                  stroke={CONDITION_COLORS[r]} fill={`url(#condng${r % NEON.length})`}
                  strokeWidth={1.5} animationDuration={1200}
                  filter="url(#condglow)" />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Chart3DWrap>
      </div>
    </div>
  );
}

// ─── Age Tab ──────────────────────────────────────────────────────────────────
function AgeTab({ ageData }: { ageData: any[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bms-card">
          <h3 className="text-sm font-bold text-white mb-4">Structure Count by Age Band</h3>
          <Chart3DWrap>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ageData} margin={{ top:4, right:12, left:0, bottom:0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.06)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ ...TICK }} axisLine={false} tickLine={false} />
                <YAxis tick={{ ...TICK }} axisLine={false} tickLine={false} />
                <Tooltip {...TT_NEON} />
                <Bar dataKey="count" name="Structures" radius={[4,4,0,0]} animationDuration={1200} shape={<Bar3D />}>
                  {ageData.map((_: any, i: number) => (
                    <Cell key={i} fill={NEON[i % NEON.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>

        <div className="bms-card">
          <h3 className="text-sm font-bold text-white mb-4">Avg Condition by Age Band</h3>
          <Chart3DWrap>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ageData} margin={{ top:4, right:12, left:0, bottom:0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.06)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ ...TICK }} axisLine={false} tickLine={false} />
                <YAxis domain={[0,5]} ticks={[1,2,3,4,5]} tick={{ ...TICK }} axisLine={false} tickLine={false} />
                <Tooltip {...TT_NEON} formatter={(v: number) => [v.toFixed(2), 'Avg Condition']} />
                <Bar dataKey="avgCond" name="Avg Condition" radius={[4,4,0,0]} animationDuration={1200} shape={<Bar3D />}>
                  {ageData.map((d: any, i: number) => {
                    const r = Math.round(d.avgCond);
                    return <Cell key={i} fill={CONDITION_COLORS[Math.max(1, Math.min(5, r)) as 1|2|3|4|5]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>
      </div>
    </div>
  );
}

// ─── Cost Tab ─────────────────────────────────────────────────────────────────
function CostTab({ costTrend, workOrders }: { costTrend: any[]; workOrders: any[] }) {
  const byType = useMemo(() => {
    const types: Record<string, number> = {};
    workOrders.forEach(w => { types[w.type] = (types[w.type] || 0) + w.cost; });
    return Object.entries(types)
      .map(([name, cost]) => ({ name, cost: Math.round(cost / 1_000_000) }))
      .sort((a, b) => b.cost - a.cost);
  }, [workOrders]);

  return (
    <div className="space-y-6">
      <div className="bms-card">
        <h3 className="text-sm font-bold text-white mb-4">Annual Maintenance Cost Breakdown (UGX M)</h3>
        <Chart3DWrap>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={costTrend} margin={{ top:4, right:12, left:0, bottom:0 }}>
              <AreaGradDefs id="routine" color="#4d9fff" />
              <AreaGradDefs id="rehab"   color="#ffd23f" />
              <AreaGradDefs id="emerg"   color="#ff2d78" />
              <CartesianGrid stroke="rgba(148,163,184,0.06)" strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ ...TICK }} axisLine={false} tickLine={false} />
              <YAxis tick={{ ...TICK }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}M`} />
              <Tooltip {...TT_NEON} formatter={(v: number) => [`${v} M UGX`]} />
              <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
              <Area type="monotone" dataKey="Routine"   stroke="#4d9fff" fill="url(#routine)" strokeWidth={2} animationDuration={1200} filter="url(#routineglow)" />
              <Area type="monotone" dataKey="Rehab"     stroke="#ffd23f" fill="url(#rehab)"   strokeWidth={2} animationDuration={1200} filter="url(#rehabglow)" />
              <Area type="monotone" dataKey="Emergency" stroke="#ff2d78" fill="url(#emerg)"   strokeWidth={2} animationDuration={1200} filter="url(#emerglow)" />
            </AreaChart>
          </ResponsiveContainer>
        </Chart3DWrap>
      </div>

      <div className="bms-card">
        <h3 className="text-sm font-bold text-white mb-4">Cost by Work Type (UGX M)</h3>
        <Chart3DWrap>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byType} layout="vertical" margin={{ top:4, right:40, left:80, bottom:0 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.06)" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ ...TICK_SM }} tickFormatter={(v: number) => `${v}M`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill:'rgba(148,163,184,0.5)', fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TT_NEON} formatter={(v: number) => [`${v} M UGX`]} />
              <Bar dataKey="cost" fill="#4d9fff" radius={[0,4,4,0]} animationDuration={1200} shape={<Bar3D />} />
            </BarChart>
          </ResponsiveContainer>
        </Chart3DWrap>
      </div>
    </div>
  );
}

// ─── Region Tab ───────────────────────────────────────────────────────────────
function RegionTab({ roadData }: { roadData: any[] }) {
  return (
    <div className="space-y-6">
      <div className="bms-card">
        <h3 className="text-sm font-bold text-white mb-4">Top 20 Roads — Structure Count & Condition Issues</h3>
        <Chart3DWrap>
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={roadData} layout="vertical" margin={{ top:4, right:40, left:180, bottom:0 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.06)" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ ...TICK_SM }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="road" tick={{ fill:'rgba(148,163,184,0.5)', fontSize:10 }} axisLine={false} tickLine={false} width={175} />
              <Tooltip {...TT_NEON} />
              <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
              <Bar dataKey="total"    name="Total"    fill="#4d9fff" radius={[0,0,0,0]} animationDuration={1200} stackId="a" shape={<Bar3D />} />
              <Bar dataKey="poor"     name="Poor"     fill="#ff6b35" radius={[0,0,0,0]} animationDuration={1200} stackId="b" shape={<Bar3D />} />
              <Bar dataKey="critical" name="Critical" fill="#ff2d78" radius={[0,4,4,0]} animationDuration={1200} stackId="b" shape={<Bar3D />} />
            </BarChart>
          </ResponsiveContainer>
        </Chart3DWrap>
      </div>
    </div>
  );
}

// ─── Radar Tab ────────────────────────────────────────────────────────────────
function RadarTab({ radarData }: { radarData: any[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bms-card">
        <h3 className="text-sm font-bold text-white mb-4">Priority Score by Region</h3>
        <Chart3DWrap>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} margin={{ top:10, right:30, left:30, bottom:10 }}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="subject" tick={{ fill:'#94a3b8', fontSize:11 }} />
              <PolarRadiusAxis tick={{ ...TICK_SM }} axisLine={false} />
              <Radar name="Avg Priority" dataKey="avgPriority" stroke="#4d9fff" fill="#4d9fff" fillOpacity={0.25} animationDuration={1200} />
              <Tooltip {...TT_NEON} />
            </RadarChart>
          </ResponsiveContainer>
        </Chart3DWrap>
      </div>

      <div className="bms-card">
        <h3 className="text-sm font-bold text-white mb-4">Critical Structure % by Region</h3>
        <Chart3DWrap>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} margin={{ top:10, right:30, left:30, bottom:10 }}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="subject" tick={{ fill:'#94a3b8', fontSize:11 }} />
              <PolarRadiusAxis tick={{ ...TICK_SM }} axisLine={false} tickFormatter={(v:number) => `${v}%`} />
              <Radar name="Critical %" dataKey="critPct" stroke="#ff2d78" fill="#ff2d78" fillOpacity={0.25} animationDuration={1200} />
              <Tooltip {...TT_NEON} formatter={(v:number) => [`${v}%`, 'Critical']} />
            </RadarChart>
          </ResponsiveContainer>
        </Chart3DWrap>
      </div>

      <div className="bms-card lg:col-span-2">
        <h3 className="text-sm font-bold text-white mb-4">Average Age by Region</h3>
        <Chart3DWrap>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={radarData} margin={{ top:4, right:12, left:0, bottom:0 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.06)" strokeDasharray="3 3" />
              <XAxis dataKey="subject" tick={{ ...TICK }} axisLine={false} tickLine={false} />
              <YAxis tick={{ ...TICK }} axisLine={false} tickLine={false} tickFormatter={(v:number) => `${v}yr`} />
              <Tooltip {...TT_NEON} formatter={(v:number) => [`${v} yrs`, 'Avg Age']} />
              <Bar dataKey="avgAge" fill="#b967ff" radius={[4,4,0,0]} animationDuration={1200} shape={<Bar3D />} />
            </BarChart>
          </ResponsiveContainer>
        </Chart3DWrap>
      </div>
    </div>
  );
}
