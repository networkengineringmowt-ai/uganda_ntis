import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine,
} from 'recharts';
import { Chart3DWrap, Bar3D, TT_NEON, TICK } from '../../lib/chart3d';
import { DollarSign, Wrench, AlertTriangle, TrendingDown } from 'lucide-react';
import { ModuleNavBar } from '../../shared/ModuleNavBar';
import SourceTableButton from '../../shared/SourceTableButton';
import { useSectionData } from '../../hooks/useSectionData';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';

const C = {
  cyan: '#00f5ff', green: '#00ff88', yellow: '#ffd23f',
  orange: '#ff6b35', purple: '#b967ff', blue: '#4d9fff',
  pink: '#ff2d78', teal: '#00d4aa', red: '#ff3366',
};
function hexRgb(h: string) {
  const c = h.replace('#','');
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}
const card = (a: string) => ({
  background: 'rgba(15,23,42,0.7)',
  border: `1px solid rgba(${hexRgb(a)},0.2)`,
  borderRadius: 12, padding: '18px 20px',
});
const TK = { fontSize: 9, fill: 'rgba(148,163,184,0.6)' };

const MAINT_BUDGET = [
  { fy: '2015/16', required: 480, allocated: 245, received: 210, gap: 235 },
  { fy: '2016/17', required: 520, allocated: 285, received: 255, gap: 235 },
  { fy: '2017/18', required: 560, allocated: 320, received: 290, gap: 240 },
  { fy: '2018/19', required: 680, allocated: 356, received: 302, gap: 324 },
  { fy: '2019/20', required: 710, allocated: 380, received: 340, gap: 330 },
  { fy: '2020/21', required: 740, allocated: 290, received: 265, gap: 450 },
  { fy: '2021/22', required: 780, allocated: 420, received: 388, gap: 360 },
  { fy: '2022/23', required: 820, allocated: 480, received: 452, gap: 340 },
  { fy: '2023/24', required: 870, allocated: 520, received: 490, gap: 350 },
  { fy: '2024/25', required: 920, allocated: 580, received: null, gap: 340 },
];

const INTERVENTION_MATRIX = [
  { type: 'Routine',   label: 'Routine Maintenance',    trigger: 'IRI < 4.0 m/km; scheduled annual',          paved: 'UGX 42M/km/yr', unpaved: 'UGX 28M/km/yr', life_ext: '+0–2 yrs', color: C.green  },
  { type: 'Preventive', label: 'Preventive Seal',        trigger: 'IRI 3.5–5.0; cracking <10% area',           paved: 'UGX 165M/km',  unpaved: '—',              life_ext: '+5–8 yrs',  color: C.teal   },
  { type: 'Periodic',  label: 'Reseal (1-coat SD)',      trigger: 'IRI 4.0–5.5; cracking 10–20%',              paved: 'UGX 220M/km',  unpaved: '—',              life_ext: '+6–8 yrs',  color: C.cyan   },
  { type: 'Periodic',  label: 'Thin overlay (30mm)',     trigger: 'IRI 5.0–6.5; cracking >20%, some rutting',  paved: 'UGX 520M/km',  unpaved: '—',              life_ext: '+8–10 yrs', color: C.yellow },
  { type: 'Periodic',  label: 'Gravel Resheet',          trigger: 'Gravel loss >30mm; seasonal passability',   paved: '—',            unpaved: 'UGX 230M/km',    life_ext: '+3–5 yrs',  color: C.orange },
  { type: 'Rehab',     label: 'Structural overlay 60mm', trigger: 'IRI 6.5–8.0; deep rutting; SN deficiency', paved: 'UGX 900M/km',  unpaved: '—',              life_ext: '+12–15 yrs',color: C.orange },
  { type: 'Rehab',     label: 'Full Rehabilitation',     trigger: 'IRI > 8.0; widespread failure',              paved: 'UGX 2,200M/km',unpaved: 'UGX 1,500M/km', life_ext: '+20 yrs',   color: C.red    },
  { type: 'Emergency', label: 'Emergency Repair',        trigger: 'Washout / landslip / sudden failure',        paved: 'UGX 48M/site', unpaved: 'UGX 32M/site',   life_ext: 'Varies',    color: C.pink   },
];

const DEFAULT_REGION_DATA = [
  { region: 'Central',       km: 4436, routine: 186, periodic: 140, rehab: 220, total: 546, required: 542.3, allocated: 0, gap: 542.3, coverage_pct: 0 },
  { region: 'Eastern',       km: 5292, routine: 222, periodic: 98,  rehab: 180, total: 500, required: 491.3, allocated: 0, gap: 491.3, coverage_pct: 0 },
  { region: 'Western',       km: 2997, routine: 126, periodic: 88,  rehab: 145, total: 359, required: 284.2, allocated: 0, gap: 284.2, coverage_pct: 0 },
  { region: 'Southern',      km: 3298, routine: 138, periodic: 72,  rehab: 110, total: 320, required: 739.6, allocated: 0, gap: 739.6, coverage_pct: 0 },
  { region: 'Northern',      km: 3580, routine: 150, periodic: 80,  rehab: 130, total: 360, required: 2552.6, allocated: 0, gap: 2552.6, coverage_pct: 0 },
  { region: 'North Eastern', km: 1689, routine:  71, periodic: 40,  rehab:  75, total: 186, required: 1040.2, allocated: 0, gap: 1040.2, coverage_pct: 0 },
];


const TABS = [
  { id: 'gap',      label: 'Budget Gap Analysis' },
  { id: 'matrix',   label: 'Intervention Matrix' },
  { id: 'region',   label: 'Regional Breakdown' },
  { id: 'util',     label: 'Fund Utilisation' },
] as const;
type TabId = typeof TABS[number]['id'];

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(8,14,28,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      padding: '8px 12px', borderRadius: 7, fontSize: 10 }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, fontWeight: 700 }}>
          {p.name}: {p.value != null ? p.value.toLocaleString() : 'N/A'}
        </div>
      ))}
    </div>
  );
};

export default function BudgetSection() {
  const [tab, setTab] = useState<TabId>('gap');
  const { budgetAlignment, networkSummary } = useSectionData();
  const [regionData, setRegionData] = useState(DEFAULT_REGION_DATA);

  // Update region data when budget alignment loads
  useEffect(() => {
    if (budgetAlignment && budgetAlignment.length > 0) {
      // Merge budget alignment data with default region data
      const merged = DEFAULT_REGION_DATA.map((d: any) => {
        const budgetInfo = budgetAlignment.find((b: any) => b.region_name === d.region);
        return {
          ...d,
          required: budgetInfo?.pms_need_million || d.total || 0,
          allocated: budgetInfo?.budget_allocated_million || 0,
          gap: (budgetInfo?.pms_need_million || d.total || 0) - (budgetInfo?.budget_allocated_million || 0),
          coverage_pct: budgetInfo?.coverage_pct || 0
        };
      });
      setRegionData(merged);
    }
  }, [budgetAlignment]);

  const totalRequired = regionData.reduce((s, r) => s + r.required, 0);
  const currentAlloc = regionData.reduce((s, r) => s + r.allocated, 0);
  const fundingGap = totalRequired - currentAlloc;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <CrossLinkChipBar sectionId="budget" />
    <div style={{ padding: '20px 18px', flex: 1 }}>
      <ModuleNavBar module="Budget" />
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10,
            background: `linear-gradient(135deg, rgba(${hexRgb(C.pink)},0.25), rgba(${hexRgb(C.red)},0.1))`,
            border: `1px solid rgba(${hexRgb(C.pink)},0.4)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={16} style={{ color: C.pink }}/>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4' }}>Budgeting & Maintenance Planning</div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.65)', marginTop: 1 }}>
              Annual M&R budgets · funding gaps · intervention cost matrix · regional allocation
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: 'FY24/25 Required', value: `UGX ${totalRequired}B`, sub: 'All maintenance types', color: C.red, icon: <AlertTriangle size={14}/> },
            { label: 'Allocated FY24/25', value: `UGX ${currentAlloc}B`, sub: 'Approved budget', color: C.yellow, icon: <DollarSign size={14}/> },
            { label: 'Funding Gap', value: `UGX ${fundingGap.toFixed(0)}B`, sub: `${Math.round(fundingGap/totalRequired*100)}% underfunded`, color: C.pink, icon: <TrendingDown size={14}/> },
            { label: 'Network Covered', value: `${networkSummary?.total_length_km || 21160} km`, sub: `${networkSummary?.regions_count || 6} regions · 2026`, color: C.green, icon: <Wrench size={14}/> },
          ].map(k => (
            <div key={k.label} style={{ background: `rgba(${hexRgb(k.color)},0.06)`,
              border: `1px solid rgba(${hexRgb(k.color)},0.2)`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: k.color }}>{k.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)', marginTop: 4, textTransform: 'uppercase' }}>{k.label}</div>
              <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.5)' }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BMS-style tab bar ── */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 0 0 0', marginBottom: 18, flexShrink: 0,
        borderBottom: '1px solid rgba(77,159,255,0.15)',
        background: 'rgba(4,9,18,0.85)', marginLeft: -18, marginRight: -18, paddingLeft: 14,
      }}>
        {TABS.map(t => {
          const isA = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px', fontSize: 11, fontWeight: isA ? 800 : 500,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: isA ? '#4d9fff' : 'rgba(148,163,184,0.70)',
              borderBottom: isA ? '2px solid #4d9fff' : '2px solid transparent',
              transition: 'all 0.13s',
            }}>{t.label}</button>
          );
        })}
      </div>

      {/* Gap Analysis */}
      {tab === 'gap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card(C.pink)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.pink, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Maintenance Budget vs Needs 2015/16–2024/25 (UGX Billions)
              </div>
              <SourceTableButton anchor="tbl-020" />
            </div>
            <Chart3DWrap>
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={MAINT_BUDGET} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                  <XAxis dataKey="fy" tick={{ ...TK, fontSize: 8 }} angle={-30} textAnchor="end"/>
                  <YAxis tick={TK} label={{ value: 'UGX Bn', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: 'rgba(148,163,184,0.5)' } }}/>
                  <Tooltip content={<CT/>}/>
                  <Legend wrapperStyle={{ fontSize: 10 }}/>
                  <Bar dataKey="required"  name="Required"  fill={C.red}    radius={[4,4,0,0]} opacity={0.7} shape={<Bar3D/>}/>
                  <Bar dataKey="allocated" name="Allocated" fill={C.yellow} radius={[4,4,0,0]} shape={<Bar3D/>}/>
                  <Bar dataKey="received"  name="Released"  fill={C.green}  radius={[4,4,0,0]} shape={<Bar3D/>}/>
                </BarChart>
              </ResponsiveContainer>
            </Chart3DWrap>
          </div>
          <div style={card(C.orange)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Cumulative Funding Gap Trend (UGX Bn)
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={MAINT_BUDGET} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                <XAxis dataKey="fy" tick={{ ...TK, fontSize: 8 }} angle={-30} textAnchor="end"/>
                <YAxis tick={TK}/>
                <Tooltip content={<CT/>}/>
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)"/>
                <Line type="monotone" dataKey="gap" name="Annual Gap" stroke={C.red} strokeWidth={2.5} dot={{ r: 3 }}/>
              </LineChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 8 }}>
              The maintenance funding gap averages UGX 340B/year (2018–2024), representing ~40% of required budget.
              Chronic underfunding accelerates network deterioration beyond what periodic rehabilitation can recover.
            </div>
          </div>
        </div>
      )}

      {/* Intervention Matrix */}
      {tab === 'matrix' && (
        <div style={card(C.cyan)}>
          <div style={{ fontSize: 11, fontWeight: 900, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Road Maintenance Intervention Cost Matrix — Uganda FY 2024/25
          </div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', marginBottom: 14 }}>
            Source: MoWT Schedule of Rates + Department of National Roads Contract Management. Costs per km unless noted. Excludes VAT.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {['Category', 'Intervention', 'Trigger Criteria', 'Paved Cost', 'Unpaved Cost', 'Life Extension'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9,
                      fontWeight: 900, color: `rgba(${hexRgb(C.cyan)},0.8)`,
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      borderBottom: `1px solid rgba(${hexRgb(C.cyan)},0.15)`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INTERVENTION_MATRIX.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 800,
                        background: `rgba(${hexRgb(r.color)},0.1)`, color: r.color }}>{r.type}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#d4dde8', fontWeight: 600 }}>{r.label}</td>
                    <td style={{ padding: '8px 12px', color: 'rgba(148,163,184,0.7)', fontSize: 10, maxWidth: 220 }}>{r.trigger}</td>
                    <td style={{ padding: '8px 12px', color: C.cyan, fontWeight: 700, fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>{r.paved}</td>
                    <td style={{ padding: '8px 12px', color: C.yellow, fontWeight: 700, fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>{r.unpaved}</td>
                    <td style={{ padding: '8px 12px', color: r.color, fontWeight: 800, fontSize: 10 }}>{r.life_ext}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Regional Breakdown */}
      {tab === 'region' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card(C.green)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Required Maintenance Budget by Region (UGX Billions, FY 2024/25)
              </div>
              <SourceTableButton anchor="tbl-021" />
            </div>
            <Chart3DWrap>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={regionData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                  <XAxis dataKey="region" tick={TK}/>
                  <YAxis tick={TK}/>
                  <Tooltip content={<CT/>}/>
                  <Legend wrapperStyle={{ fontSize: 10 }}/>
                  <Bar dataKey="routine"  name="Routine"  stackId="a" fill={C.green}  radius={[0,0,0,0]} shape={<Bar3D/>}/>
                  <Bar dataKey="periodic" name="Periodic" stackId="a" fill={C.yellow} radius={[0,0,0,0]} shape={<Bar3D/>}/>
                  <Bar dataKey="rehab"    name="Rehab"    stackId="a" fill={C.orange} radius={[4,4,0,0]} shape={<Bar3D/>}/>
                </BarChart>
              </ResponsiveContainer>
            </Chart3DWrap>
          </div>
          <div style={{ overflowX: 'auto', ...card(C.blue) }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Detailed Regional Budget Breakdown (UGX Billions)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {['Region', 'Network km', 'Routine', 'Periodic', 'Rehab', 'Total Required', 'UGX/km'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Region' ? 'left' : 'right', fontSize: 9,
                      fontWeight: 900, color: `rgba(${hexRgb(C.blue)},0.8)`,
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      borderBottom: `1px solid rgba(${hexRgb(C.blue)},0.15)` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regionData.map((r, i) => (
                  <tr key={r.region} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 800, color: '#d4dde8' }}>{r.region}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'rgba(148,163,184,0.6)' }}>{r.km.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: C.green, fontWeight: 700 }}>{r.routine}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: C.yellow, fontWeight: 700 }}>{r.periodic}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: C.orange, fontWeight: 700 }}>{r.rehab}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: C.cyan, fontWeight: 800, fontSize: 12 }}>{r.total}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'rgba(148,163,184,0.55)', fontSize: 10 }}>
                      {Math.round(r.total * 1000 / r.km)}M
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: `1px solid rgba(${hexRgb(C.blue)},0.2)`, fontWeight: 900 }}>
                  <td style={{ padding: '10px 12px', color: '#e2eaf4' }}>TOTAL</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'rgba(148,163,184,0.7)' }}>
                    {regionData.reduce((s,r) => s + r.km, 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: C.green }}>
                    {regionData.reduce((s,r) => s + r.routine, 0)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: C.yellow }}>
                    {regionData.reduce((s,r) => s + r.periodic, 0)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: C.orange }}>
                    {regionData.reduce((s,r) => s + r.rehab, 0)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: C.cyan, fontSize: 13 }}>
                    {totalRequired}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'rgba(148,163,184,0.55)', fontSize: 10 }}>
                    {Math.round(totalRequired * 1000 / regionData.reduce((s,r) => s + r.km, 0))}M avg
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fund Utilisation */}
      {tab === 'util' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={card(C.teal)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Fund Utilisation Rate by Year
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MAINT_BUDGET.filter(r => r.received != null).map(r => {
                const rate = Math.round((r.received! / r.allocated) * 100);
                return (
                  <div key={r.fy} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 48, fontSize: 10, color: 'rgba(148,163,184,0.6)', flexShrink: 0 }}>{r.fy}</div>
                    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${rate}%`, height: '100%',
                        background: rate > 90 ? C.green : rate > 75 ? C.yellow : C.orange,
                        borderRadius: 3, transition: 'width 0.5s' }}/>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, minWidth: 36, textAlign: 'right',
                      color: rate > 90 ? C.green : rate > 75 ? C.yellow : C.orange }}>{rate}%</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 12 }}>
              Average utilisation: {Math.round(MAINT_BUDGET.filter(r=>r.received).reduce((s,r)=>(s+(r.received!/r.allocated)*100),0)/MAINT_BUDGET.filter(r=>r.received).length)}%
              Absorption capacity constrained by procurement timelines and contractor availability.
            </div>
          </div>
          <div style={card(C.purple)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Maintenance Funding Sources
            </div>
            {[
              { source: 'Uganda Road Fund (URF)', amount: 'UGX 380B', share: '65%', desc: 'Fuel levy, transit tolls, road user charges', color: C.cyan },
              { source: 'GoU Consolidated Fund', amount: 'UGX 120B', share: '21%', desc: 'General government budget allocation', color: C.yellow },
              { source: 'World Bank (RSSP)', amount: 'UGX 55B',  share: '9%',  desc: 'Road Sector Support Project — maintenance component', color: C.blue },
              { source: 'AfDB Emergency',         amount: 'UGX 25B',  share: '4%',  desc: 'Disaster/emergency road repairs', color: C.green },
            ].map(s => (
              <div key={s.source} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.source}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 10, color: '#d4dde8', fontWeight: 800 }}>{s.amount}</span>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4,
                      background: `rgba(${hexRgb(s.color)},0.1)`, color: s.color, fontWeight: 800 }}>{s.share}</span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
