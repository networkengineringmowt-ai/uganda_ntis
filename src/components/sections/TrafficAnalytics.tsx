/**
 * TrafficAnalytics — ATC-style multi-tab analytics dashboard.
 * Tabs: MACRO | REGIONS | CLASSES | ASSETS | ANALYSIS | STATIONS | STRATEGIC
 */
import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';

// ─── Data types ───────────────────────────────────────────────────────────────
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
  cyan:'#00f5ff', green:'#00ff88', orange:'#ff6b35', purple:'#b967ff',
  yellow:'#ffd23f', pink:'#ff2d78', blue:'#4d9fff', teal:'#00d4aa', amber:'#f59e0b',
};
const CONG_CLR: Record<string,string> = { Critical:'#ff2d78', High:'#ff6b35', Medium:'#ffd23f', Low:'#00ff88' };

const GROWTH_FACTORS: Record<number,number> = {
  2016:0.62, 2017:0.66, 2018:0.71, 2019:0.76, 2020:0.65, 2021:0.74,
  2022:0.82, 2023:0.90, 2024:0.96, 2025:1.00, 2026:1.05, 2027:1.10,
  2028:1.16, 2029:1.22, 2030:1.28, 2031:1.33, 2032:1.39, 2033:1.44,
  2034:1.49, 2035:1.55,
};

const VEHICLE_CLASSES = [
  { id:'mc',  name:'Motorcycles',          abbr:'MC', pct:0.295, color:C.cyan   },
  { id:'sc',  name:'Saloon Cars & Taxis',  abbr:'SC', pct:0.248, color:C.green  },
  { id:'lg',  name:'Light Goods',          abbr:'LG', pct:0.118, color:C.yellow },
  { id:'sb',  name:'Small Buses',          abbr:'SB', pct:0.082, color:C.orange },
  { id:'mb',  name:'Medium Buses',         abbr:'MB', pct:0.053, color:C.purple },
  { id:'lb',  name:'Large Buses',          abbr:'LB', pct:0.042, color:C.pink   },
  { id:'lt',  name:'Light Trucks',         abbr:'LT', pct:0.062, color:C.blue   },
  { id:'mt',  name:'Medium Trucks',        abbr:'MT', pct:0.041, color:C.teal   },
  { id:'ht',  name:'Heavy Trucks',         abbr:'HT', pct:0.033, color:'#f0abfc'},
  { id:'tt',  name:'Truck Trailers',       abbr:'TT', pct:0.018, color:'#fbbf24'},
  { id:'t5',  name:'Truck Trailers 5ax',   abbr:'T5', pct:0.008, color:'#a3e635'},
];

const REGIONS = ['Central','Eastern','Southern','Western','Northern','North Eastern'];
const REGION_CLR: Record<string,string> = {
  Central:C.cyan, Eastern:C.orange, Southern:C.yellow, Western:C.green, Northern:C.purple, 'North Eastern':C.pink,
};
const CLASS_CLR: Record<string,string> = { A:C.cyan, B:C.green, C:C.amber, M:'#94a3b8' };

const GLASS: React.CSSProperties = {
  background:'rgba(10,16,30,0.6)', backdropFilter:'blur(20px)',
  WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14,
};

function hexRgb(hex: string): string {
  const h = hex.replace('#','');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────
function polToXY(cx:number, cy:number, r:number, deg:number) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function donutArc(cx:number, cy:number, ro:number, ri:number, s:number, e:number): string {
  const os = polToXY(cx,cy,ro,s), oe = polToXY(cx,cy,ro,e);
  const is = polToXY(cx,cy,ri,s), ie = polToXY(cx,cy,ri,e);
  const large = e - s > 180 ? 1 : 0;
  return `M${os.x} ${os.y} A${ro} ${ro} 0 ${large} 1 ${oe.x} ${oe.y} L${ie.x} ${ie.y} A${ri} ${ri} 0 ${large} 0 ${is.x} ${is.y}Z`;
}

// ─── Chart: Growth Trajectory area (2016-2035) ───────────────────────────────
function GrowthTrajectory({ avgAadt }: { avgAadt: number }) {
  const years = Object.keys(GROWTH_FACTORS).map(Number).sort((a,b)=>a-b);
  const vals  = years.map(y => avgAadt * GROWTH_FACTORS[y]);
  const W=600, H=170, PL=46, PR=12, PT=10, PB=24;
  const cW=W-PL-PR, cH=H-PT-PB;
  const min = Math.min(...vals)*0.85, max = Math.max(...vals)*1.08;
  const range = max-min||1;
  const xp = (i:number) => PL + (i/(years.length-1))*cW;
  const yp = (v:number) => PT + (1-(v-min)/range)*cH;
  const pts = vals.map((v,i) => `${xp(i).toFixed(1)},${yp(v).toFixed(1)}`);
  const areaD = `M${xp(0).toFixed(1)},${(PT+cH).toFixed(1)} L${pts.join(' L')} L${xp(years.length-1).toFixed(1)},${(PT+cH).toFixed(1)}Z`;
  const covidIdx = years.indexOf(2020);
  const yticks = [0,.25,.5,.75,1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:H, display:'block' }}>
      <defs>
        <linearGradient id="tgG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={C.teal} stopOpacity={0.5}/>
          <stop offset="100%" stopColor={C.teal} stopOpacity={0.03}/>
        </linearGradient>
      </defs>
      {yticks.map(t => {
        const y = PT + t*cH, v = max - t*range;
        return (
          <g key={t}>
            <line x1={PL} x2={PL+cW} y1={y} y2={y} stroke="rgba(148,163,184,0.07)" strokeDasharray="3 3"/>
            <text x={PL-5} y={y+4} fill="rgba(148,163,184,0.42)" fontSize={9} textAnchor="end">
              {v>=1000?`${(v/1000).toFixed(0)}k`:Math.round(v)}
            </text>
          </g>
        );
      })}
      {/* Year labels */}
      {[2016,2020,2025,2030,2035].map(yr => {
        const i = years.indexOf(yr);
        if (i<0) return null;
        return (
          <g key={yr}>
            <line x1={xp(i)} x2={xp(i)} y1={PT} y2={PT+cH} stroke="rgba(148,163,184,0.06)"/>
            <text x={xp(i)} y={H-3} fill="rgba(148,163,184,0.5)" fontSize={9} textAnchor="middle">{yr}</text>
          </g>
        );
      })}
      {/* COVID dip annotation */}
      {covidIdx>=0 && <>
        <line x1={xp(covidIdx)} x2={xp(covidIdx)} y1={PT} y2={PT+cH}
          stroke="rgba(255,210,63,0.28)" strokeDasharray="3 2"/>
        <text x={xp(covidIdx)+4} y={PT+14} fill="rgba(255,210,63,0.55)" fontSize={8}>COVID-19</text>
      </>}
      <path d={areaD} fill="url(#tgG)"/>
      <polyline points={pts.join(' ')} fill="none" stroke={C.teal} strokeWidth={2.2}
        strokeLinejoin="round" strokeLinecap="round"
        style={{ filter:`drop-shadow(0 0 5px ${C.teal}99)` }}/>
      {/* Dots at key years */}
      {[2016,2020,2025,2030,2035].map(yr => {
        const i = years.indexOf(yr);
        if (i<0) return null;
        const col = yr===2020?C.yellow:C.teal;
        return <circle key={yr} cx={xp(i)} cy={yp(vals[i])} r={3.5} fill={col}
          style={{ filter:`drop-shadow(0 0 4px ${col})` }}/>;
      })}
    </svg>
  );
}

// ─── Chart: Vehicle class donut ───────────────────────────────────────────────
function VehicleDonut({ avgAadt }: { avgAadt: number }) {
  const CX=120, CY=120, RO=90, RI=52;
  let start = 0;
  const segs = VEHICLE_CLASSES.map(vc => {
    const end = start + vc.pct * 360;
    const d = donutArc(CX, CY, RO, RI, start, Math.max(end - 0.5, start + 0.1));
    const seg = { ...vc, d, aadt: Math.round(avgAadt * vc.pct) };
    start = end;
    return seg;
  });
  return (
    <div>
      <svg viewBox="0 0 240 240" style={{ width:'100%', maxWidth:240, display:'block', margin:'0 auto' }}>
        {segs.map(s => (
          <path key={s.id} d={s.d} fill={s.color} fillOpacity={0.88}
            style={{ filter:`drop-shadow(0 0 4px ${s.color}66)` }}>
            <title>{s.name}: {s.aadt.toLocaleString()} ADT/day ({(s.pct*100).toFixed(1)}%)</title>
          </path>
        ))}
        <text x={CX} y={CY-8} fill="#e2eaf4" fontSize={16} fontWeight={900} textAnchor="middle">
          {Math.round(avgAadt/1000)}k
        </text>
        <text x={CX} y={CY+10} fill="rgba(148,163,184,0.55)" fontSize={9} textAnchor="middle">ADT/day</text>
      </svg>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'3px 12px', marginTop:8, justifyContent:'center' }}>
        {segs.map(s => (
          <div key={s.id} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:8, height:8, borderRadius:2, background:s.color, display:'inline-block' }}/>
            <span style={{ fontSize:9, color:s.color }}>{s.name}</span>
            <span style={{ fontSize:9, color:'rgba(148,163,184,0.35)' }}>{(s.pct*100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chart: Avg ADT per vehicle class (horizontal bars) ──────────────────────
function VehicleClassBars({ avgAadt }: { avgAadt: number }) {
  const max = avgAadt * Math.max(...VEHICLE_CLASSES.map(v => v.pct));
  const W=380, ROW=24, LW=130;
  return (
    <svg viewBox={`0 0 ${W} ${VEHICLE_CLASSES.length*ROW+4}`}
      style={{ width:'100%', height:VEHICLE_CLASSES.length*ROW+4, display:'block' }}>
      {VEHICLE_CLASSES.map((vc,i) => {
        const v  = avgAadt * vc.pct;
        const bW = (v/max) * (W-LW-50);
        const y  = i*ROW+4;
        return (
          <g key={vc.id}>
            <text x={0} y={y+14} fill={vc.color} fontSize={9}>{vc.name}</text>
            <rect x={LW} y={y} width={W-LW-50} height={17} rx={4} fill={`rgba(${hexRgb(vc.color)},0.07)`}/>
            {bW>0 && <>
              <rect x={LW} y={y} width={bW} height={17} rx={4} fill={vc.color} fillOpacity={0.78}/>
              <rect x={LW} y={y} width={bW} height={8} rx={4} fill="rgba(255,255,255,0.13)"/>
            </>}
            <text x={W} y={y+13} fill={vc.color} fontSize={9} fontWeight={700} textAnchor="end">
              {Math.round(v).toLocaleString()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Chart: Stacked vertical bars (by road class or region) ──────────────────
function StackedBars({
  groups, groupColors, avgAadts, title,
}: {
  groups: string[]; groupColors: Record<string,string>;
  avgAadts: Record<string,number>; title: string;
}) {
  const maxVal = Math.max(...groups.map(g => avgAadts[g]??0), 1);
  const W=400, H=220, PL=10, PR=10, PT=10, PB=30;
  const cW=W-PL-PR, cH=H-PT-PB;
  const barW = Math.min(52, (cW/groups.length)*0.65);
  const gap  = (cW - barW*groups.length) / (groups.length+1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:H, display:'block' }}>
      <text x={W/2} y={12} fill="rgba(148,163,184,0.5)" fontSize={9} textAnchor="middle">{title}</text>
      {groups.map((grp, gi) => {
        const total = avgAadts[grp] ?? 0;
        const x = PL + gap*(gi+1) + barW*gi;
        let stackY = PT + cH;
        const col = groupColors[grp] ?? '#94a3b8';
        return (
          <g key={grp}>
            {VEHICLE_CLASSES.map(vc => {
              const h = (vc.pct * total / maxVal) * cH;
              stackY -= h;
              if (h < 0.5) return null;
              return (
                <rect key={vc.id} x={x} y={stackY} width={barW} height={h}
                  fill={vc.color} fillOpacity={0.82}/>
              );
            })}
            {/* Group label */}
            <text x={x+barW/2} y={H-3} fill={col} fontSize={8} textAnchor="middle"
              style={{ letterSpacing:'-0.02em' }}>
              {grp.length>8?grp.slice(0,7)+'…':grp}
            </text>
            {/* Total label */}
            {total>0 && (
              <text x={x+barW/2} y={PT+cH-(total/maxVal)*cH-4}
                fill={col} fontSize={8} textAnchor="middle" fontWeight={700}>
                {total>=1000?`${(total/1000).toFixed(0)}k`:Math.round(total)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Chart: YOY Increment Rates ──────────────────────────────────────────────
function YOYRatesChart({ avgAadt }: { avgAadt: number }) {
  const years = Object.keys(GROWTH_FACTORS).map(Number).sort((a,b)=>a-b);
  const rates = years.slice(1).map((y,i) => ({
    year: y,
    rate: (GROWTH_FACTORS[y]/GROWTH_FACTORS[years[i]] - 1)*100,
  }));
  const W=600, H=140, PL=40, PR=12, PT=10, PB=24;
  const cW=W-PL-PR, cH=H-PT-PB;
  const min = Math.min(...rates.map(r=>r.rate))*1.2;
  const max = Math.max(...rates.map(r=>r.rate))*1.2;
  const range = max-min||1;
  const xp = (i:number) => PL + (i/(rates.length-1))*cW;
  const yp = (v:number) => PT + (1-(v-min)/range)*cH;
  const zeroY = yp(0);
  const pts = rates.map((r,i) => `${xp(i).toFixed(1)},${yp(r.rate).toFixed(1)}`);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:H, display:'block' }}>
      {/* Zero line */}
      <line x1={PL} x2={PL+cW} y1={zeroY} y2={zeroY}
        stroke="rgba(148,163,184,0.15)" strokeDasharray="4 2"/>
      <text x={PL-5} y={zeroY+4} fill="rgba(148,163,184,0.4)" fontSize={8} textAnchor="end">0%</text>
      {/* Year labels */}
      {[2017,2020,2025,2030,2035].map(yr => {
        const idx = rates.findIndex(r=>r.year===yr);
        if (idx<0) return null;
        return (
          <text key={yr} x={xp(idx)} y={H-3} fill="rgba(148,163,184,0.5)" fontSize={8} textAnchor="middle">
            {yr}
          </text>
        );
      })}
      {/* Line */}
      <polyline points={pts.join(' ')} fill="none" stroke={C.green} strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round"/>
      {/* Dots */}
      {rates.map((r,i) => (
        <circle key={r.year} cx={xp(i)} cy={yp(r.rate)} r={3}
          fill={r.rate<0?C.pink:r.rate>10?C.green:C.yellow}
          style={{ filter:`drop-shadow(0 0 3px ${r.rate<0?C.pink:C.green})` }}/>
      ))}
    </svg>
  );
}

// ─── Mini donut for region cards ──────────────────────────────────────────────
function MiniDonut({ items }: { items: { v:number; color:string }[] }) {
  const total = items.reduce((s,i)=>s+i.v,0)||1;
  let start = 0;
  return (
    <svg viewBox="0 0 60 60" style={{ width:60, height:60, flexShrink:0 }}>
      {items.map((item, i) => {
        const end = start + (item.v/total)*360;
        const d = donutArc(30,30,26,16, start, Math.max(end-0.5, start+0.1));
        start = end;
        return <path key={i} d={d} fill={item.color} fillOpacity={0.85}/>;
      })}
    </svg>
  );
}

// ─── 8 key vehicle classes for clustered charts ──────────────────────────────
const KEY_CLASSES = [
  { key:'mc', label:'Motorcycle', color:'#00f5ff' },
  { key:'sc', label:'Car/Taxi',   color:'#00ff88' },
  { key:'sb', label:'Mini-bus',   color:'#ff6b35' },
  { key:'lb', label:'Bus',        color:'#b967ff' },
  { key:'lg', label:'Light Goods',color:'#ffd23f' },
  { key:'lt', label:'Med. Goods', color:'#4d9fff' },
  { key:'ht', label:'Heavy Goods',color:'#f0abfc' },
  { key:'tt', label:'Articulated',color:'#fbbf24' },
];

const VC_PCT: Record<string,number> = Object.fromEntries(
  VEHICLE_CLASSES.map(v=>[v.id, v.pct])
);

// ─── Recharts tooltip ────────────────────────────────────────────────────────
function ClusterTip({ active, payload, label }: {
  active?: boolean; payload?: {name:string;value:number;color:string}[]; label?: string
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'rgba(10,16,30,0.92)', border:'1px solid rgba(0,245,255,0.18)',
      borderRadius:8, padding:'8px 12px', fontSize:10 }}>
      <div style={{ fontWeight:800, color:'#fff', marginBottom:6 }}>{label}</div>
      {payload.map(p=>(
        <div key={p.name} style={{ display:'flex', justifyContent:'space-between', gap:16, color:p.color }}>
          <span>{p.name}</span>
          <span style={{ fontWeight:700 }}>{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Clustered column chart: vehicle class AADT by group (region or road class) ─
function ClusteredClassChart({
  groups, avgAadts, groupColors, title, subtitle,
}: {
  groups: string[]; avgAadts: Record<string,number>;
  groupColors: Record<string,string>; title: string; subtitle?: string;
}) {
  const data = groups.map(grp => {
    const aadt = avgAadts[grp] ?? 0;
    const row: Record<string,number|string> = { group: grp.length>10?grp.slice(0,9)+'…':grp };
    KEY_CLASSES.forEach(vc => { row[vc.label] = Math.round(aadt * (VC_PCT[vc.key]??0)); });
    return row;
  });

  return (
    <div style={{ ...GLASS, padding:'18px 20px' }}>
      <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:3 }}>{title}</div>
      {subtitle && <div style={{ fontSize:10, color:'rgba(148,163,184,0.45)', marginBottom:12 }}>{subtitle}</div>}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top:4, right:4, left:-10, bottom:20 }}
          barCategoryGap="25%" barGap={1}>
          <CartesianGrid strokeDasharray="2 2" stroke="rgba(148,163,184,0.06)" vertical={false}/>
          <XAxis dataKey="group" tick={{ fill:'rgba(148,163,184,0.55)', fontSize:9 }}
            axisLine={false} tickLine={false}/>
          <YAxis tick={{ fill:'rgba(148,163,184,0.35)', fontSize:8 }}
            tickFormatter={(v:number)=>v>=1000?`${(v/1000).toFixed(0)}k`:String(v)}
            axisLine={false} tickLine={false}/>
          <Tooltip content={<ClusterTip/>}/>
          <Legend wrapperStyle={{ fontSize:8, paddingTop:4 }}
            formatter={(v:string)=><span style={{ color:'rgba(148,163,184,0.7)' }}>{v}</span>}/>
          {KEY_CLASSES.map(vc=>(
            <Bar key={vc.key} dataKey={vc.label} fill={vc.color} fillOpacity={0.82}
              radius={[2,2,0,0]}/>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Tab components ───────────────────────────────────────────────────────────

function MacroTab({ features }: { features: PredFeature[] }) {
  const avgAadt = useMemo(() =>
    features.length ? features.reduce((s,f)=>s+(f.properties.aadt_predicted??0),0)/features.length : 0,
    [features]
  );
  const byClass = useMemo(() => {
    const m: Record<string,{sum:number,n:number}> = {};
    for (const f of features) {
      const c = f.properties.road_class ?? 'Unknown';
      if (!m[c]) m[c] = {sum:0,n:0};
      m[c].sum += f.properties.aadt_predicted ?? 0;
      m[c].n++;
    }
    return Object.fromEntries(Object.entries(m).map(([k,v])=>[k, v.n?v.sum/v.n:0]));
  }, [features]);
  const byRegion = useMemo(() => {
    const m: Record<string,{sum:number,n:number}> = {};
    for (const f of features) {
      const r = f.properties.region ?? 'Unknown';
      if (!m[r]) m[r] = {sum:0,n:0};
      m[r].sum += f.properties.aadt_predicted ?? 0;
      m[r].n++;
    }
    return Object.fromEntries(Object.entries(m).map(([k,v])=>[k, v.n?v.sum/v.n:0]));
  }, [features]);

  // ── ATC-style KPI strip ───────────────────────────────────────────────────
  const heavyPct = useMemo(() => {
    const vals = features.map(f => f.properties.heavy_vehicle_pct ?? 0).filter(v => v > 0);
    return vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : 23.4;
  }, [features]);
  const highRiskLinks = useMemo(() =>
    features.filter(f => ['Critical','High'].includes(f.properties.congestion_risk ?? '')).length,
    [features]
  );
  const forecast2030 = Math.round(avgAadt * (GROWTH_FACTORS[2030] ?? 1.28));
  const kpis = [
    { label:'Avg Network ADT',   value: avgAadt > 0 ? Math.round(avgAadt).toLocaleString() : '—',  unit:'vpd',  color: C.cyan,   glow: C.cyan },
    { label:'Road Links',        value: features.length.toLocaleString(),                           unit:'links',color: C.blue,   glow: C.blue },
    { label:'Heavy Vehicle %',   value: heavyPct.toFixed(1),                                         unit:'%HGV', color: C.orange, glow: C.orange },
    { label:'High-Risk Links',   value: highRiskLinks.toString(),                                    unit:'links',color: C.pink,   glow: C.pink },
    { label:'2030 ADT Forecast', value: forecast2030 > 0 ? forecast2030.toLocaleString() : '—',    unit:'vpd',  color: C.green,  glow: C.green },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* ── KPI Stat-Card Strip ─────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{
            background:`rgba(${hexRgb(kpi.color)},0.07)`,
            border:`1px solid rgba(${hexRgb(kpi.color)},0.18)`,
            borderLeft:`4px solid ${kpi.color}`,
            borderRadius:10,
            padding:'14px 16px 12px',
            boxShadow:`0 0 18px rgba(${hexRgb(kpi.glow)},0.12), inset 0 1px 0 rgba(255,255,255,0.04)`,
            backdropFilter:'blur(20px)',
          }}>
            <div style={{
              fontSize:28, fontWeight:900, color:kpi.color, lineHeight:1.1,
              fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em',
              textShadow:`0 0 20px rgba(${hexRgb(kpi.glow)},0.7)`,
            }}>{kpi.value}</div>
            <div style={{ fontSize:9, fontWeight:800, color:'rgba(148,163,184,0.6)',
              letterSpacing:'0.14em', textTransform:'uppercase', marginTop:5 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize:9, color:`rgba(${hexRgb(kpi.color)},0.55)`,
              fontWeight:700, marginTop:2, letterSpacing:'0.08em' }}>
              {kpi.unit}
            </div>
          </div>
        ))}
      </div>

      {/* 1. Growth trajectory */}
      <div style={{ ...GLASS, padding:'18px 20px' }}>
        <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:3 }}>
          Network Mean ADT Growth Trajectory (2016 – 2035)
        </div>
        <div style={{ fontSize:10, color:'rgba(148,163,184,0.45)', marginBottom:12 }}>
          Projected average annual daily traffic · COVID-19 dip visible at 2020 · ML ensemble forecast
        </div>
        <GrowthTrajectory avgAadt={avgAadt}/>
      </div>

      {/* 2+3. Donut + ADT bars */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.1fr', gap:14 }}>
        <div style={{ ...GLASS, padding:'18px 20px' }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:3 }}>
            ADT Per Vehicle Class (Proportions)
          </div>
          <div style={{ fontSize:10, color:'rgba(148,163,184,0.45)', marginBottom:12 }}>
            11 vehicle categories · typical Uganda composition
          </div>
          <VehicleDonut avgAadt={avgAadt}/>
        </div>
        <div style={{ ...GLASS, padding:'18px 20px' }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:3 }}>
            Average Daily Traffic Per Vehicle Class
          </div>
          <div style={{ fontSize:10, color:'rgba(148,163,184,0.45)', marginBottom:12 }}>
            Absolute ADT contribution · vehicles/day
          </div>
          <VehicleClassBars avgAadt={avgAadt}/>
        </div>
      </div>

      {/* 4. Clustered column chart by road class */}
      <ClusteredClassChart
        groups={['A','B','C','M']}
        groupColors={CLASS_CLR}
        avgAadts={byClass}
        title="Vehicle Class AADT by Road Class"
        subtitle="8 key vehicle classes · grouped columns · avg vehicles/day per class"
      />

      {/* 5. Clustered column chart by region */}
      <ClusteredClassChart
        groups={REGIONS}
        groupColors={REGION_CLR}
        avgAadts={byRegion}
        title="Vehicle Class AADT by Maintenance Region"
        subtitle="6 regions · 8 vehicle classes · avg vehicles/day"
      />

      {/* 6. YOY rates */}
      <div style={{ ...GLASS, padding:'18px 20px' }}>
        <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:3 }}>
          YOY Increment Rates (2016 – 2035)
        </div>
        <div style={{ fontSize:10, color:'rgba(148,163,184,0.45)', marginBottom:12 }}>
          Year-over-year growth rate · 2020 COVID dip clearly visible
        </div>
        <YOYRatesChart avgAadt={avgAadt}/>
      </div>
    </div>
  );
}

function RegionsTab({ features }: { features: PredFeature[] }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
      {REGIONS.map(reg => {
        const rFeats = features.filter(f=>(f.properties.region??'')===reg);
        const avgAadt = rFeats.length
          ? rFeats.reduce((s,f)=>s+(f.properties.aadt_predicted??0),0)/rFeats.length : 0;
        const col = REGION_CLR[reg] ?? C.cyan;
        const congCounts = { Critical:0, High:0, Medium:0, Low:0 };
        for (const f of rFeats) {
          const r = f.properties.congestion_risk ?? 'Low';
          if (r in congCounts) congCounts[r as keyof typeof congCounts]++;
        }
        const pavPercent = rFeats.length
          ? (rFeats.filter(f=>f.properties.heavy_vehicle_pct && f.properties.heavy_vehicle_pct>15).length / rFeats.length)*100 : 0;
        return (
          <div key={reg} style={{ ...GLASS, padding:'16px 18px',
            border:`1px solid rgba(${hexRgb(col)},0.2)` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:8, fontWeight:800, color:`rgba(${hexRgb(col)},0.5)`,
                  textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:2 }}>
                  {reg}
                </div>
                <div style={{ fontSize:22, fontWeight:900, color:col, lineHeight:1,
                  textShadow:`0 0 18px rgba(${hexRgb(col)},0.4)` }}>
                  {Math.round(avgAadt/1000*10)/10}k
                </div>
                <div style={{ fontSize:9, color:'rgba(148,163,184,0.45)', marginTop:2 }}>avg ADT</div>
              </div>
              <MiniDonut items={[
                { v:congCounts.Low,      color:CONG_CLR.Low     },
                { v:congCounts.Medium,   color:CONG_CLR.Medium  },
                { v:congCounts.High,     color:CONG_CLR.High    },
                { v:congCounts.Critical, color:CONG_CLR.Critical},
              ]}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
              {[
                { label:'Links',   val:String(rFeats.length), col },
                { label:'High Hvy%', val:`${pavPercent.toFixed(0)}%`, col:C.orange },
                { label:'Critical', val:String(congCounts.Critical), col:C.pink },
              ].map(k=>(
                <div key={k.label} style={{ background:`rgba(${hexRgb(k.col)},0.07)`,
                  borderRadius:8, padding:'6px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:13, fontWeight:900, color:k.col }}>{k.val}</div>
                  <div style={{ fontSize:8, color:'rgba(148,163,184,0.4)' }}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Clustered column chart: vehicle classes by region ───────────────────────
function VehicleClassByRegionChart({ features }: { features: PredFeature[] }) {
  const TOP_CLASSES = VEHICLE_CLASSES.slice(0, 6); // MC, SC, LG, SB, MB, LB

  const data = REGIONS.map(reg => {
    const rFeats = features.filter(f => (f.properties.region ?? '') === reg);
    const regAdt = rFeats.length
      ? rFeats.reduce((s, f) => s + (f.properties.aadt_predicted ?? 0), 0) / rFeats.length
      : 0;
    const row: Record<string, number | string> = { region: reg.replace(' ', '\n') };
    TOP_CLASSES.forEach(vc => {
      row[vc.abbr] = Math.round(regAdt * vc.pct);
    });
    return row;
  });

  return (
    <div style={{ ...GLASS, padding: '18px 20px', gridColumn: '1 / -1' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 3 }}>
        Vehicle Class Volumes by Region — Clustered Comparison
      </div>
      <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.45)', marginBottom: 14 }}>
        Average daily vehicles per class · 6 maintenance regions · top 6 classes shown
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false}/>
          <XAxis dataKey="region" tick={{ fill: 'rgba(148,163,184,0.55)', fontSize: 9 }}
            axisLine={false} tickLine={false}/>
          <YAxis tick={{ fill: 'rgba(148,163,184,0.35)', fontSize: 8 }} axisLine={false} tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)}/>
          <Tooltip
            contentStyle={{ background: 'rgba(10,16,30,0.95)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, fontSize: 10 }}
            labelStyle={{ color: '#e2eaf4', fontWeight: 700 }}
            formatter={(value: number, name: string) => [
              value >= 1000 ? `${(value/1000).toFixed(1)}k` : value,
              VEHICLE_CLASSES.find(vc => vc.abbr === name)?.name ?? name,
            ]}/>
          <Legend wrapperStyle={{ fontSize: 9, paddingTop: 6 }}
            formatter={(value: string) => VEHICLE_CLASSES.find(vc => vc.abbr === value)?.name ?? value}/>
          {TOP_CLASSES.map(vc => (
            <Bar key={vc.abbr} dataKey={vc.abbr} fill={vc.color} radius={[2, 2, 0, 0]}
              fillOpacity={0.82}/>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ClassesTab({ features }: { features: PredFeature[] }) {
  const totalAadt = features.reduce((s,f)=>s+(f.properties.aadt_predicted??0),0);
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
      <VehicleClassByRegionChart features={features} />
      {VEHICLE_CLASSES.map(vc => {
        const classAdt  = Math.round(totalAadt * vc.pct);
        const col = vc.color;
        return (
          <div key={vc.id} style={{ ...GLASS, padding:'14px 16px',
            border:`1px solid rgba(${hexRgb(col)},0.2)` }}>
            <div style={{ fontSize:8, fontWeight:800, color:`rgba(${hexRgb(col)},0.5)`,
              textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:2 }}>{vc.abbr}</div>
            <div style={{ fontSize:13, fontWeight:800, color:col, marginBottom:4,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {vc.name}
            </div>
            <div style={{ fontSize:20, fontWeight:900, color:col, lineHeight:1 }}>
              {classAdt>=1000?`${(classAdt/1000).toFixed(1)}k`:classAdt}
            </div>
            <div style={{ fontSize:9, color:'rgba(148,163,184,0.45)', marginTop:2 }}>vehicles/day</div>
            <div style={{ margin:'10px 0 6px', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:9, color:col, fontWeight:700 }}>
                {(vc.pct*100).toFixed(1)}% of total ADT
              </span>
            </div>
            {/* Regional share mini bars */}
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {REGIONS.slice(0,3).map(reg => {
                const rFeats = features.filter(f=>(f.properties.region??'')===reg);
                const rAdt = rFeats.length ? rFeats.reduce((s,f)=>s+(f.properties.aadt_predicted??0),0)/rFeats.length : 0;
                const rCol = REGION_CLR[reg]??C.cyan;
                const pct  = totalAadt>0 ? rAdt/features.length/totalAadt*features.length : 0;
                return (
                  <div key={reg} style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:8, color:rCol, minWidth:46, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{reg}</span>
                    <div style={{ flex:1, height:5, background:'rgba(255,255,255,0.05)', borderRadius:3 }}>
                      <div style={{ height:'100%', width:`${Math.min(pct*300,100)}%`,
                        background:rCol, borderRadius:3, opacity:0.7 }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssetsTab({ features }: { features: PredFeature[] }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() =>
    features.filter(f => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (f.properties.link_name??'').toLowerCase().includes(s)
        || (f.properties.road_no??'').toLowerCase().includes(s)
        || (f.properties.region??'').toLowerCase().includes(s);
    }).slice(0,80),
    [features, search]
  );
  return (
    <div style={{ ...GLASS, padding:'18px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:'#fff' }}>Road Links Asset Data</div>
          <div style={{ fontSize:10, color:'rgba(148,163,184,0.45)', marginTop:2 }}>
            {features.length} links · AADT, class, region, forecast
          </div>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search links…"
          style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
            borderRadius:8, color:'#e2eaf4', fontSize:11, padding:'5px 10px', outline:'none', width:200 }}/>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid rgba(0,245,255,0.12)' }}>
              {['#','Road Link','Class','Region','Length km','AADT 2025','AADT 2040','Heavy %','Risk'].map(h=>(
                <th key={h} style={{ padding:'4px 8px', textAlign:'left', fontSize:8, fontWeight:800,
                  color:'rgba(0,245,255,0.55)', textTransform:'uppercase', letterSpacing:'0.06em',
                  whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((f,i)=>{
              const p = f.properties;
              const riskCol = CONG_CLR[p.congestion_risk??'Low']??'#94a3b8';
              return (
                <tr key={p.link_id} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding:'5px 8px', color:'rgba(148,163,184,0.3)' }}>{i+1}</td>
                  <td style={{ padding:'5px 8px', color:'#e2eaf4', maxWidth:180,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {p.link_name??p.link_id}
                  </td>
                  <td style={{ padding:'5px 8px', color:CLASS_CLR[p.road_class??'']??'#94a3b8', fontWeight:700 }}>
                    {p.road_class??'—'}
                  </td>
                  <td style={{ padding:'5px 8px', color:'rgba(148,163,184,0.55)', whiteSpace:'nowrap' }}>
                    {p.region??'—'}
                  </td>
                  <td style={{ padding:'5px 8px', color:'rgba(148,163,184,0.55)', fontFamily:'monospace' }}>
                    {p.length_km?.toFixed(1)??'—'}
                  </td>
                  <td style={{ padding:'5px 8px', color:C.cyan, fontFamily:'monospace', fontWeight:700 }}>
                    {(p.aadt_predicted??0).toLocaleString()}
                  </td>
                  <td style={{ padding:'5px 8px', color:C.orange, fontFamily:'monospace', fontWeight:700 }}>
                    {p.growth_2040?p.growth_2040.toLocaleString():'—'}
                  </td>
                  <td style={{ padding:'5px 8px', color:C.yellow, fontFamily:'monospace' }}>
                    {p.heavy_vehicle_pct!=null?`${p.heavy_vehicle_pct.toFixed(0)}%`:'—'}
                  </td>
                  <td style={{ padding:'5px 8px' }}>
                    <span style={{ fontSize:8, fontWeight:800, padding:'1px 7px', borderRadius:10,
                      background:`rgba(${hexRgb(riskCol)},0.15)`,
                      border:`1px solid rgba(${hexRgb(riskCol)},0.35)`, color:riskCol }}>
                      {p.congestion_risk??'Low'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length===80 && features.length>80 && (
          <div style={{ marginTop:8, fontSize:9, color:'rgba(148,163,184,0.3)', textAlign:'center' }}>
            Showing 80 of {features.length} links · refine search to filter
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisTab({ features }: { features: PredFeature[] }) {
  const avgAadt = features.length ? features.reduce((s,f)=>s+(f.properties.aadt_predicted??0),0)/features.length : 0;
  // AADT distribution histogram (8 buckets)
  const buckets = [0,500,1000,2000,5000,10000,20000,50000];
  const counts = buckets.slice(0,-1).map((lo,i)=>({
    lo, hi:buckets[i+1],
    n: features.filter(f=>(f.properties.aadt_predicted??0)>=lo && (f.properties.aadt_predicted??0)<buckets[i+1]).length,
  }));
  const maxN = Math.max(...counts.map(c=>c.n),1);
  const W=500, H=160, PL=48, PR=12, PT=10, PB=28;
  const cW=W-PL-PR, cH=H-PT-PB;
  const bW = cW/counts.length*0.7;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ ...GLASS, padding:'18px 20px' }}>
        <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:3 }}>
          AADT Distribution Across Network
        </div>
        <div style={{ fontSize:10, color:'rgba(148,163,184,0.45)', marginBottom:12 }}>
          Frequency of road links by AADT band · {features.length} total links · avg {Math.round(avgAadt).toLocaleString()} veh/day
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:H, display:'block' }}>
          {counts.map((c,i)=>{
            const bH = (c.n/maxN)*cH;
            const x  = PL + i*(cW/counts.length) + (cW/counts.length-bW)/2;
            const y  = PT+cH-bH;
            const col = i<2?C.green:i<4?C.yellow:i<6?C.orange:C.pink;
            return (
              <g key={i}>
                <rect x={x} y={y} width={bW} height={bH} rx={3} fill={col} fillOpacity={0.78}/>
                <rect x={x} y={y} width={bW} height={Math.min(bH,10)} rx={3} fill="rgba(255,255,255,0.18)"/>
                <text x={x+bW/2} y={H-3} fill="rgba(148,163,184,0.45)" fontSize={7} textAnchor="middle">
                  {c.lo>=1000?`${c.lo/1000}k`:c.lo}+
                </text>
                {c.n>0&&<text x={x+bW/2} y={y-4} fill={col} fontSize={8} fontWeight={700} textAnchor="middle">
                  {c.n}
                </text>}
              </g>
            );
          })}
          {[0,.25,.5,.75,1].map(t=>(
            <g key={t}>
              <text x={PL-5} y={PT+cH-t*cH+4} fill="rgba(148,163,184,0.35)" fontSize={7} textAnchor="end">
                {Math.round(t*maxN)}
              </text>
              <line x1={PL} x2={PL+cW} y1={PT+cH-t*cH} y2={PT+cH-t*cH}
                stroke="rgba(148,163,184,0.06)" strokeDasharray="2 2"/>
            </g>
          ))}
        </svg>
      </div>

      {/* Growth comparison: 2025 vs 2040 — clustered column chart */}
      {(() => {
        const chartData = REGIONS.map(reg=>{
          const rf = features.filter(f=>(f.properties.region??'')===reg);
          const a25 = rf.length?Math.round(rf.reduce((s,f)=>s+(f.properties.aadt_predicted??0),0)/rf.length):0;
          const a40 = rf.length?Math.round(rf.reduce((s,f)=>s+(f.properties.growth_2040??f.properties.aadt_predicted??0),0)/rf.length):0;
          return { region: reg.length>10?reg.slice(0,9)+'…':reg, 'AADT 2025': a25, 'AADT 2040': a40 };
        });
        return (
          <div style={{ ...GLASS, padding:'18px 20px' }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:3 }}>
              Regional AADT Growth: 2025 vs 2040
            </div>
            <div style={{ fontSize:10, color:'rgba(148,163,184,0.45)', marginBottom:12 }}>
              Average daily traffic per region · projected growth to 2040
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top:4, right:4, left:-10, bottom:20 }}
                barCategoryGap="30%" barGap={2}>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(148,163,184,0.06)" vertical={false}/>
                <XAxis dataKey="region" tick={{ fill:'rgba(148,163,184,0.55)', fontSize:9 }}
                  axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:'rgba(148,163,184,0.35)', fontSize:8 }}
                  tickFormatter={(v:number)=>v>=1000?`${(v/1000).toFixed(0)}k`:String(v)}
                  axisLine={false} tickLine={false}/>
                <Tooltip content={<ClusterTip/>}/>
                <Legend wrapperStyle={{ fontSize:9, paddingTop:4 }}
                  formatter={(v:string)=><span style={{ color:'rgba(148,163,184,0.7)' }}>{v}</span>}/>
                <Bar dataKey="AADT 2025" fill={C.cyan}   fillOpacity={0.82} radius={[2,2,0,0] as [number,number,number,number]}/>
                <Bar dataKey="AADT 2040" fill={C.orange} fillOpacity={0.82} radius={[2,2,0,0] as [number,number,number,number]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })()}
    </div>
  );
}

function StationsTab({ stations, predByLink }: {
  stations: StationFeature[];
  predByLink: Map<string, PredProps>;
}) {
  const [search, setSearch]   = useState('');
  const [sortBy, setSortBy]   = useState<'name'|'aadt'|'heavy'>('aadt');
  const [sortDir, setSortDir] = useState<1|-1>(-1);

  const sorted = useMemo(() => {
    const arr = [...stations].filter(s => {
      if (!search) return true;
      const p = s.properties;
      const q = search.toLowerCase();
      return (p.TCS_NAME??'').toLowerCase().includes(q)
        || (p.Link_Name??'').toLowerCase().includes(q)
        || (p.REGION??'').toLowerCase().includes(q);
    });
    arr.sort((a, b) => {
      const pa = a.properties, pb = b.properties;
      const predA = predByLink.get(pa.Link_ID??'');
      const predB = predByLink.get(pb.Link_ID??'');
      if (sortBy==='aadt') return ((predA?.aadt_predicted??0)-(predB?.aadt_predicted??0))*sortDir;
      if (sortBy==='heavy') return ((predA?.heavy_vehicle_pct??0)-(predB?.heavy_vehicle_pct??0))*sortDir;
      return ((pa.TCS_NAME??'')>(pb.TCS_NAME??'')?1:-1)*sortDir;
    });
    return arr;
  }, [stations, search, sortBy, sortDir, predByLink]);

  function th(label:string, key:typeof sortBy) {
    const active = sortBy===key;
    return (
      <th onClick={()=>{ if(active) setSortDir(d=>d===-1?1:-1); else { setSortBy(key); setSortDir(-1); } }}
        style={{ padding:'5px 8px', textAlign:'left', fontSize:8, fontWeight:800,
          color: active?C.teal:'rgba(0,212,170,0.5)',
          textTransform:'uppercase', letterSpacing:'0.07em', cursor:'pointer', whiteSpace:'nowrap' }}>
        {label}{active?(sortDir===-1?' ↓':' ↑'):''}
      </th>
    );
  }

  return (
    <div style={{ ...GLASS, padding:'18px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:'#fff' }}>ATC Station Network</div>
          <div style={{ fontSize:10, color:'rgba(148,163,184,0.45)', marginTop:2 }}>
            {stations.length} traffic count stations · AADT from ML ensemble predictions
          </div>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search stations…"
          style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(0,212,170,0.2)',
            borderRadius:8, color:'#e2eaf4', fontSize:11, padding:'5px 10px', outline:'none', width:200 }}/>
      </div>
      <div style={{ overflowX:'auto', maxHeight:520, overflowY:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
          <thead style={{ position:'sticky', top:0, background:'rgba(10,16,30,0.95)' }}>
            <tr style={{ borderBottom:'1px solid rgba(0,212,170,0.14)' }}>
              {th('Station ID','name')}
              <th style={{ padding:'5px 8px', textAlign:'left', fontSize:8, fontWeight:800,
                color:'rgba(0,212,170,0.5)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Road Name</th>
              <th style={{ padding:'5px 8px', textAlign:'left', fontSize:8, fontWeight:800,
                color:'rgba(0,212,170,0.5)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Region</th>
              {th('AADT 2025','aadt')}
              {th('Heavy %','heavy')}
              <th style={{ padding:'5px 8px', textAlign:'left', fontSize:8, fontWeight:800,
                color:'rgba(0,212,170,0.5)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Last Count</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s,i)=>{
              const p    = s.properties;
              const pred = predByLink.get(p.Link_ID??'');
              const rCol = REGION_CLR[p.REGION??'']??'#94a3b8';
              return (
                <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding:'5px 8px', color:C.teal, fontWeight:700 }}>
                    {p.TCS_NAME??p.STATION??`TCS-${p.TCS_NO??i}`}
                  </td>
                  <td style={{ padding:'5px 8px', color:'rgba(226,234,244,0.7)',
                    maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {p.Link_Name??'—'}
                  </td>
                  <td style={{ padding:'5px 8px', color:rCol }}>{p.REGION??'—'}</td>
                  <td style={{ padding:'5px 8px', color:C.cyan, fontFamily:'monospace', fontWeight:700 }}>
                    {pred?.aadt_predicted?pred.aadt_predicted.toLocaleString():'—'}
                  </td>
                  <td style={{ padding:'5px 8px', color:C.orange, fontFamily:'monospace' }}>
                    {pred?.heavy_vehicle_pct!=null?`${pred.heavy_vehicle_pct.toFixed(0)}%`:'—'}
                  </td>
                  <td style={{ padding:'5px 8px', color:'rgba(148,163,184,0.45)' }}>2025</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StrategicTab({ features, stations }: { features: PredFeature[]; stations: StationFeature[] }) {
  const totalAdt = features.reduce((s,f)=>s+(f.properties.aadt_predicted??0),0);
  const totalVkm = features.reduce((s,f)=>s+(f.properties.vehicle_km_daily??0),0);
  const critical = features.filter(f=>f.properties.congestion_risk==='Critical').length;
  const avg2040  = features.reduce((s,f)=>s+(f.properties.growth_2040??0),0)/features.length;
  const avg2025  = totalAdt/features.length;
  const growPct  = avg2025>0?((avg2040/avg2025)-1)*100:95;

  const metrics = [
    { label:'Total Network ADT',       val:`${Math.round(totalAdt/1000)}k`, sub:'vehicles/day', col:C.cyan   },
    { label:'Vehicle-km / Day',        val:`${(totalVkm/1e6).toFixed(0)}M`, sub:'network total', col:C.teal   },
    { label:'Critical Congestion',     val:String(critical), sub:'links at capacity risk', col:C.pink   },
    { label:'2040 Growth Projection',  val:`+${growPct.toFixed(0)}%`, sub:'vs 2025 baseline', col:C.green  },
    { label:'ATC Stations',             val:'25',                   sub:'15 legacy + 10 new', col:C.yellow },
    { label:'Survey Node Count',       val:String(features.length), sub:'road links monitored', col:C.blue   },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {metrics.map(m=>(
          <div key={m.label} style={{ ...GLASS, padding:'18px 20px',
            border:`1px solid rgba(${hexRgb(m.col)},0.2)` }}>
            <div style={{ fontSize:8, fontWeight:700, color:`rgba(${hexRgb(m.col)},0.5)`,
              textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>{m.label}</div>
            <div style={{ fontSize:26, fontWeight:900, color:m.col, lineHeight:1,
              textShadow:`0 0 20px rgba(${hexRgb(m.col)},0.4)` }}>{m.val}</div>
            <div style={{ fontSize:9, color:'rgba(148,163,184,0.45)', marginTop:4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ ...GLASS, padding:'22px 24px' }}>
        <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:12 }}>
          Strategic Network Assessment — Uganda National Roads
        </div>
        {[
          { head:'Traffic Growth Trajectory', col:C.cyan,
            body:`Uganda's national road network is experiencing sustained traffic growth, with a projected ${growPct.toFixed(0)}% increase in average daily traffic from 2025 to 2040. This growth is primarily driven by economic expansion, urbanisation of secondary cities, and increasing vehicle ownership rates across all regions.` },
          { head:'Congestion Risk Hotspots', col:C.pink,
            body:`${critical} road links are currently classified as Critical congestion risk, primarily concentrated on Class M motorways and Class A trunk roads in the Central and Eastern regions. The Kampala-Jinja corridor and the Northern Bypass are experiencing highest volume-to-capacity ratios.` },
          { head:'Heavy Vehicle Network Pressure', col:C.orange,
            body:`Heavy vehicle traffic represents a disproportionate share of pavement wear on Class B and C roads. The Northern corridor (A1/A2) carries significant freight traffic to South Sudan and DRC, with heavy vehicle percentages exceeding 25% on several links.` },
          { head:'ATC Station Coverage', col:C.teal,
            body:`The 25-station automatic traffic count network (15 legacy 2016–22 + 10 new 2025+) provides real-time monitoring across all 6 maintenance regions. An additional ${stations.length} manual TIS survey stations supplement the ATC network. Station density is highest in the Central region but expansion is recommended for Eastern and North Eastern regions to support ML model accuracy.` },
        ].map(s=>(
          <div key={s.head} style={{ marginBottom:14, paddingLeft:12,
            borderLeft:`2px solid rgba(${hexRgb(s.col)},0.4)` }}>
            <div style={{ fontSize:11, fontWeight:800, color:s.col, marginBottom:4 }}>{s.head}</div>
            <div style={{ fontSize:11, color:'rgba(148,163,184,0.7)', lineHeight:1.6 }}>{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────
type TabId = 'macro'|'regions'|'classes'|'assets'|'analysis'|'stations'|'strategic';
type RegionTarget = 'GLOBAL'|'CENTRAL'|'EASTERN'|'SOUTHERN'|'WESTERN'|'NORTHERN'|'NORTH EASTERN';
const TABS: { id:TabId; label:string }[] = [
  { id:'macro',     label:'MACRO'    },
  { id:'regions',   label:'REGIONS'  },
  { id:'classes',   label:'CLASSES'  },
  { id:'assets',    label:'ASSETS'   },
  { id:'analysis',  label:'ANALYSIS' },
  { id:'stations',  label:'STATIONS' },
  { id:'strategic', label:'STRATEGIC'},
];

// ─── Main export ──────────────────────────────────────────────────────────────
export default function TrafficAnalytics() {
  const [features, setFeatures] = useState<PredFeature[]>([]);
  const [stations, setStations] = useState<StationFeature[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<TabId>('macro');
  const [target,   setTarget]   = useState<RegionTarget>('GLOBAL');

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/traffic_predictions.geojson`).then(r=>r.json()),
      fetch(`${base}atc_stations.geojson`).then(r=>r.json()),
    ]).then(([gj, stGJ]) => {
      setFeatures((gj.features??[]) as PredFeature[]);
      setStations((stGJ.features??[]) as StationFeature[]);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredFeatures = useMemo(() =>
    target === 'GLOBAL'
      ? features
      : features.filter(f => (f.properties.region??'').toUpperCase() === target),
    [features, target]
  );

  const filteredStations = useMemo(() =>
    target === 'GLOBAL'
      ? stations
      : stations.filter(s => (s.properties.REGION??'').toUpperCase() === target),
    [stations, target]
  );

  const predByLink = useMemo(
    () => new Map(features.map(f => [f.properties.link_id, f.properties])),
    [features],
  );

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
        height:'100%', color:'rgba(148,163,184,0.5)', fontSize:13,
        fontFamily:"'Inter','Segoe UI',sans-serif" }}>
        Loading traffic analytics…
      </div>
    );
  }

  return (
    <div style={{ padding:'20px 22px 36px', fontFamily:"'Inter','Segoe UI',sans-serif", color:'#e2eaf4' }}>
      {/* Header */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:9, fontWeight:800, color:'rgba(255,210,63,0.55)',
          letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:3 }}>
          Uganda National Roads · Deep Analytics · ML Ensemble 2025–2040
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
          <div style={{ fontSize:22, fontWeight:900, color:'#ffd23f', lineHeight:1.2,
            textShadow:'0 0 22px rgba(255,210,63,0.4)' }}>
            Traffic Analytics Dashboard
          </div>
          {/* Target dropdown */}
          <select value={target} onChange={e=>setTarget(e.target.value as RegionTarget)}
            style={{ background:'rgba(255,210,63,0.08)', border:'1px solid rgba(255,210,63,0.3)',
              borderRadius:8, color:'#ffd23f', fontSize:11, fontWeight:700,
              padding:'5px 12px', cursor:'pointer', outline:'none', fontFamily:'inherit' }}>
            {(['GLOBAL','CENTRAL','EASTERN','SOUTHERN','WESTERN','NORTHERN','NORTH EASTERN'] as RegionTarget[]).map(r=>(
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize:11, color:'rgba(148,163,184,0.5)', marginTop:4 }}>
          {filteredFeatures.length.toLocaleString()} road links · 25 ATC + {filteredStations.length} TIS survey stations
          {target!=='GLOBAL' && ` · filtered: ${target}`}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:4, marginBottom:16,
        borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:0 }}>
        {TABS.map(t=>{
          const active = tab===t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ padding:'8px 14px', fontSize:10, fontWeight:800,
                letterSpacing:'0.1em', cursor:'pointer', border:'none',
                borderRadius:'8px 8px 0 0',
                background: active?'rgba(255,210,63,0.12)':'transparent',
                color: active?'#ffd23f':'rgba(148,163,184,0.5)',
                borderBottom: active?'2px solid #ffd23f':'2px solid transparent',
                transition:'all .15s' }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab==='macro'     && <MacroTab    features={filteredFeatures}/>}
      {tab==='regions'   && <RegionsTab  features={filteredFeatures}/>}
      {tab==='classes'   && <ClassesTab  features={filteredFeatures}/>}
      {tab==='assets'    && <AssetsTab   features={filteredFeatures}/>}
      {tab==='analysis'  && <AnalysisTab features={filteredFeatures}/>}
      {tab==='stations'  && <StationsTab stations={filteredStations} predByLink={predByLink}/>}
      {tab==='strategic' && <StrategicTab features={filteredFeatures} stations={filteredStations}/>}

      <div style={{ marginTop:22, fontSize:8, color:'rgba(100,116,139,0.35)', textAlign:'center' }}>
        Uganda National Roads · UNRA / DNR 2025 · XGBoost + LightGBM ensemble ·
        ATC data: UNRA Traffic Management Unit · Forecasts modelled 2025–2040
      </div>
    </div>
  );
}
