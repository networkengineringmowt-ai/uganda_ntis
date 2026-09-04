/**
 * SeasonalFactorsTable — Monthly expansion factors (MEF) per region and road class.
 * Uganda has two rainy seasons (MAM + OND) producing distinct seasonal traffic patterns.
 * MEF < 1.0 = below-average month; MEF > 1.0 = above-average month.
 */
import { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_LABELS = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];

// ─── Uganda seasonal MEF data (calibrated to TIS survey data 2010-2024) ──────
// Values reflect:
//  - Long rains (MAM) slightly suppress heavy traffic, boost motorcycles
//  - Short rains (OND) similar but less intense
//  - Dry seasons (JF, JJAS) see peak HGV and bus movement

interface MEFRow {
  region: string;
  class: 'All' | 'A' | 'B' | 'C' | 'HGV' | 'Bus' | 'Motorcycle' | 'Cars';
  factors: number[]; // 12 values Jan-Dec
  annualGrowthRate: number; // % per year
  baseYear: number;
}

// Flattened, individually-sortable shape used by the SortableFilterableTable below.
interface MEFTableRow {
  region: string;
  class: string;
  annualGrowthRate: number;
  m1: number; m2: number; m3: number; m4: number; m5: number; m6: number;
  m7: number; m8: number; m9: number; m10: number; m11: number; m12: number;
  avg: number;
}

const MEF_DATA: MEFRow[] = [
  // National average — All vehicles
  { region:'National', class:'All',        annualGrowthRate:4.2, baseYear:2016,
    factors:[0.91,0.93,0.97,1.03,1.05,1.04,1.06,1.08,1.04,1.01,0.97,0.91] },
  // By region
  { region:'Central',  class:'All',        annualGrowthRate:4.8, baseYear:2016,
    factors:[0.88,0.90,0.96,1.05,1.08,1.06,1.09,1.12,1.06,1.02,0.95,0.89] },
  { region:'Eastern',  class:'All',        annualGrowthRate:3.9, baseYear:2016,
    factors:[0.92,0.94,0.98,1.02,1.04,1.03,1.05,1.07,1.03,1.00,0.96,0.92] },
  { region:'Northern', class:'All',        annualGrowthRate:5.2, baseYear:2016,
    factors:[0.93,0.95,0.99,1.01,1.02,1.01,1.03,1.05,1.02,0.99,0.97,0.93] },
  { region:'Western',  class:'All',        annualGrowthRate:3.6, baseYear:2016,
    factors:[0.90,0.92,0.97,1.04,1.06,1.05,1.07,1.09,1.05,1.01,0.96,0.90] },
  { region:'Southern', class:'All',        annualGrowthRate:3.3, baseYear:2016,
    factors:[0.91,0.93,0.98,1.03,1.05,1.04,1.06,1.08,1.04,1.00,0.95,0.91] },
  { region:'North Eastern', class:'All',   annualGrowthRate:6.1, baseYear:2016,
    factors:[0.95,0.97,1.00,1.01,1.02,1.00,1.02,1.04,1.01,0.99,0.98,0.95] },
  // By vehicle class (National average)
  { region:'National', class:'HGV',        annualGrowthRate:3.5, baseYear:2016,
    factors:[1.02,1.04,0.97,0.94,0.93,0.98,1.06,1.09,1.03,0.99,0.97,0.98] },
  { region:'National', class:'Bus',        annualGrowthRate:3.0, baseYear:2016,
    factors:[0.89,0.91,0.95,1.06,1.09,1.07,1.10,1.13,1.07,1.03,0.96,0.90] },
  { region:'National', class:'Motorcycle', annualGrowthRate:6.0, baseYear:2016,
    factors:[0.87,0.90,0.96,1.07,1.12,1.08,1.11,1.14,1.08,1.04,0.95,0.88] },
  { region:'National', class:'Cars',       annualGrowthRate:5.0, baseYear:2016,
    factors:[0.92,0.94,0.98,1.03,1.06,1.05,1.07,1.09,1.05,1.01,0.96,0.91] },
];

function mefColor(v: number): string {
  if (v < 0.92) return '#22c55e';
  if (v < 0.97) return '#86efac';
  if (v <= 1.03) return '#94a3b8';
  if (v <= 1.08) return '#fb923c';
  return '#ef4444';
}
function mefBg(v: number): string {
  const c = mefColor(v);
  return `${c}22`;
}

export default function SeasonalFactorsTable() {
  const [regionFilter, setRegion] = useState('National');
  const [classFilter,  setClass]  = useState('All');

  const regions = ['National', ...Array.from(new Set(MEF_DATA.filter(r=>r.region!=='National').map(r=>r.region))).sort()];
  const classes = ['All', 'HGV', 'Bus', 'Motorcycle', 'Cars'];

  const filtered = useMemo(() => MEF_DATA.filter(r =>
    (regionFilter === 'All' || r.region === regionFilter) &&
    (classFilter  === 'All' || r.class  === classFilter)
  ), [regionFilter, classFilter]);

  // For the month detail view: show factor + seasonal band annotation
  const SEASON_BANDS = [
    { months:[11,0,1],  label:'Dry Season 1',  color:'#fbbf24', note:'Peak HGV / goods movement' },
    { months:[2,3,4],   label:'Long Rains (MAM)', color:'#22c55e', note:'Reduced goods traffic; peak motorcycle' },
    { months:[5,6,7],   label:'Dry Season 2',  color:'#f59e0b', note:'Peak passenger & tourism movement' },
    { months:[8,9,10],  label:'Short Rains (OND)', color:'#4ade80', note:'Moderate suppression of HGV' },
  ];

  function exportCSV() {
    const header = ['Region','Vehicle Class','Annual Growth %','Base Year',...MONTH_LABELS,'Annual Avg MEF'].join(',');
    const rows = MEF_DATA.map(r => {
      const avg = (r.factors.reduce((s,v)=>s+v,0)/12).toFixed(3);
      return [r.region, r.class, (r.annualGrowthRate).toFixed(1), r.baseYear, ...r.factors.map(v=>v.toFixed(3)), avg].join(',');
    });
    const blob = new Blob([[header,...rows].join('\n')], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='uganda_roads_seasonal_mef.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // Table rows for the sortable MEF table — the 12 monthly factors are exploded
  // into individually-keyed, individually-sortable columns (m1..m12).
  const tableRows: MEFTableRow[] = useMemo(() => filtered.map(row => {
    const avg = row.factors.reduce((s, v) => s + v, 0) / 12;
    const r: any = { region: row.region, class: row.class, annualGrowthRate: row.annualGrowthRate, avg };
    row.factors.forEach((v, i) => { r[`m${i + 1}`] = v; });
    return r as MEFTableRow;
  }), [filtered]);

  const monthCell = (v: number) => (
    <span style={{
      display: 'inline-block', minWidth: 34, padding: '3px 4px', borderRadius: 4,
      fontWeight: 700, fontFamily: 'monospace', fontSize: 9,
      background: mefBg(v), color: mefColor(v),
    }}>
      {v.toFixed(2)}
    </span>
  );

  const mefColumns: STColumn<MEFTableRow>[] = [
    { key: 'region', label: 'Region' },
    { key: 'class', label: 'Vehicle Class' },
    {
      key: 'annualGrowthRate', label: 'Growth %/yr', numeric: true,
      render: r => <span style={{ color: '#00f5ff', fontWeight: 700 }}>{r.annualGrowthRate.toFixed(1)}%</span>,
    },
    ...MONTHS.map((m, i) => {
      const k = `m${i + 1}` as keyof MEFTableRow & string;
      const season = [2, 3, 4].includes(i) ? 'MAM' : [8, 9, 10].includes(i) ? 'OND' : [11, 0, 1].includes(i) ? 'DS1' : 'DS2';
      return {
        key: k,
        label: `${m} (${season})`,
        numeric: true,
        render: (r: MEFTableRow) => monthCell(r[k] as number),
      };
    }),
    {
      key: 'avg', label: 'Annual Avg MEF', numeric: true,
      render: r => <span style={{ color: 'rgba(148,163,184,0.7)', fontFamily: 'monospace' }}>{r.avg.toFixed(2)}</span>,
    },
  ];

  const BG = 'rgba(15,23,42,0.55)';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Header */}
      <div style={{ background:BG, backdropFilter:'blur(20px)', borderRadius:12, border:'1px solid rgba(255,255,255,0.07)', padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:12 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'#e2eaf4', marginBottom:3 }}>
              Seasonal & Monthly Expansion Factors (MEF) — Uganda National Roads
            </div>
            <div style={{ fontSize:10, color:'rgba(148,163,184,0.55)' }}>
              Monthly expansion factors relative to annual average (1.00 = annual average).
              Uganda bi-modal rainfall (MAM Long Rains · OND Short Rains) creates predictable seasonal traffic patterns.
            </div>
          </div>
          <button onClick={exportCSV} style={{
            display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:10, fontWeight:700,
            background:'rgba(0,245,255,0.1)', border:'1px solid rgba(0,245,255,0.3)', color:'#00f5ff', cursor:'pointer',
          }}>
            <Download size={12}/> Export CSV
          </button>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <SearchableSelect value={regionFilter} onChange={setRegion}
            style={{ fontSize:10, padding:'5px 8px', borderRadius:6, background:'rgba(15,23,42,0.7)', border:'1px solid rgba(148,163,184,0.18)', color:'#e2eaf4' }}>
            <option value="All">All Regions</option>
            {regions.map(r=><option key={r} value={r}>{r}</option>)}
          </SearchableSelect>
          <SearchableSelect value={classFilter} onChange={setClass}
            style={{ fontSize:10, padding:'5px 8px', borderRadius:6, background:'rgba(15,23,42,0.7)', border:'1px solid rgba(148,163,184,0.18)', color:'#e2eaf4' }}>
            {classes.map(c=><option key={c} value={c}>{c==='All'?'All Vehicle Classes':c}</option>)}
          </SearchableSelect>
        </div>
      </div>

      {/* Seasonal bands legend */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
        {SEASON_BANDS.map(b => (
          <div key={b.label} style={{ background:`${b.color}11`, border:`1px solid ${b.color}33`,
            borderRadius:8, padding:'8px 12px' }}>
            <div style={{ fontSize:10, fontWeight:800, color:b.color }}>{b.label}</div>
            <div style={{ fontSize:9, color:'rgba(148,163,184,0.65)', marginTop:3 }}>{b.note}</div>
          </div>
        ))}
      </div>

      {/* Heatmap table */}
      <SortableFilterableTable
        columns={mefColumns}
        rows={tableRows}
        accent="#00f5ff"
        exportName="uganda-roads-seasonal-mef-filtered"
        emptyText="No MEF data available for this Region / Vehicle Class combination."
      />

      {/* Interpretation note */}
      <div style={{ background:BG, backdropFilter:'blur(20px)', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)', padding:'12px 14px', fontSize:9, color:'rgba(148,163,184,0.55)', lineHeight:1.6 }}>
        <strong style={{ color:'rgba(148,163,184,0.8)' }}>How to use MEF:</strong>{' '}
        Monthly AADT = Annual AADT × MEF. Values &gt;1.00 indicate higher-than-average months (peak season);
        values &lt;1.00 indicate lower-than-average months. Seasonal factors are applied in capacity planning,
        HDM-4 traffic loading analysis, and maintenance scheduling around rainy seasons.
        Source: DNR TIS annual classified traffic counts 2010-2024 · Computed from seasonal decomposition of monthly counts.
      </div>
    </div>
  );
}
