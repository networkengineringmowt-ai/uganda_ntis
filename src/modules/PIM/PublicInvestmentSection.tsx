import { useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { DollarSign, Globe, Building2, TrendingUp, FileText } from 'lucide-react';

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
  boxShadow: `0 0 20px rgba(${hexRgb(a)},0.05)`,
});
const TK = { fontSize: 9, fill: 'rgba(148,163,184,0.6)' };

// ── Data ─────────────────────────────────────────────────────────────────────
const BUDGET_BY_YEAR = [
  { fy: '2015/16', roads: 1420, bridges: 180, total: 1600, donor: 680, gou: 920 },
  { fy: '2016/17', roads: 1580, bridges: 210, total: 1790, donor: 820, gou: 970 },
  { fy: '2017/18', roads: 1750, bridges: 240, total: 1990, donor: 980, gou: 1010 },
  { fy: '2018/19', roads: 1890, bridges: 260, total: 2150, donor: 1050, gou: 1100 },
  { fy: '2019/20', roads: 2020, bridges: 290, total: 2310, donor: 1200, gou: 1110 },
  { fy: '2020/21', roads: 1680, bridges: 220, total: 1900, donor: 850, gou: 1050 },
  { fy: '2021/22', roads: 2100, bridges: 310, total: 2410, donor: 1250, gou: 1160 },
  { fy: '2022/23', roads: 2380, bridges: 340, total: 2720, donor: 1380, gou: 1340 },
  { fy: '2023/24', roads: 2560, bridges: 380, total: 2940, donor: 1490, gou: 1450 },
  { fy: '2024/25', roads: 2780, bridges: 420, total: 3200, donor: 1600, gou: 1600 },
];

const DONOR_BREAKDOWN = [
  { name: 'World Bank / IDA',     value: 28, color: C.blue   },
  { name: 'AfDB',                 value: 22, color: C.green  },
  { name: 'JICA (Japan)',         value: 15, color: C.cyan   },
  { name: 'China EXIM Bank',      value: 18, color: C.red    },
  { name: 'GoU (Own Revenue)',    value: 12, color: C.yellow },
  { name: 'OPEC Fund',            value:  3, color: C.orange },
  { name: 'KfW / EU',             value:  2, color: C.purple },
];

const PPP_PROJECTS = [
  {
    name: 'Kampala–Jinja Expressway',
    status: 'Financial Close Stage',
    length_km: 95,
    value_usd_m: 1200,
    model: 'DBFOT (30-year concession)',
    funder: 'PPP — GoU + Private consortium',
    notes: 'First major PPP expressway; toll-based; linking Kampala to Jinja SEZ',
    color: C.cyan,
  },
  {
    name: 'Kampala–Entebbe Expressway',
    status: 'Operational (since 2018)',
    length_km: 51,
    value_usd_m: 476,
    model: 'EPC + Govt O&M (China EXIM)',
    funder: 'China EXIM + GoU',
    notes: 'Toll road; 22km dual carriageway + 29km approach; UNRA operated',
    color: C.green,
  },
  {
    name: 'Kampala Northern Bypass',
    status: 'Operational (2009/2018 phases)',
    length_km: 21,
    value_usd_m: 145,
    model: 'EPC (AfDB grant)',
    funder: 'AfDB + GoU',
    notes: 'Phase II (Bweyogerere–Kigowa) completed 2018; critical urban bypass',
    color: C.blue,
  },
  {
    name: 'Tirinyi–Mbale–Soroti',
    status: 'Under Procurement',
    length_km: 272,
    value_usd_m: 780,
    model: 'EPC (World Bank)',
    funder: 'IDA Credit + GoU',
    notes: 'Eastern Corridor upgrade; OPRC maintenance component',
    color: C.yellow,
  },
  {
    name: 'Gulu–Atiak Highway',
    status: 'Under Construction',
    length_km: 74,
    value_usd_m: 210,
    model: 'EPC (AfDB)',
    funder: 'AfDB + GoU',
    notes: 'Northern Uganda connectivity; bituminous standard',
    color: C.orange,
  },
  {
    name: 'Kyotera–Mutukula',
    status: 'Completed 2022',
    length_km: 76,
    value_usd_m: 95,
    model: 'EPC (JICA)',
    funder: 'JICA ODA loan + GoU',
    notes: 'Tanzania border connectivity; bituminous; part of Northern Corridor',
    color: C.teal,
  },
];

const PIM_FRAMEWORK = [
  { stage: 'Strategic Planning',   body: 'MoWT / NPA',       tools: 'NDP IV, Vision 2040, Transport Master Plan', color: C.purple },
  { stage: 'Project Identification', body: 'UNRA / MoWT',    tools: 'Pre-feasibility, network gap analysis',       color: C.blue   },
  { stage: 'Project Appraisal',    body: 'UNRA + MFPED',     tools: 'HDM-4 NPV/BCR, economic CBA, ESIA',           color: C.cyan   },
  { stage: 'Approval & Budget',    body: 'MFPED / Parliament', tools: 'MTEF, BFP, Appropriation Act',              color: C.yellow },
  { stage: 'Procurement',          body: 'UNRA PDU',         tools: 'PPDA Act, FIDIC contracts',                   color: C.orange },
  { stage: 'Implementation',       body: 'UNRA + Contractor', tools: 'Contract management, site supervision',      color: C.green  },
  { stage: 'Monitoring & Eval.',   body: 'UNRA / OAG / NPA', tools: 'Physical & financial progress, VFM audits',  color: C.teal   },
];

const TABS = [
  { id: 'pim',    label: 'PIM Framework', icon: <FileText size={13}/> },
  { id: 'budget', label: 'Budget Trends', icon: <DollarSign size={13}/> },
  { id: 'ppp',    label: 'PPP Projects',  icon: <Building2 size={13}/> },
  { id: 'donor',  label: 'Donor Funding', icon: <Globe size={13}/> },
  { id: 'ndpiv',  label: 'NDP IV Targets', icon: <TrendingUp size={13}/> },
] as const;
type TabId = typeof TABS[number]['id'];

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(8,14,28,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      padding: '8px 12px', borderRadius: 7, fontSize: 10 }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, fontWeight: 700 }}>{p.name}: {p.value?.toLocaleString()}</div>
      ))}
    </div>
  );
};

export default function PublicInvestmentSection() {
  const [tab, setTab] = useState<TabId>('pim');

  return (
    <div style={{ padding: '20px 18px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10,
            background: `linear-gradient(135deg, rgba(${hexRgb(C.yellow)},0.25), rgba(${hexRgb(C.orange)},0.1))`,
            border: `1px solid rgba(${hexRgb(C.yellow)},0.4)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={16} style={{ color: C.yellow }}/>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4' }}>Public Investment Management</div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.65)', marginTop: 1 }}>
              Uganda national roads financing · PPPs · donor frameworks · NDP IV investment plan
            </div>
          </div>
        </div>
        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
          {[
            { label: 'FY24/25 Budget', value: 'UGX 3.2T', sub: 'Roads & Bridges', color: C.yellow },
            { label: 'Donor Share', value: '50%', sub: 'of capital budget', color: C.blue },
            { label: 'Active PPPs', value: '2', sub: '+ 3 in pipeline', color: C.green },
            { label: 'NDP IV Target', value: '12,000km', sub: 'paved by 2025/26', color: C.cyan },
          ].map(k => (
            <div key={k.label} style={{ background: `rgba(${hexRgb(k.color)},0.06)`,
              border: `1px solid rgba(${hexRgb(k.color)},0.2)`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)', marginTop: 4, textTransform: 'uppercase' }}>{k.label}</div>
              <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.5)' }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map(t => {
          const isA = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: '8px 8px 0 0',
              border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: isA ? `rgba(${hexRgb(C.yellow)},0.1)` : 'transparent',
              color: isA ? C.yellow : 'rgba(148,163,184,0.65)',
              borderBottom: isA ? `2px solid ${C.yellow}` : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
            }}>{t.icon} {t.label}</button>
          );
        })}
      </div>

      {/* PIM Framework */}
      {tab === 'pim' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={card(C.yellow)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.yellow, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Uganda Public Investment Management Cycle — Roads Sector
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PIM_FRAMEWORK.map((s, i) => (
                <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 14,
                  background: `rgba(${hexRgb(s.color)},0.05)`,
                  border: `1px solid rgba(${hexRgb(s.color)},0.18)`, borderRadius: 9, padding: '10px 14px' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: `rgba(${hexRgb(s.color)},0.15)`,
                    border: `1px solid rgba(${hexRgb(s.color)},0.3)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 900, color: s.color }}>{i+1}</div>
                  <div style={{ minWidth: 160, fontWeight: 800, fontSize: 11, color: s.color }}>{s.stage}</div>
                  <div style={{ minWidth: 140, fontSize: 10, color: 'rgba(148,163,184,0.65)' }}>{s.body}</div>
                  <div style={{ fontSize: 10, color: 'rgba(196,210,225,0.75)', flex: 1 }}>{s.tools}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={card(C.blue)}>
              <div style={{ fontSize: 10, fontWeight: 900, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Key Legal Framework</div>
              {[
                'Public Finance Management Act, 2015 (as amended)',
                'PPDA Act, 2003 (amended 2014) — Procurement',
                'National Roads Act, 2017 — UNRA mandate',
                'Roads Act, Cap 358 — road classification',
                'PPP Act, 2015 — private finance framework',
                'National Environment Act, 2019 — ESIA requirements',
                'National Development Plan IV (2020/21–2025/26)',
                'Uganda Vision 2040 — long-term strategic goals',
              ].map(l => (
                <div key={l} style={{ fontSize: 10, color: 'rgba(196,210,225,0.75)', padding: '4px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)' }}>• {l}</div>
              ))}
            </div>
            <div style={card(C.green)}>
              <div style={{ fontSize: 10, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Key Institutions</div>
              {[
                { name: 'UNRA', role: 'Implementing agency — national roads' },
                { name: 'MoWT', role: 'Policy, standards, district roads oversight' },
                { name: 'MFPED', role: 'Budget allocation, MTEF, donor coordination' },
                { name: 'NPA', role: 'National development plan formulation' },
                { name: 'PPDA', role: 'Procurement oversight and regulation' },
                { name: 'OAG', role: 'Value-for-money and performance audits' },
                { name: 'Parliament', role: 'Appropriation, oversight (Infrastructure Ctte)' },
              ].map(r => (
                <div key={r.name} style={{ display: 'flex', gap: 10, padding: '5px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.green, minWidth: 52 }}>{r.name}</span>
                  <span style={{ fontSize: 10, color: 'rgba(196,210,225,0.75)' }}>{r.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Budget Trends */}
      {tab === 'budget' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card(C.cyan)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              UNRA Budget Allocation 2015/16–2024/25 (UGX Billions)
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={BUDGET_BY_YEAR} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                <XAxis dataKey="fy" tick={{ ...TK, fontSize: 8 }} angle={-30} textAnchor="end"/>
                <YAxis tick={TK} label={{ value: 'UGX Bn', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: 'rgba(148,163,184,0.5)' } }}/>
                <Tooltip content={<CT/>}/>
                <Legend wrapperStyle={{ fontSize: 10 }}/>
                <Bar dataKey="donor" name="Donor/External" stackId="a" fill={C.blue} radius={[0,0,0,0]}/>
                <Bar dataKey="gou" name="GoU Own Revenue" stackId="a" fill={C.yellow} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={card(C.purple)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Roads vs Bridges Budget Split (UGX Bn)
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={BUDGET_BY_YEAR} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                <XAxis dataKey="fy" tick={{ ...TK, fontSize: 8 }} angle={-30} textAnchor="end"/>
                <YAxis tick={TK}/>
                <Tooltip content={<CT/>}/>
                <Legend wrapperStyle={{ fontSize: 10 }}/>
                <Line type="monotone" dataKey="roads" name="Roads" stroke={C.cyan} strokeWidth={2} dot={{ r: 3 }}/>
                <Line type="monotone" dataKey="bridges" name="Bridges" stroke={C.orange} strokeWidth={2} dot={{ r: 3 }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* PPP Projects */}
      {tab === 'ppp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PPP_PROJECTS.map(p => (
            <div key={p.name} style={{ background: `rgba(${hexRgb(p.color)},0.05)`,
              border: `1px solid rgba(${hexRgb(p.color)},0.2)`, borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: p.color, marginBottom: 3 }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.65)' }}>{p.funder}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 5, fontWeight: 800,
                    background: `rgba(${hexRgb(p.color)},0.12)`, color: p.color }}>{p.status}</span>
                  <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 5, fontWeight: 800,
                    background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>{p.length_km} km</span>
                  <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 5, fontWeight: 800,
                    background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>USD {p.value_usd_m}M</span>
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>Model: <span style={{ color: '#d4dde8', fontWeight: 600 }}>{p.model}</span></div>
                <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>{p.notes}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Donor Funding */}
      {tab === 'donor' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={card(C.blue)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Capital Budget Share by Funding Source (FY2024/25)
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={DONOR_BREAKDOWN} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}%`} labelLine={false}>
                  {DONOR_BREAKDOWN.map((d, i) => <Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip content={<CT/>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={card(C.green)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Donor Profiles — National Roads
            </div>
            {[
              { donor: 'World Bank / IDA', share: '28%', focus: 'Rehabilitation, connectivity, OPRC maintenance', active: '4 operations' },
              { donor: 'African Dev. Bank', share: '22%', focus: 'Northern Uganda, border roads, bridges', active: '3 operations' },
              { donor: 'JICA (Japan)',      share: '15%', focus: 'Northern corridor, Tanzania links', active: '2 operations' },
              { donor: 'China EXIM Bank',   share: '18%', focus: 'Expressways, urban roads, financing package', active: '2 operations' },
              { donor: 'OPEC Fund',         share: '3%',  focus: 'Rural roads complementary finance', active: '1 operation' },
              { donor: 'KfW / EU',          share: '2%',  focus: 'Climate adaptation, rural access', active: '1 operation' },
            ].map(d => (
              <div key={d.donor} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#d4dde8' }}>{d.donor}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.yellow }}>{d.share}</span>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>{d.focus} · {d.active}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NDP IV Targets */}
      {tab === 'ndpiv' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={card(C.green)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              NDP IV National Roads Targets (2020/21–2025/26)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 18 }}>
              {[
                { target: '12,000 km', desc: 'Paved national roads by 2025/26', base: '5,400 km (2020/21)', color: C.cyan },
                { target: '95%',       desc: 'National roads in good/fair condition', base: '72% (2020/21)', color: C.green },
                { target: '2,500 km',  desc: 'New roads to be paved', base: 'Upgrading from gravel', color: C.yellow },
                { target: '240 km/yr', desc: 'Annual paving programme', base: 'Average delivery target', color: C.orange },
                { target: '50%',       desc: 'Roads in good condition (IRI <4)', base: '38% (2020/21)', color: C.blue },
                { target: '100%',      desc: 'Structures inspected annually', base: 'BMS target', color: C.purple },
              ].map(t => (
                <div key={t.target} style={{ background: `rgba(${hexRgb(t.color)},0.06)`,
                  border: `1px solid rgba(${hexRgb(t.color)},0.2)`, borderRadius: 9, padding: '12px 14px' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: t.color, lineHeight: 1 }}>{t.target}</div>
                  <div style={{ fontSize: 10, color: '#d4dde8', fontWeight: 600, marginTop: 4 }}>{t.desc}</div>
                  <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.6)', marginTop: 2 }}>Baseline: {t.base}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
              Source: Uganda NDP IV (2020/21–2025/26) Chapter 5 — Infrastructure. UNRA Performance Contract 2024/25.
              Vision 2040 long-term target: 17,000 km paved national road network.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
