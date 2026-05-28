import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Construction, CheckCircle2, Clock, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';

const C = {
  cyan: '#00f5ff', green: '#00ff88', yellow: '#ffd23f',
  orange: '#ff6b35', purple: '#b967ff', blue: '#4d9fff',
  pink: '#ff2d78', teal: '#00d4aa', red: '#ff3366', gray: '#94a3b8',
};
function hexRgb(h: string) {
  const c = h.replace('#','');
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

type Phase = 'Planning' | 'Design' | 'Procurement' | 'Construction' | 'DLP' | 'Complete';
const PHASE_ORDER: Phase[] = ['Planning', 'Design', 'Procurement', 'Construction', 'DLP', 'Complete'];
const PHASE_COLOR: Record<Phase, string> = {
  Planning: C.purple, Design: C.blue, Procurement: C.cyan,
  Construction: C.orange, DLP: C.yellow, Complete: C.green,
};

interface Project {
  id:        string;
  name:      string;
  road:      string;
  region:    string;
  funder:    string;
  contractor: string;
  lengthKm:  number;
  budgetBn:  number;
  spentBn:   number;
  phase:     Phase;
  physical:  number;
  financial: number;
  planned:   number;
  startDate: string;
  endDate:   string;
  behind:    boolean;
  category:  'OPRC' | 'NDPIV' | 'Vision2040' | 'Emergency';
}

const PROJECTS: Project[] = [
  {
    id: 'P001', name: 'Kampala–Jinja Expressway (KJE)',
    road: 'Expressway', region: 'Central', funder: 'GoU / PPP Consortium',
    contractor: 'TBA (Procurement)', lengthKm: 95, budgetBn: 4200, spentBn: 85,
    phase: 'Procurement', physical: 5, financial: 2, planned: 8,
    startDate: '2024-01', endDate: '2028-12', behind: false, category: 'NDPIV',
  },
  {
    id: 'P002', name: 'Tirinyi–Mbale–Soroti Upgrading',
    road: 'A109', region: 'Eastern', funder: 'World Bank / IDA',
    contractor: 'China State Construction', lengthKm: 272, budgetBn: 2730, spentBn: 420,
    phase: 'Construction', physical: 22, financial: 15, planned: 35,
    startDate: '2023-06', endDate: '2026-12', behind: true, category: 'NDPIV',
  },
  {
    id: 'P003', name: 'Gulu–Atiak Highway',
    road: 'A1', region: 'Northern', funder: 'AfDB',
    contractor: 'CCCC (China)', lengthKm: 74, budgetBn: 735, spentBn: 368,
    phase: 'Construction', physical: 58, financial: 50, planned: 55,
    startDate: '2022-01', endDate: '2025-06', behind: false, category: 'NDPIV',
  },
  {
    id: 'P004', name: 'Kyotera–Mutukula Road',
    road: 'A109', region: 'Central', funder: 'JICA',
    contractor: 'Hazama Ando', lengthKm: 76, budgetBn: 332, spentBn: 332,
    phase: 'Complete', physical: 100, financial: 100, planned: 100,
    startDate: '2018-01', endDate: '2022-12', behind: false, category: 'NDPIV',
  },
  {
    id: 'P005', name: 'Masaka–Bukakata Road Upgrading',
    road: 'C6', region: 'Southern', funder: 'GoU',
    contractor: 'DOTT Services', lengthKm: 45, budgetBn: 168, spentBn: 62,
    phase: 'Construction', physical: 35, financial: 37, planned: 50,
    startDate: '2023-09', endDate: '2026-03', behind: true, category: 'NDPIV',
  },
  {
    id: 'P006', name: 'OPRC Lot 1 — Central (Kampala environs)',
    road: 'Various A/B', region: 'Central', funder: 'World Bank RSSP',
    contractor: 'M/s CICO Roads', lengthKm: 1240, budgetBn: 380, spentBn: 215,
    phase: 'Construction', physical: 55, financial: 57, planned: 55,
    startDate: '2021-07', endDate: '2027-06', behind: false, category: 'OPRC',
  },
  {
    id: 'P007', name: 'OPRC Lot 3 — Eastern Region',
    road: 'Various A/B/C', region: 'Eastern', funder: 'World Bank RSSP',
    contractor: 'M/s Sietco', lengthKm: 1680, budgetBn: 420, spentBn: 168,
    phase: 'Construction', physical: 38, financial: 40, planned: 45,
    startDate: '2022-01', endDate: '2027-12', behind: true, category: 'OPRC',
  },
  {
    id: 'P008', name: 'Northern Bypass Phase III',
    road: 'Northern Bypass', region: 'Central', funder: 'AfDB',
    contractor: 'Under design', lengthKm: 14, budgetBn: 220, spentBn: 12,
    phase: 'Design', physical: 0, financial: 5, planned: 5,
    startDate: '2025-01', endDate: '2028-06', behind: false, category: 'Vision2040',
  },
  {
    id: 'P009', name: 'Kampala–Entebbe Expressway — Phase 2 Widening',
    road: 'Expressway', region: 'Central', funder: 'China EXIM',
    contractor: 'TBA', lengthKm: 28, budgetBn: 580, spentBn: 0,
    phase: 'Planning', physical: 0, financial: 0, planned: 0,
    startDate: '2026-01', endDate: '2030-06', behind: false, category: 'Vision2040',
  },
  {
    id: 'P010', name: 'Storm Damage Repairs — Eastern FY24/25',
    road: 'Various', region: 'Eastern', funder: 'GoU Emergency',
    contractor: 'Multiple day-labour', lengthKm: 22, budgetBn: 28, spentBn: 19,
    phase: 'Construction', physical: 70, financial: 68, planned: 65,
    startDate: '2024-10', endDate: '2025-06', behind: false, category: 'Emergency',
  },
];

const CAT_COLOR = { OPRC: C.cyan, NDPIV: C.purple, Vision2040: C.teal, Emergency: C.red };

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(8,14,28,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      padding: '8px 12px', borderRadius: 7, fontSize: 10 }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.fill, fontWeight: 700 }}>{p.name}: {p.value}%</div>
      ))}
    </div>
  );
};

export default function ProjectTracker() {
  const [catFilter, setCatFilter] = useState<string>('All');
  const [phaseFilter, setPhaseFilter] = useState<string>('All');

  const filtered = PROJECTS.filter(p => {
    if (catFilter !== 'All' && p.category !== catFilter) return false;
    if (phaseFilter !== 'All' && p.phase !== phaseFilter) return false;
    return true;
  });

  const behindCount = PROJECTS.filter(p => p.behind).length;
  const activeCount = PROJECTS.filter(p => p.phase === 'Construction').length;
  const completeCount = PROJECTS.filter(p => p.phase === 'Complete').length;
  const totalBudget = PROJECTS.reduce((s, p) => s + p.budgetBn, 0);
  const totalSpent  = PROJECTS.reduce((s, p) => s + p.spentBn,  0);

  return (
    <div style={{ padding: '20px 18px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10,
            background: `linear-gradient(135deg, rgba(${hexRgb(C.orange)},0.25), rgba(${hexRgb(C.yellow)},0.1))`,
            border: `1px solid rgba(${hexRgb(C.orange)},0.4)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Construction size={16} style={{ color: C.orange }}/>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4' }}>Project Tracker</div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.65)', marginTop: 1 }}>
              Construction progress · budget vs actual · OPRC · NDP IV · Vision 2040
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[
            { label: 'Active Projects',    value: String(activeCount),     icon: <Construction size={13}/>, color: C.orange },
            { label: 'Behind Schedule',    value: String(behindCount),     icon: <AlertTriangle size={13}/>, color: C.red    },
            { label: 'Completed',          value: String(completeCount),   icon: <CheckCircle2 size={13}/>, color: C.green  },
            { label: 'Total Programme',    value: `UGX ${(totalBudget/1000).toFixed(1)}T`, icon: <DollarSign size={13}/>, color: C.yellow },
            { label: 'Disbursed',          value: `UGX ${(totalSpent/1000).toFixed(1)}T`, icon: <TrendingUp size={13}/>, color: C.cyan   },
          ].map(k => (
            <div key={k.label} style={{ background: `rgba(${hexRgb(k.color)},0.06)`,
              border: `1px solid rgba(${hexRgb(k.color)},0.2)`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ color: k.color, marginBottom: 3 }}>{k.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)', marginTop: 4, textTransform: 'uppercase' }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['All', 'OPRC', 'NDPIV', 'Vision2040', 'Emergency'].map(c => (
          <button key={c} onClick={() => setCatFilter(c)} style={{
            fontSize: 10, padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontWeight: 700, transition: 'all 0.15s',
            background: catFilter === c
              ? `rgba(${hexRgb(c === 'All' ? C.cyan : CAT_COLOR[c as keyof typeof CAT_COLOR])},0.15)`
              : 'rgba(255,255,255,0.04)',
            color: catFilter === c
              ? (c === 'All' ? C.cyan : CAT_COLOR[c as keyof typeof CAT_COLOR])
              : 'rgba(148,163,184,0.6)',
          }}>{c}</button>
        ))}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }}/>
        {['All', ...PHASE_ORDER].map(ph => (
          <button key={ph} onClick={() => setPhaseFilter(ph)} style={{
            fontSize: 10, padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontWeight: 700, transition: 'all 0.15s',
            background: phaseFilter === ph
              ? `rgba(${hexRgb(ph === 'All' ? C.gray : PHASE_COLOR[ph as Phase])},0.15)`
              : 'rgba(255,255,255,0.04)',
            color: phaseFilter === ph
              ? (ph === 'All' ? '#94a3b8' : PHASE_COLOR[ph as Phase])
              : 'rgba(148,163,184,0.5)',
          }}>{ph}</button>
        ))}
      </div>

      {/* Progress chart */}
      <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
          Physical vs Financial Progress (%)
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={filtered.map(p => ({
            name: p.name.length > 28 ? p.name.slice(0, 28) + '…' : p.name,
            physical: p.physical, financial: p.financial, planned: p.planned,
          }))} margin={{ top: 4, right: 12, left: 0, bottom: 40 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
            <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'rgba(148,163,184,0.5)' }} angle={-30} textAnchor="end"/>
            <YAxis tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.5)' }} domain={[0, 100]}/>
            <Tooltip content={<CT/>}/>
            <Bar dataKey="planned"  name="Planned %"  fill="rgba(255,255,255,0.1)" radius={[3,3,0,0]}/>
            <Bar dataKey="physical" name="Physical %"  fill={C.cyan}    radius={[3,3,0,0]}/>
            <Bar dataKey="financial" name="Financial %" fill={C.yellow} radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Project cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(p => {
          const phaseIdx = PHASE_ORDER.indexOf(p.phase);
          const phColor  = PHASE_COLOR[p.phase];
          const catColor = CAT_COLOR[p.category];
          return (
            <div key={p.id} style={{ background: 'rgba(15,23,42,0.7)',
              border: `1px solid rgba(${hexRgb(p.behind ? C.red : phColor)},0.2)`,
              borderRadius: 12, padding: '14px 16px',
              boxShadow: p.behind ? `0 0 20px rgba(${hexRgb(C.red)},0.08)` : 'none' }}>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    {p.behind && <AlertTriangle size={11} style={{ color: C.red }}/>}
                    <span style={{ fontSize: 13, fontWeight: 800, color: p.behind ? C.red : '#d4dde8' }}>{p.name}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>
                    {p.road} · {p.region} · {p.funder} · {p.lengthKm} km
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(100,116,139,0.5)', marginTop: 1 }}>
                    Contractor: {p.contractor}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 800,
                    background: `rgba(${hexRgb(catColor)},0.12)`, color: catColor }}>{p.category}</span>
                  <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 800,
                    background: `rgba(${hexRgb(phColor)},0.12)`, color: phColor }}>{p.phase}</span>
                  {p.behind && <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 800,
                    background: `rgba(${hexRgb(C.red)},0.12)`, color: C.red }}>BEHIND SCHEDULE</span>}
                </div>
              </div>

              {/* Phase pipeline */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 12, flexWrap: 'wrap' }}>
                {PHASE_ORDER.map((ph, i) => {
                  const done = i < phaseIdx;
                  const active = i === phaseIdx;
                  const pc = PHASE_COLOR[ph];
                  return (
                    <div key={ph} style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ padding: '3px 10px', borderRadius: 4, fontSize: 9, fontWeight: 800,
                        background: done ? `rgba(${hexRgb(pc)},0.15)` : active ? `rgba(${hexRgb(pc)},0.25)` : 'rgba(255,255,255,0.04)',
                        color: done || active ? pc : 'rgba(100,116,139,0.4)',
                        border: active ? `1px solid rgba(${hexRgb(pc)},0.5)` : '1px solid transparent',
                        boxShadow: active ? `0 0 10px rgba(${hexRgb(pc)},0.3)` : 'none',
                      }}>{done ? '✓ ' : ''}{ph}</div>
                      {i < PHASE_ORDER.length - 1 && (
                        <div style={{ width: 16, height: 1, background: done ? `rgba(${hexRgb(pc)},0.4)` : 'rgba(255,255,255,0.06)' }}/>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress bars */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Physical Progress', value: p.physical, color: C.cyan },
                  { label: 'Financial Progress', value: p.financial, color: C.yellow },
                  { label: 'Planned Progress',   value: p.planned,  color: 'rgba(255,255,255,0.25)' },
                ].map(bar => (
                  <div key={bar.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', fontWeight: 700 }}>{bar.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: bar.color }}>{bar.value}%</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${bar.value}%`, height: '100%', background: bar.color, borderRadius: 2 }}/>
                    </div>
                  </div>
                ))}
              </div>

              {/* Budget */}
              <div style={{ marginTop: 10, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>
                  Budget: <span style={{ color: C.yellow, fontWeight: 700 }}>UGX {p.budgetBn.toLocaleString()}M</span>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>
                  Spent: <span style={{ color: C.green, fontWeight: 700 }}>UGX {p.spentBn.toLocaleString()}M</span>
                  <span style={{ color: 'rgba(100,116,139,0.5)', marginLeft: 4 }}>({Math.round(p.spentBn/p.budgetBn*100)}%)</span>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>
                  Period: <span style={{ color: '#d4dde8' }}>{p.startDate} → {p.endDate}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
