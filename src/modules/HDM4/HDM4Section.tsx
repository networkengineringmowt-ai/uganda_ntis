import { useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine,
} from 'recharts';
import { Chart3DWrap, Bar3D, TT_NEON, TICK } from '../../lib/chart3d';
import { Calculator, BookOpen, Table2, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { ModuleNavBar } from '../../shared/ModuleNavBar';

const C = {
  purple: '#b967ff', cyan: '#00f5ff', green: '#00ff88',
  blue: '#4d9fff', yellow: '#ffd23f', orange: '#ff6b35',
  pink: '#ff2d78', teal: '#00d4aa', red: '#ff3366',
};

const card = (accent: string) => ({
  background: 'rgba(15,23,42,0.7)',
  border: `1px solid rgba(${hexRgb(accent)},0.2)`,
  borderRadius: 12,
  padding: '18px 20px',
  boxShadow: `0 0 20px rgba(${hexRgb(accent)},0.06)`,
});

const TABS = [
  { id: 'overview',    label: 'Overview',           icon: <BookOpen size={13}/> },
  { id: 'models',      label: 'Deterioration Models', icon: <Activity size={13}/> },
  { id: 'calibration', label: 'Uganda Calibration', icon: <Table2 size={13}/> },
  { id: 'cesal',       label: 'CESAL Calculator',   icon: <Calculator size={13}/> },
  { id: 'costs',       label: 'Works Cost Matrix',  icon: <DollarSign size={13}/> },
  { id: 'npv',         label: 'NPV / BCR Analysis', icon: <TrendingUp size={13}/> },
] as const;

type TabId = typeof TABS[number]['id'];

// ── Uganda HDM-4 calibration data ────────────────────────────────────────────
const CALIB_DATA = [
  { param: 'Kcit',  value: 0.90, desc: 'Cracking initiation time factor',      ref: 'Department of National Roads/DNR HDM-4 Study 2023', road: 'Paved, all classes' },
  { param: 'Kcia',  value: 1.05, desc: 'Cracking initiation area factor',       ref: 'Department of National Roads/DNR HDM-4 Study 2023', road: 'Class A & B' },
  { param: 'Kcp',   value: 1.10, desc: 'Cracking progression factor',           ref: 'Department of National Roads/DNR HDM-4 Study 2023', road: 'Class A & B' },
  { param: 'Krt',   value: 0.95, desc: 'Rutting progression factor',            ref: 'AFCAP Uganda 2018',          road: 'High-traffic corridors' },
  { param: 'Kgm',   value: 0.85, desc: 'Gravel loss — maintenance (unpaved)',   ref: 'Department of National Roads Gravel Study 2019',    road: 'Class C & D (unpaved)' },
  { param: 'Kge',   value: 1.20, desc: 'Gravel loss — environmental (unpaved)', ref: 'Department of National Roads Gravel Study 2019',    road: 'Class C & D (unpaved)' },
  { param: 'Kstm',  value: 1.00, desc: 'Structural rutting in top mix',        ref: 'Default (unverified)',       road: 'Bituminous' },
  { param: 'Kvi',   value: 1.15, desc: 'Vehicle damage factor — HGV',          ref: 'SATCC/TRH4 2020',           road: 'All classes' },
];

// ── IRI threshold table ───────────────────────────────────────────────────────
const IRI_THRESHOLDS = [
  { band: 'Very Good',  iri_min: 0,    iri_max: 2.0,  vci: '85–100', action: 'Routine maintenance only',            color: C.green },
  { band: 'Good',       iri_min: 2.0,  iri_max: 4.0,  vci: '70–84',  action: 'Preventive maintenance (seal coat)',  color: C.teal  },
  { band: 'Fair',       iri_min: 4.0,  iri_max: 6.0,  vci: '50–69',  action: 'Reseal / thin overlay',              color: C.yellow },
  { band: 'Poor',       iri_min: 6.0,  iri_max: 8.0,  vci: '30–49',  action: 'Structural overlay / rehabilitation',color: C.orange },
  { band: 'Very Poor',  iri_min: 8.0,  iri_max: 12.0, vci: '10–29',  action: 'Major rehabilitation',               color: C.red   },
  { band: 'Failed',     iri_min: 12.0, iri_max: null,  vci: '0–9',   action: 'Reconstruction',                     color: C.pink  },
];

// ── Works cost matrix (Uganda FY 2024/25 MoWT unit costs) ────────────────────
const COST_MATRIX = [
  { type: 'Routine Maintenance', works: 'Pothole patching',          unit: 'UGX/m²', bituminous: '180,000', unpaved: '—',       note: 'Day labour, MoWT standard rates' },
  { type: 'Routine Maintenance', works: 'Vegetation clearance',     unit: 'UGX/km', bituminous: '4,200,000', unpaved: '3,800,000', note: 'Per km, both shoulders' },
  { type: 'Routine Maintenance', works: 'Drainage clearing',        unit: 'UGX/km', bituminous: '6,500,000', unpaved: '5,200,000', note: 'Side drains + culverts' },
  { type: 'Periodic Maintenance', works: 'Surface dressing (1-coat)', unit: 'UGX/m²', bituminous: '28,000', unpaved: '—',        note: 'Material + equipment + labour' },
  { type: 'Periodic Maintenance', works: 'Thin overlay (30mm AC)',   unit: 'UGX/m²', bituminous: '85,000', unpaved: '—',         note: 'Asphalt concrete 30mm' },
  { type: 'Periodic Maintenance', works: 'Gravel resheet (150mm)',   unit: 'UGX/m²', bituminous: '—',       unpaved: '38,000',   note: 'Gravel source within 15km' },
  { type: 'Rehabilitation',       works: 'Structural overlay (60mm)', unit: 'UGX/m²', bituminous: '145,000', unpaved: '—',       note: 'AC 60mm + tack coat' },
  { type: 'Rehabilitation',       works: 'Full reconstruction',      unit: 'UGX/m²', bituminous: '520,000', unpaved: '280,000',  note: 'Full pavement, 200mm base' },
  { type: 'Emergency',            works: 'Washout repair',           unit: 'UGX/site', bituminous: '48M', unpaved: '32M',         note: 'Average culvert/embankment washout' },
  { type: 'Emergency',            works: 'Landslip reinstatement',   unit: 'UGX/site', bituminous: '180M', unpaved: '95M',        note: 'Major slope failure, includes drainage' },
];

// ── Deterioration model projections ──────────────────────────────────────────
function genDeteriorationData(iri0: number, sn: number, esal: number, rainfall: number) {
  const data = [];
  let iri = iri0;
  for (let y = 0; y <= 10; y++) {
    const k_env  = 1 + (rainfall - 1200) / 10000;
    const k_load = 1 + esal / 20;
    const k_str  = Math.max(0.3, 1 - sn / 8);
    const delta  = 0.08 * k_env * k_load * k_str * (1 + y * 0.03);
    if (y > 0) iri = Math.min(16, iri + delta);
    data.push({
      year: 2024 + y,
      iri: +iri.toFixed(2),
      do_min: +(iri + delta * 0.5 * y / 5).toFixed(2),
      maintain: Math.min(5.0, +(iri + delta * 0.2).toFixed(2)),
      threshold_rehab: 6.0,
      threshold_poor: 4.0,
    });
  }
  return data;
}

// ── CESAL Calculator ──────────────────────────────────────────────────────────
const ESAL_FACTORS: Record<string, { name: string; factor: number }> = {
  car:     { name: 'Cars / Taxis',         factor: 0.0001 },
  lgv:     { name: 'Light Goods (LGV)',     factor: 0.004  },
  bus_s:   { name: 'Small Bus',             factor: 0.05   },
  bus_l:   { name: 'Large Bus',             factor: 0.40   },
  lt:      { name: 'Light Truck (<5t GVW)', factor: 0.08   },
  mt:      { name: 'Medium Truck (5–10t)',  factor: 0.80   },
  ht:      { name: 'Heavy Truck (>10t)',    factor: 2.40   },
  tt_5ax:  { name: 'Truck Trailer 5-axle',  factor: 4.20   },
  tt_6ax:  { name: 'Truck Trailer 6-axle',  factor: 5.86   },
  tt_7ax:  { name: 'Truck Trailer 7-axle',  factor: 7.50   },
};

const TICK_STYLE = { fontSize: 9, fill: 'rgba(148,163,184,0.6)' };

// ─────────────────────────────────────────────────────────────────────────────
export default function HDM4Section() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Deterioration controls
  const [iri0, setIri0]         = useState(2.5);
  const [sn, setSn]             = useState(3.5);
  const [esalM, setEsalM]       = useState(1.5);
  const [rainfall, setRainfall] = useState(1400);

  // CESAL state
  const [counts, setCounts] = useState<Record<string, number>>({
    car: 1200, lgv: 300, bus_s: 80, bus_l: 40,
    lt: 120, mt: 90, ht: 60, tt_5ax: 25, tt_6ax: 15, tt_7ax: 5,
  });
  const [designLife, setDesignLife] = useState(15);
  const [overloadFactor, setOverloadFactor] = useState(1.25);

  const detData = genDeteriorationData(iri0, sn, esalM, rainfall);

  const totalESAL = useCallback(() => {
    return Object.entries(counts).reduce((sum, [cls, vol]) => {
      const f = ESAL_FACTORS[cls]?.factor ?? 0;
      return sum + vol * f * 365 * designLife * overloadFactor / 1_000_000;
    }, 0);
  }, [counts, designLife, overloadFactor]);

  const cesalTotal = totalESAL();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'rgba(8,14,28,0.95)', border: '1px solid rgba(255,255,255,0.1)',
        padding: '8px 12px', borderRadius: 7, fontSize: 10 }}>
        <div style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color, fontWeight: 700 }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ padding: '20px 18px', minHeight: '100%',
      background: 'linear-gradient(180deg, rgba(8,14,28,0.4) 0%, transparent 100%)' }}>

      <ModuleNavBar module="HDM4" />

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, rgba(${hexRgb(C.purple)},0.25), rgba(${hexRgb(C.blue)},0.1))`,
            border: `1px solid rgba(${hexRgb(C.purple)},0.45)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={16} style={{ color: C.purple }}/>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4', letterSpacing: '-0.01em' }}>
              HDM-4 — Highway Development & Management
            </div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.65)', marginTop: 1 }}>
              Deterioration models · Uganda calibration · CESAL calculator · Economic analysis
            </div>
          </div>
        </div>
      </div>

      {/* ── BMS-style tab bar ── */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 20, flexShrink: 0,
        borderBottom: '1px solid rgba(77,159,255,0.15)',
        background: 'rgba(4,9,18,0.85)', marginLeft: -20, marginRight: -20, paddingLeft: 14,
      }}>
        {TABS.map(t => {
          const isActive = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px', fontSize: 11, fontWeight: isActive ? 800 : 500,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: isActive ? '#4d9fff' : 'rgba(148,163,184,0.70)',
              borderBottom: isActive ? '2px solid #4d9fff' : '2px solid transparent',
              transition: 'all 0.13s',
            }}>
              {t.icon} {t.label}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <div style={card(C.purple)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              What is HDM-4?
            </div>
            <p style={{ fontSize: 11, color: 'rgba(196,210,225,0.85)', lineHeight: 1.7, margin: 0 }}>
              HDM-4 (Highway Development and Management) is the World Bank-endorsed software framework for analysing roads investment and management strategies. It models pavement deterioration, maintenance effects, and road user costs to support evidence-based budget planning.
            </p>
            <p style={{ fontSize: 11, color: 'rgba(196,210,225,0.85)', lineHeight: 1.7, margin: '8px 0 0' }}>
              Department of National Roads uses HDM-4 for 5-year maintenance programming, NDP IV investment appraisal, and donor reporting (World Bank, AfDB, JICA).
            </p>
          </div>

          <div style={card(C.cyan)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              Uganda Application Context
            </div>
            {[
              { label: 'Network covered', value: '6,842 km paved national roads' },
              { label: 'Calibration study', value: 'Department of National Roads/DNR Dec 2023 (ROMDAS + HDM-4)' },
              { label: 'Traffic model', value: 'ATC + TIS AADT, SATCC ESAL factors' },
              { label: 'Unit costs', value: 'MoWT Schedule of Rates FY 2024/25' },
              { label: 'Key output', value: '5-year M&R programme (rolling)' },
              { label: 'Scenarios run', value: '3 — Do Min / Maintain / Improve' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.65)', flex: 1 }}>{r.label}</span>
                <span style={{ fontSize: 10, color: '#d4dde8', fontWeight: 700, maxWidth: 200, textAlign: 'right' }}>{r.value}</span>
              </div>
            ))}
          </div>

          <div style={{ ...card(C.orange), gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              HDM-4 Model Structure
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {[
                { name: 'RD Model', desc: 'Road Deterioration — cracking, rutting, roughness progression under traffic & environment', color: C.red },
                { name: 'WE Model', desc: 'Works Effects — how maintenance and improvement treatments restore pavement condition', color: C.yellow },
                { name: 'RUE Model', desc: 'Road User Effects — vehicle operating costs, travel time, accidents as function of IRI', color: C.green },
                { name: 'SEE Model', desc: 'Social & Environmental Effects — CO₂ emissions, accident rates, socio-economic impacts', color: C.teal },
                { name: 'RDWE',     desc: 'Road Development Works Effects — long-term investment strategy and economic optimisation', color: C.purple },
              ].map(m => (
                <div key={m.name} style={{ background: `rgba(${hexRgb(m.color)},0.06)`,
                  border: `1px solid rgba(${hexRgb(m.color)},0.2)`, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: m.color, marginBottom: 4 }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.75)', lineHeight: 1.5 }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DETERIORATION MODELS TAB ── */}
      {activeTab === 'models' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Model equations */}
          <div style={card(C.purple)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Key Roughness Progression Equation (All-pavement)
            </div>
            {/* Styled equation */}
            <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: '14px 18px', marginBottom: 12,
              border: `1px solid rgba(${hexRgb(C.purple)},0.2)`, overflowX: 'auto' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.cyan, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
                ΔRI = Kgp · (a₀ · exp(m · IRI) · MESAL^a₁ · Kci^a₂ · Krst^a₃ · Kstm^a₄)
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              {[
                { sym: 'ΔRI', def: 'Annual IRI increment (m/km/yr)', color: C.cyan },
                { sym: 'Kgp', def: 'Calibration factor — roughness progression', color: C.purple },
                { sym: 'IRI', def: 'Current roughness (m/km)', color: C.green },
                { sym: 'MESAL', def: 'Cumulative traffic loading (million ESA)', color: C.orange },
                { sym: 'Kci', def: 'Cracking area index (calibrated)', color: C.yellow },
                { sym: 'Krst', def: 'Structural rutting index', color: C.blue },
              ].map(s => (
                <div key={s.sym} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: s.color, fontFamily: 'monospace', minWidth: 48 }}>{s.sym}</span>
                  <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.7)', lineHeight: 1.4 }}>{s.def}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive projection chart */}
          <div style={card(C.orange)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              IRI Projection 2024–2034 · Adjust Parameters
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: `Initial IRI: ${iri0} m/km`, min: 1, max: 10, step: 0.1, val: iri0, set: setIri0, color: C.cyan },
                { label: `Structural No.: ${sn}`,     min: 1, max: 7,  step: 0.1, val: sn,   set: setSn,   color: C.green },
                { label: `MESAL: ${esalM}M`,          min: 0.1, max: 8, step: 0.1, val: esalM, set: setEsalM, color: C.orange },
                { label: `Rainfall: ${rainfall}mm`,   min: 600, max: 2200, step: 50, val: rainfall, set: setRainfall, color: C.yellow },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 9, color: s.color, fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={s.val}
                    onChange={e => s.set(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: s.color }}/>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={detData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                <XAxis dataKey="year" tick={TICK_STYLE}/>
                <YAxis tick={TICK_STYLE} label={{ value: 'IRI (m/km)', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: 'rgba(148,163,184,0.5)' } }}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{ fontSize: 10 }}/>
                <ReferenceLine y={4.0} stroke={C.yellow} strokeDasharray="4 3" label={{ value: 'Fair threshold', style: { fontSize: 8, fill: C.yellow } }}/>
                <ReferenceLine y={6.0} stroke={C.orange} strokeDasharray="4 3" label={{ value: 'Poor threshold', style: { fontSize: 8, fill: C.orange } }}/>
                <Line type="monotone" dataKey="iri" name="No treatment" stroke={C.red} strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="maintain" name="Maintain standards" stroke={C.green} strokeWidth={2} dot={false} strokeDasharray="5 3"/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── CALIBRATION TAB ── */}
      {activeTab === 'calibration' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card(C.cyan)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Uganda HDM-4 Calibration Coefficients
            </div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', marginBottom: 14 }}>
              Source: Department of National Roads/DNR Pavement Performance Study, December 2023. Calibrated using ROMDAS surveys (2018, 2021, 2023) and HDM-4 model fitting.
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {['Parameter', 'Value', 'Description', 'Reference', 'Road Class'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 900,
                        color: 'rgba(0,245,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em',
                        borderBottom: '1px solid rgba(0,245,255,0.15)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CALIB_DATA.map((r, i) => (
                    <tr key={r.param} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 900, color: C.cyan, fontSize: 12 }}>{r.param}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 900, color: C.yellow, textAlign: 'center' }}>{r.value}</td>
                      <td style={{ padding: '9px 12px', color: 'rgba(196,210,225,0.8)' }}>{r.desc}</td>
                      <td style={{ padding: '9px 12px', color: 'rgba(148,163,184,0.55)', fontSize: 10 }}>{r.ref}</td>
                      <td style={{ padding: '9px 12px', color: 'rgba(148,163,184,0.55)', fontSize: 10 }}>{r.road}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* IRI Thresholds */}
          <div style={card(C.green)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              IRI Condition Bands & Intervention Thresholds (Uganda)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {IRI_THRESHOLDS.map(r => (
                <div key={r.band} style={{ display: 'flex', alignItems: 'center', gap: 12,
                  background: `rgba(${hexRgb(r.color)},0.06)`,
                  border: `1px solid rgba(${hexRgb(r.color)},0.2)`,
                  borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }}/>
                  <div style={{ minWidth: 80, fontWeight: 900, fontSize: 11, color: r.color }}>{r.band}</div>
                  <div style={{ minWidth: 100, fontSize: 10, color: 'rgba(148,163,184,0.7)', fontFamily: 'monospace' }}>
                    {r.iri_min}–{r.iri_max ?? '∞'} m/km
                  </div>
                  <div style={{ minWidth: 60, fontSize: 10, color: 'rgba(148,163,184,0.55)' }}>VCI {r.vci}</div>
                  <div style={{ fontSize: 10, color: 'rgba(196,210,225,0.8)', flex: 1 }}>{r.action}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CESAL CALCULATOR TAB ── */}
      {activeTab === 'cesal' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={card(C.yellow)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.yellow, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Traffic Input (Daily Volumes)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {Object.entries(ESAL_FACTORS).map(([cls, info]) => (
                <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ flex: 1, fontSize: 10, color: 'rgba(196,210,225,0.8)' }}>{info.name}</label>
                  <input type="number" min={0} value={counts[cls] ?? 0}
                    onChange={e => setCounts(prev => ({ ...prev, [cls]: +e.target.value }))}
                    style={{ width: 80, background: 'rgba(0,0,0,0.3)',
                      border: `1px solid rgba(${hexRgb(C.yellow)},0.25)`, borderRadius: 5,
                      color: '#e2eaf4', fontSize: 11, padding: '4px 8px', textAlign: 'right' }}/>
                  <span style={{ fontSize: 9, color: 'rgba(100,116,139,0.5)', minWidth: 48 }}>
                    f={info.factor}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 9, color: C.orange, fontWeight: 700 }}>Design Life (years)</label>
                <input type="number" min={1} max={30} value={designLife}
                  onChange={e => setDesignLife(+e.target.value)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)',
                    border: `1px solid rgba(${hexRgb(C.orange)},0.25)`, borderRadius: 5,
                    color: '#e2eaf4', fontSize: 11, padding: '5px 8px', marginTop: 4 }}/>
              </div>
              <div>
                <label style={{ fontSize: 9, color: C.red, fontWeight: 700 }}>Overload Factor</label>
                <input type="number" min={1} max={2} step={0.05} value={overloadFactor}
                  onChange={e => setOverloadFactor(+e.target.value)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)',
                    border: `1px solid rgba(${hexRgb(C.red)},0.25)`, borderRadius: 5,
                    color: '#e2eaf4', fontSize: 11, padding: '5px 8px', marginTop: 4 }}/>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...card(C.orange), textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Cumulative ESALs (Design Period)
              </div>
              <div style={{ fontSize: 42, fontWeight: 900, color: C.orange,
                textShadow: `0 0 30px rgba(${hexRgb(C.orange)},0.5)`, lineHeight: 1 }}>
                {cesalTotal.toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', marginTop: 4 }}>
                Million Standard Axles (CESAL)
              </div>
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Daily ESALs', val: (cesalTotal * 1_000_000 / (365 * designLife)).toFixed(0) + '/day' },
                  { label: 'Design class', val: cesalTotal < 0.5 ? 'Light (T1)' : cesalTotal < 2 ? 'Medium (T2)' : cesalTotal < 7 ? 'Heavy (T3)' : 'Very Heavy (T4)' },
                  { label: 'Suggested SN', val: (1.8 + Math.log10(Math.max(0.01, cesalTotal)) * 0.9).toFixed(1) },
                  { label: 'Design period', val: `${designLife} years` },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.55)', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#d4dde8' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ESAL breakdown bar */}
            <div style={card(C.blue)}>
              <div style={{ fontSize: 10, fontWeight: 900, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                ESAL Contribution by Vehicle Class
              </div>
              <Chart3DWrap>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={Object.entries(ESAL_FACTORS).map(([cls, info]) => ({
                    name: info.name.split(' ')[0],
                    esal: +((counts[cls] ?? 0) * info.factor * 365 * designLife * overloadFactor / 1_000_000).toFixed(3),
                  }))} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                    <XAxis dataKey="name" tick={{ ...TICK_STYLE, fontSize: 8 }} angle={-35} textAnchor="end"/>
                    <YAxis tick={TICK_STYLE}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Bar dataKey="esal" name="CESAL (M)" fill={C.blue} radius={[4,4,0,0]} shape={<Bar3D/>}/>
                  </BarChart>
                </ResponsiveContainer>
              </Chart3DWrap>
            </div>
          </div>
        </div>
      )}

      {/* ── COSTS TAB ── */}
      {activeTab === 'costs' && (
        <div style={card(C.green)}>
          <div style={{ fontSize: 11, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Uganda Road Works Unit Cost Matrix
          </div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', marginBottom: 14 }}>
            Source: MoWT Schedule of Rates FY 2024/25 · Department of National Roads Contract Management Division. Costs exclude VAT. Paved = bituminous.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {['Type', 'Works Description', 'Unit', 'Paved Road', 'Unpaved Road', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9,
                      fontWeight: 900, color: `rgba(${hexRgb(C.green)},0.8)`,
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      borderBottom: `1px solid rgba(${hexRgb(C.green)},0.15)`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COST_MATRIX.map((r, i) => {
                  const typeColor = r.type === 'Routine Maintenance' ? C.green
                    : r.type === 'Periodic Maintenance' ? C.yellow
                    : r.type === 'Rehabilitation' ? C.orange : C.red;
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 800,
                          background: `rgba(${hexRgb(typeColor)},0.1)`,
                          color: typeColor }}>{r.type}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'rgba(196,210,225,0.9)' }}>{r.works}</td>
                      <td style={{ padding: '8px 12px', color: 'rgba(148,163,184,0.55)', fontSize: 10, fontFamily: 'monospace' }}>{r.unit}</td>
                      <td style={{ padding: '8px 12px', color: C.cyan, fontWeight: 700, fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>{r.bituminous}</td>
                      <td style={{ padding: '8px 12px', color: C.yellow, fontWeight: 700, fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>{r.unpaved}</td>
                      <td style={{ padding: '8px 12px', color: 'rgba(148,163,184,0.5)', fontSize: 9, maxWidth: 180 }}>{r.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── NPV TAB ── */}
      {activeTab === 'npv' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card(C.blue)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              NPV / BCR Scenario Analysis — Uganda National Network
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { scenario: 'Do Minimum', npv: -1420, bcr: 0.62, iri2034: 7.8, budget: 'UGX 180B/yr', color: C.red },
                { scenario: 'Maintain Standards', npv: 840, bcr: 1.42, iri2034: 5.2, budget: 'UGX 520B/yr', color: C.yellow },
                { scenario: 'Improve Network', npv: 2100, bcr: 1.85, iri2034: 3.8, budget: 'UGX 780B/yr', color: C.green },
              ].map(s => (
                <div key={s.scenario} style={{ background: `rgba(${hexRgb(s.color)},0.07)`,
                  border: `1px solid rgba(${hexRgb(s.color)},0.25)`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: s.color, marginBottom: 10 }}>{s.scenario}</div>
                  {[
                    { label: 'Net Present Value', value: `UGX ${s.npv}B` },
                    { label: 'Benefit-Cost Ratio', value: s.bcr.toFixed(2) },
                    { label: 'Network IRI 2034', value: `${s.iri2034} m/km` },
                    { label: 'Annual Budget', value: s.budget },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between',
                      padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>{r.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#d4dde8' }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
              Discount rate: 12% (Uganda MFPED). Analysis period: 10 years (2024–2034). Vehicle Operating Cost savings as primary benefit stream.
              Road User Cost model: HDM-4 VOC equations calibrated to Uganda vehicle fleet and fuel prices (URA FY2024/25).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function hexRgb(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}
