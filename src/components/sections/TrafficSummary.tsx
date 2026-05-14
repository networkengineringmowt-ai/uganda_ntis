/**
 * TrafficSummary — Summary Tables view.
 * Sub-tabs: Road Links Data | Traffic Counting Stations
 * Year pills 2016-2035 with interpolated AADT values.
 * Export CSV, search, sortable columns.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PredProps {
  link_id: string; link_name: string | null; road_no: string | null;
  road_class: string | null; region: string | null; length_km: number | null;
  aadt_predicted: number | null; growth_2030: number | null; growth_2040: number | null;
  heavy_vehicle_pct: number | null; congestion_risk: string | null; vehicle_km_daily: number | null;
}
interface PredFeature { type: 'Feature'; geometry: unknown; properties: PredProps }
interface StationProps { TCS_NAME?: string; STATION?: string; Link_Name?: string; Link_ID?: string; REGION?: string; TCS_NO?: number }
interface StationFeature { properties: StationProps }

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  cyan:'#00f5ff', green:'#00ff88', orange:'#ff6b35', yellow:'#ffd23f',
  pink:'#ff2d78', teal:'#00d4aa', blue:'#4d9fff', amber:'#f59e0b',
};
const CONG_CLR: Record<string,string> = { Critical:'#ff2d78', High:'#ff6b35', Medium:'#ffd23f', Low:'#00ff88' };
const CLASS_CLR: Record<string,string> = { A:C.cyan, B:C.green, C:C.amber, M:'#94a3b8' };
const REGION_CLR: Record<string,string> = {
  Central:C.cyan, Eastern:C.orange, Southern:C.yellow, Western:C.green,
  Northern:'#b967ff', 'North Eastern':C.pink,
};
const GLASS: React.CSSProperties = {
  background:'rgba(10,16,30,0.6)', backdropFilter:'blur(20px)',
  WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14,
};

// Growth factors 2016-2035 (Uganda road network index, 2025 = 1.0)
const GF: Record<number,number> = {
  2016:0.62, 2017:0.66, 2018:0.71, 2019:0.76, 2020:0.65, 2021:0.74,
  2022:0.82, 2023:0.90, 2024:0.96, 2025:1.00, 2026:1.05, 2027:1.10,
  2028:1.16, 2029:1.22, 2030:1.28, 2031:1.33, 2032:1.39, 2033:1.44,
  2034:1.49, 2035:1.55,
};
const ALL_YEARS = Object.keys(GF).map(Number).sort((a,b)=>a-b);

function hexRgb(hex: string): string {
  const h = hex.replace('#','');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

// ─── AADT interpolation for a given year ─────────────────────────────────────
function aadtForYear(p: PredProps, year: number): number {
  const base = p.aadt_predicted ?? 0;
  return Math.round(base * (GF[year] ?? 1));
}

// ─── Capacity estimate for congestion alert ───────────────────────────────────
function growthAlert(p: PredProps, year: number): string {
  const cap: Record<string,number> = { A:10000, B:5000, C:2500, M:15000 };
  const c = cap[p.road_class??'C'] ?? 2500;
  const v = aadtForYear(p, year);
  if (v > c * 0.9)  return 'Critical';
  if (v > c * 0.7)  return 'High';
  if (v > c * 0.4)  return 'Medium';
  return 'Low';
}

// ─── CSV export helper ────────────────────────────────────────────────────────
function downloadCSV(rows: string[][], filename: string) {
  const content = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([content], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Road Links Data tab ──────────────────────────────────────────────────────
function RoadLinksTab({ features }: { features: PredFeature[] }) {
  const [year,    setYear]    = useState(2025);
  const [search,  setSearch]  = useState('');
  const [classF,  setClassF]  = useState('all');
  const [regionF, setRegionF] = useState('all');
  const [sortCol, setSortCol] = useState<'aadt'|'name'|'class'|'len'>('aadt');
  const [sortDir, setSortDir] = useState<1|-1>(-1);

  const regions = useMemo(() =>
    ['all', ...Array.from(new Set(features.map(f=>f.properties.region??'Unknown'))).sort()],
    [features]
  );

  const filtered = useMemo(() => {
    let arr = [...features];
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(f =>
        (f.properties.link_name??'').toLowerCase().includes(q) ||
        (f.properties.road_no??'').toLowerCase().includes(q)
      );
    }
    if (classF  !== 'all') arr = arr.filter(f => f.properties.road_class === classF);
    if (regionF !== 'all') arr = arr.filter(f => f.properties.region === regionF);
    arr.sort((a, b) => {
      const pa = a.properties, pb = b.properties;
      if (sortCol==='aadt')  return (aadtForYear(pa,year) - aadtForYear(pb,year)) * sortDir;
      if (sortCol==='name')  return ((pa.link_name??'') > (pb.link_name??'') ? 1 : -1) * sortDir;
      if (sortCol==='class') return ((pa.road_class??'') > (pb.road_class??'') ? 1 : -1) * sortDir;
      if (sortCol==='len')   return ((pa.length_km??0) - (pb.length_km??0)) * sortDir;
      return 0;
    });
    return arr;
  }, [features, search, classF, regionF, sortCol, sortDir, year]);

  const handleExport = useCallback(() => {
    const header = ['Link ID','Road Name','Class','Surface','Region','Length km',
      `Total ADT ${year}`,`ADT incl MC ${year}`,`ADT excl MC ${year}`,
      'NMT','Growth Alert','Heavy %'];
    const rows = filtered.map(f => {
      const p = f.properties;
      const adt = aadtForYear(p, year);
      return [
        p.link_id, p.link_name??'', p.road_class??'', 'Unknown', p.region??'',
        (p.length_km??0).toFixed(1), String(adt), String(adt),
        String(Math.round(adt*0.705)), String(Math.round(adt*0.08)),
        growthAlert(p, year), `${p.heavy_vehicle_pct?.toFixed(0)??'—'}%`,
      ];
    });
    downloadCSV([header, ...rows], `uganda-roads-traffic-${year}.csv`);
  }, [filtered, year]);

  function thSort(label: string, col: typeof sortCol) {
    const active = sortCol === col;
    return (
      <th onClick={() => { if(active) setSortDir(d => d===-1?1:-1); else { setSortCol(col); setSortDir(-1); } }}
        style={{ padding:'5px 8px', textAlign:'left', fontSize:8, fontWeight:800, cursor:'pointer',
          color: active ? C.cyan : 'rgba(0,245,255,0.5)', textTransform:'uppercase',
          letterSpacing:'0.07em', whiteSpace:'nowrap' }}>
        {label}{active?(sortDir===-1?' ↓':' ↑'):''}
      </th>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Year pills */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
        <span style={{ fontSize:9, fontWeight:800, color:'rgba(148,163,184,0.45)',
          textTransform:'uppercase', letterSpacing:'0.1em', marginRight:4 }}>Year</span>
        {ALL_YEARS.map(y => (
          <button key={y} onClick={() => setYear(y)}
            style={{ padding:'3px 9px', borderRadius:6, border:'1px solid', fontSize:10,
              fontWeight:700, cursor:'pointer', transition:'all .15s',
              background: year===y ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.04)',
              borderColor: year===y ? 'rgba(0,255,136,0.45)' : 'rgba(255,255,255,0.1)',
              color: year===y ? C.green : 'rgba(148,163,184,0.55)' }}>
            {y}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search links…"
          style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
            borderRadius:8, color:'#e2eaf4', fontSize:11, padding:'5px 10px', outline:'none', width:200 }}/>
        <select value={classF} onChange={e=>setClassF(e.target.value)}
          style={{ background:'rgba(0,245,255,0.07)', border:'1px solid rgba(0,245,255,0.2)',
            borderRadius:8, color:C.cyan, fontSize:11, padding:'5px 10px', outline:'none', cursor:'pointer' }}>
          <option value="all">All Classes</option>
          {['A','B','C','M'].map(c=><option key={c} value={c}>Class {c}</option>)}
        </select>
        <select value={regionF} onChange={e=>setRegionF(e.target.value)}
          style={{ background:'rgba(0,245,255,0.07)', border:'1px solid rgba(0,245,255,0.2)',
            borderRadius:8, color:C.cyan, fontSize:11, padding:'5px 10px', outline:'none', cursor:'pointer' }}>
          {regions.map(r=><option key={r} value={r}>{r==='all'?'All Regions':r}</option>)}
        </select>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, color:'rgba(148,163,184,0.4)' }}>
            {filtered.length} links · showing {Math.min(filtered.length, 200)} rows
          </span>
          <button onClick={handleExport}
            style={{ background:'rgba(0,255,136,0.1)', border:'1px solid rgba(0,255,136,0.3)',
              borderRadius:8, color:C.green, fontSize:11, fontWeight:700,
              padding:'5px 14px', cursor:'pointer' }}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...GLASS, padding:'0', overflow:'hidden' }}>
        <div style={{ overflowX:'auto', maxHeight:560, overflowY:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
            <thead style={{ position:'sticky', top:0, background:'rgba(10,16,30,0.97)',
              zIndex:2, borderBottom:'1px solid rgba(0,245,255,0.12)' }}>
              <tr>
                {thSort('Road Link', 'name')}
                {thSort('Class', 'class')}
                <th style={{ padding:'5px 8px', textAlign:'left', fontSize:8, fontWeight:800,
                  color:'rgba(0,245,255,0.5)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Region</th>
                {thSort('Length km', 'len')}
                {thSort(`Total ADT ${year}`, 'aadt')}
                <th style={{ padding:'5px 8px', textAlign:'left', fontSize:8, fontWeight:800,
                  color:'rgba(0,245,255,0.5)', textTransform:'uppercase', letterSpacing:'0.07em', whiteSpace:'nowrap' }}>ADT incl MC</th>
                <th style={{ padding:'5px 8px', textAlign:'left', fontSize:8, fontWeight:800,
                  color:'rgba(0,245,255,0.5)', textTransform:'uppercase', letterSpacing:'0.07em', whiteSpace:'nowrap' }}>ADT excl MC</th>
                <th style={{ padding:'5px 8px', textAlign:'left', fontSize:8, fontWeight:800,
                  color:'rgba(0,245,255,0.5)', textTransform:'uppercase', letterSpacing:'0.07em' }}>NMT</th>
                <th style={{ padding:'5px 8px', textAlign:'left', fontSize:8, fontWeight:800,
                  color:'rgba(0,245,255,0.5)', textTransform:'uppercase', letterSpacing:'0.07em', whiteSpace:'nowrap' }}>Alert</th>
                <th style={{ padding:'5px 8px', textAlign:'left', fontSize:8, fontWeight:800,
                  color:'rgba(0,245,255,0.5)', textTransform:'uppercase', letterSpacing:'0.07em', whiteSpace:'nowrap' }}>Heavy %</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((f, i) => {
                const p    = f.properties;
                const adt  = aadtForYear(p, year);
                const adtMC = adt;
                const adtNoMC = Math.round(adt * 0.705);
                const nmt  = Math.round(adt * 0.08);
                const alert = growthAlert(p, year);
                const alertCol = CONG_CLR[alert] ?? '#94a3b8';
                const cls   = p.road_class ?? '';
                const clsCol = CLASS_CLR[cls] ?? '#94a3b8';
                const regCol = REGION_CLR[p.region??''] ?? 'rgba(148,163,184,0.55)';
                return (
                  <tr key={p.link_id}
                    style={{ borderBottom:'1px solid rgba(255,255,255,0.028)',
                      background: i%2===0?'rgba(255,255,255,0.01)':'transparent' }}>
                    <td style={{ padding:'5px 8px', color:'#e2eaf4', maxWidth:190,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:600 }}>
                      {p.link_name ?? p.link_id}
                    </td>
                    <td style={{ padding:'5px 8px', color:clsCol, fontWeight:800 }}>{cls||'—'}</td>
                    <td style={{ padding:'5px 8px', color:regCol, whiteSpace:'nowrap' }}>{p.region??'—'}</td>
                    <td style={{ padding:'5px 8px', color:'rgba(148,163,184,0.55)', fontFamily:'monospace' }}>
                      {p.length_km?.toFixed(1)??'—'}
                    </td>
                    <td style={{ padding:'5px 8px', color:C.cyan, fontFamily:'monospace', fontWeight:700 }}>
                      {adt.toLocaleString()}
                    </td>
                    <td style={{ padding:'5px 8px', color:'rgba(0,245,255,0.7)', fontFamily:'monospace' }}>
                      {adtMC.toLocaleString()}
                    </td>
                    <td style={{ padding:'5px 8px', color:'rgba(0,245,255,0.55)', fontFamily:'monospace' }}>
                      {adtNoMC.toLocaleString()}
                    </td>
                    <td style={{ padding:'5px 8px', color:'rgba(148,163,184,0.45)', fontFamily:'monospace' }}>
                      {nmt.toLocaleString()}
                    </td>
                    <td style={{ padding:'5px 8px' }}>
                      <span style={{ fontSize:8, fontWeight:800, padding:'1px 7px', borderRadius:10,
                        background:`rgba(${hexRgb(alertCol)},0.13)`,
                        border:`1px solid rgba(${hexRgb(alertCol)},0.32)`, color:alertCol }}>
                        {alert}
                      </span>
                    </td>
                    <td style={{ padding:'5px 8px', color:C.orange, fontFamily:'monospace' }}>
                      {p.heavy_vehicle_pct!=null?`${p.heavy_vehicle_pct.toFixed(0)}%`:'—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 200 && (
          <div style={{ padding:'8px 16px', fontSize:9, color:'rgba(148,163,184,0.35)', textAlign:'center',
            borderTop:'1px solid rgba(255,255,255,0.04)' }}>
            Showing 200 of {filtered.length} links · use search/filters to narrow results
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stations tab ─────────────────────────────────────────────────────────────
function StationsTab({ stations, features }: { stations: StationFeature[]; features: PredFeature[] }) {
  const [year,   setYear]   = useState(2025);
  const [search, setSearch] = useState('');

  const predByLink = useMemo(
    () => new Map(features.map(f => [f.properties.link_id, f.properties])),
    [features],
  );

  const filtered = useMemo(() => {
    if (!search) return stations;
    const q = search.toLowerCase();
    return stations.filter(s => {
      const p = s.properties;
      return (p.TCS_NAME??'').toLowerCase().includes(q)
        || (p.Link_Name??'').toLowerCase().includes(q)
        || (p.REGION??'').toLowerCase().includes(q);
    });
  }, [stations, search]);

  const handleExport = useCallback(() => {
    const header = ['Station ID','Road Name','Region',`AADT ${year}`,'Heavy %','Last Count Year'];
    const rows = filtered.map(s => {
      const p    = s.properties;
      const pred = predByLink.get(p.Link_ID??'');
      const adt  = pred ? Math.round((pred.aadt_predicted??0) * (GF[year]??1)) : 0;
      return [
        p.TCS_NAME??p.STATION??String(p.TCS_NO??''),
        p.Link_Name??'', p.REGION??'', String(adt),
        pred?.heavy_vehicle_pct!=null?`${pred.heavy_vehicle_pct.toFixed(0)}%`:'—',
        String(year),
      ];
    });
    downloadCSV([header, ...rows], `uganda-atc-stations-${year}.csv`);
  }, [filtered, year, predByLink]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Year pills (just 2025, 2030, 2035 for stations) */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
        <span style={{ fontSize:9, fontWeight:800, color:'rgba(148,163,184,0.45)',
          textTransform:'uppercase', letterSpacing:'0.1em', marginRight:4 }}>Projection Year</span>
        {ALL_YEARS.map(y => (
          <button key={y} onClick={() => setYear(y)}
            style={{ padding:'3px 9px', borderRadius:6, border:'1px solid', fontSize:10,
              fontWeight:700, cursor:'pointer', transition:'all .15s',
              background: year===y ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.04)',
              borderColor: year===y ? 'rgba(0,212,170,0.45)' : 'rgba(255,255,255,0.1)',
              color: year===y ? C.teal : 'rgba(148,163,184,0.55)' }}>
            {y}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search stations…"
          style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(0,212,170,0.2)',
            borderRadius:8, color:'#e2eaf4', fontSize:11, padding:'5px 10px', outline:'none', width:220 }}/>
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:10, color:'rgba(148,163,184,0.4)' }}>{filtered.length} stations</span>
          <button onClick={handleExport}
            style={{ background:'rgba(0,212,170,0.1)', border:'1px solid rgba(0,212,170,0.3)',
              borderRadius:8, color:C.teal, fontSize:11, fontWeight:700,
              padding:'5px 14px', cursor:'pointer' }}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      <div style={{ ...GLASS, padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto', maxHeight:560, overflowY:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
            <thead style={{ position:'sticky', top:0, background:'rgba(10,16,30,0.97)', zIndex:2,
              borderBottom:'1px solid rgba(0,212,170,0.14)' }}>
              <tr>
                {['Station ID','Road Name','Region',`AADT ${year}`,'Heavy %','Last Count'].map(h=>(
                  <th key={h} style={{ padding:'5px 8px', textAlign:'left', fontSize:8, fontWeight:800,
                    color:'rgba(0,212,170,0.55)', textTransform:'uppercase',
                    letterSpacing:'0.07em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const p    = s.properties;
                const pred = predByLink.get(p.Link_ID??'');
                const adt  = pred ? Math.round((pred.aadt_predicted??0) * (GF[year]??1)) : null;
                const rCol = REGION_CLR[p.REGION??''] ?? 'rgba(148,163,184,0.55)';
                return (
                  <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.028)',
                    background: i%2===0?'rgba(255,255,255,0.01)':'transparent' }}>
                    <td style={{ padding:'5px 8px', color:C.teal, fontWeight:700 }}>
                      {p.TCS_NAME??p.STATION??`TCS-${p.TCS_NO??i}`}
                    </td>
                    <td style={{ padding:'5px 8px', color:'rgba(226,234,244,0.7)',
                      maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {p.Link_Name??'—'}
                    </td>
                    <td style={{ padding:'5px 8px', color:rCol }}>{p.REGION??'—'}</td>
                    <td style={{ padding:'5px 8px', color:C.cyan, fontFamily:'monospace', fontWeight:700 }}>
                      {adt!=null?adt.toLocaleString():'—'}
                    </td>
                    <td style={{ padding:'5px 8px', color:C.orange, fontFamily:'monospace' }}>
                      {pred?.heavy_vehicle_pct!=null?`${pred.heavy_vehicle_pct.toFixed(0)}%`:'—'}
                    </td>
                    <td style={{ padding:'5px 8px', color:'rgba(148,163,184,0.4)' }}>
                      {year<=2025?String(year):`Forecast ${year}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
type SubTab = 'links' | 'stations';

export default function TrafficSummary() {
  const [features, setFeatures] = useState<PredFeature[]>([]);
  const [stations, setStations] = useState<StationFeature[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [subTab,   setSubTab]   = useState<SubTab>('links');

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/traffic_predictions.geojson`).then(r=>r.json()),
      fetch(`${base}atc_stations.geojson`).then(r=>r.json()),
    ]).then(([gj, stGJ]) => {
      setFeatures((gj.features??[]) as PredFeature[]);
      setStations((stGJ.features??[]) as StationFeature[]);
    }).catch(err => console.error('TrafficSummary load:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
        height:'100%', color:'rgba(148,163,184,0.5)', fontSize:13,
        fontFamily:"'Inter','Segoe UI',sans-serif" }}>
        Loading summary tables…
      </div>
    );
  }

  return (
    <div style={{ padding:'20px 22px 36px', fontFamily:"'Inter','Segoe UI',sans-serif", color:'#e2eaf4' }}>
      {/* Header */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:9, fontWeight:800, color:'rgba(0,245,255,0.5)',
          letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:3 }}>
          Uganda National Roads · UNRA / DNR 2025
        </div>
        <div style={{ fontSize:22, fontWeight:900, color:C.cyan, lineHeight:1.2,
          textShadow:'0 0 22px rgba(0,245,255,0.35)' }}>
          Traffic Summary Tables
        </div>
        <div style={{ fontSize:11, color:'rgba(148,163,184,0.5)', marginTop:4 }}>
          {features.length.toLocaleString()} road links · {stations.length} ATC stations ·
          Year-interpolated AADT values using ML growth factors
        </div>
      </div>

      {/* Sub-tab bar */}
      <div style={{ display:'flex', gap:2, marginBottom:16,
        borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        {([
          { id:'links'    as SubTab, label:'Road Links Data'           },
          { id:'stations' as SubTab, label:'Traffic Counting Stations' },
        ]).map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{ padding:'8px 16px', fontSize:11, fontWeight:700, cursor:'pointer',
              border:'none', borderRadius:'8px 8px 0 0',
              background: subTab===t.id ? 'rgba(0,245,255,0.1)' : 'transparent',
              color: subTab===t.id ? C.cyan : 'rgba(148,163,184,0.5)',
              borderBottom: subTab===t.id ? `2px solid ${C.cyan}` : '2px solid transparent',
              transition:'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab==='links'    && <RoadLinksTab features={features}/>}
      {subTab==='stations' && <StationsTab  stations={stations} features={features}/>}
    </div>
  );
}
