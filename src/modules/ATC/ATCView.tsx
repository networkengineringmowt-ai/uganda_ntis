/**
 * ATCView – Automatic Traffic Counter Live Dashboard
 * Uganda National Roads Management Platform · DNR
 *
 * Reads 4 pre-processed JSON files from /public:
 *   atc_sites.json  atc_flow.json  atc_speed.json  atc_class.json
 */

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend, LineChart, Line, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import {
  NEON, TICK, TICK_SM, AX_LINE, TT_NEON,
  Bar3D, GlowDefs, Chart3DWrap, AreaGradDefs, hexRgb,
} from '../../lib/chart3d';
import { Activity, Gauge, MapPin, Truck, Zap, TrendingUp, Wind, BarChart3 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Site   { id: string; road: string; lat: number; lng: number; }
interface AadtRow { id: string; aadt: number; light_pct: number; heavy_pct: number; days: number; }
interface HourlyRow { id: string; profile: number[]; }
interface MonthlyRow { id: string; month: string; total: number; light: number; heavy: number; }
interface SpeedRow  { id: string; avg_speed: number; p85_speed: number; }
interface ClassRow  { id: string; classes: { cls: number; label: string; count: number }[]; }

interface FlowData {
  aadt:    AadtRow[];
  hourly:  HourlyRow[];
  monthly: MonthlyRow[];
}

// ─── Neon palette ─────────────────────────────────────────────────────────────
const C = {
  cyan:   '#00f5ff',
  green:  '#00ff88',
  orange: '#ff6b35',
  purple: '#b967ff',
  yellow: '#ffd23f',
  pink:   '#ff2d78',
  blue:   '#4d9fff',
  teal:   '#00d4aa',
};
const SITE_COLORS = [C.cyan, C.green, C.orange, C.purple, C.yellow, C.pink, C.blue, C.teal, '#e8ff30', '#ff9d5c'];

// ─── Style helpers ────────────────────────────────────────────────────────────
const glass = (accent = C.cyan): React.CSSProperties => ({
  background:  `rgba(2,5,8,0.82)`,
  border:      `1px solid rgba(${hexRgb(accent)},0.18)`,
  borderRadius: 14,
  backdropFilter: 'blur(18px)',
});

const sectionHead = (label: string, icon: React.ReactNode, color: string) => (
  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
    <span style={{ color, filter: `drop-shadow(0 0 6px ${color})` }}>{icon}</span>
    <span style={{ fontSize:13, fontWeight:800, color, letterSpacing:'0.04em',
      textShadow:`0 0 14px rgba(${hexRgb(color)},0.5)` }}>
      {label}
    </span>
    <div style={{ flex:1, height:1, background:`linear-gradient(90deg, rgba(${hexRgb(color)},0.4), transparent)` }}/>
  </div>
);

// ─── Custom Pie Label ─────────────────────────────────────────────────────────
function PieLabel({ cx, cy, midAngle, outerRadius, percent, name }:any) {
  if (percent < 0.04) return null;
  const R = Math.PI/180;
  const x = cx + (outerRadius+22) * Math.cos(-midAngle * R);
  const y = cy + (outerRadius+22) * Math.sin(-midAngle * R);
  return (
    <text x={x} y={y} fill="#e2eaf4" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central"
      fontSize={9} fontWeight={700}>
      {name} ({(percent*100).toFixed(0)}%)
    </text>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, unit, sub, color, icon }: {
  label: string; value: string; unit: string; sub: string; color: string; icon: React.ReactNode;
}) {
  const rgb = hexRgb(color);
  return (
    <div style={{
      ...glass(color),
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 6,
      boxShadow: `0 0 24px rgba(${rgb},0.08), inset 0 1px 0 rgba(${rgb},0.12)`,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ color, opacity:0.85, filter:`drop-shadow(0 0 5px ${color})` }}>{icon}</span>
        <span style={{ fontSize:10, fontWeight:700, color:'rgba(148,163,184,0.7)', textTransform:'uppercase', letterSpacing:'0.1em' }}>
          {label}
        </span>
      </div>
      <div style={{ display:'flex', alignItems:'baseline', gap:5 }}>
        <span style={{ fontSize:28, fontWeight:900, color, lineHeight:1,
          textShadow:`0 0 20px rgba(${rgb},0.6)` }}>{value}</span>
        <span style={{ fontSize:12, fontWeight:700, color:`rgba(${rgb},0.7)` }}>{unit}</span>
      </div>
      <div style={{ fontSize:10, color:'rgba(148,163,184,0.55)' }}>{sub}</div>
    </div>
  );
}

// ─── Region colour map ────────────────────────────────────────────────────────
const REGION_CLR: Record<string,string> = {
  Central:'#00f5ff', Eastern:'#ff6b35', East:'#ff6b35',
  Northern:'#b967ff', North:'#b967ff', 'North East':'#ff2d78',
  Western:'#00ff88', West:'#00ff88', South:'#ffd23f',
};

// ─── Station Map Panel ────────────────────────────────────────────────────────
function StationMapPanel({ allStations }: { allStations: any[] }) {
  const regions = [...new Set(allStations.map(f => f.properties?.REGION||'').filter(Boolean))].sort();
  const [filter, setFilter] = useState<string>('ALL');

  const visible = filter === 'ALL' ? allStations
    : allStations.filter(f => f.properties?.REGION === filter);

  return (
    <div style={{ ...glass(C.green), padding:14 }}>
      {sectionHead(`Traffic Count Station Network · ${allStations.length} Stations`, <MapPin size={15}/>, C.green)}
      <div style={{ fontSize:10, color:'rgba(148,163,184,0.55)', marginBottom:8 }}>
        National road network · Hover/click marker for details · Coloured by region
      </div>

      {/* Region filter pills */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
        {['ALL',...regions].map(r => {
          const col = r === 'ALL' ? '#94a3b8' : (REGION_CLR[r]||'#94a3b8');
          return (
            <button key={r} onClick={()=>setFilter(r)} style={{
              fontSize:9, fontWeight:800, padding:'3px 10px', borderRadius:5, cursor:'pointer',
              background: filter===r ? `rgba(${hexRgb(col)},0.18)` : 'rgba(255,255,255,0.04)',
              border:`1px solid ${filter===r ? col : 'rgba(255,255,255,0.08)'}`,
              color: filter===r ? col : 'rgba(148,163,184,0.5)', transition:'all 0.12s',
            }}>{r === 'ALL' ? `All (${allStations.length})` : r}</button>
          );
        })}
      </div>

      <div style={{ borderRadius:10, overflow:'hidden', height:520,
        boxShadow:'0 0 24px rgba(0,255,136,0.12)' }}>
        {allStations.length > 0 && (
          <MapContainer center={[1.37,32.3]} zoom={6} zoomControl={false}
            style={{ height:'100%', width:'100%', background:'#020508' }}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; CartoDB" />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade_Dark/MapServer/tile/{z}/{y}/{x}"
              opacity={0.18} />
            <ZoomControl position="bottomright"/>
            {visible.map((f, i) => {
              const [lng, lat] = f.geometry?.coordinates || [0,0];
              const props = f.properties || {};
              const col = REGION_CLR[props.REGION||''] || '#94a3b8';
              return (
                <CircleMarker key={i} center={[lat, lng]} radius={4}
                  pathOptions={{ color:col, fillColor:col, fillOpacity:0.78, weight:0.8 }}>
                  <LeafletTooltip>
                    <div style={{
                      background:'rgba(2,5,8,0.96)', color:col,
                      border:`1px solid ${col}55`, borderRadius:6,
                      padding:'5px 9px', fontSize:9, fontWeight:800, maxWidth:220,
                    }}>
                      <div style={{ marginBottom:2 }}>{props.TCS_NAME}</div>
                      <div style={{ color:'rgba(226,234,244,0.85)', fontWeight:400 }}>
                        {props.Link_Name}
                      </div>
                      <div style={{ color:'rgba(148,163,184,0.55)', marginTop:1 }}>
                        {props.STATION} · {props.REGION}
                      </div>
                    </div>
                  </LeafletTooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}
      </div>

      <div style={{ marginTop:10, fontSize:10, color:'rgba(148,163,184,0.45)', textAlign:'center' }}>
        {visible.length} stations shown · Uganda National Road Network · Source: UNRA/DNR Traffic Survey Programme
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ATCView() {
  const [sites,   setSites]   = useState<Site[]>([]);
  const [flow,    setFlow]    = useState<FlowData|null>(null);
  const [speed,   setSpeed]   = useState<SpeedRow[]>([]);
  const [cls,     setCls]     = useState<ClassRow[]>([]);
  const [selSite,    setSelSite]    = useState<string>('STA-A00107');
  const [activeTab,  setActiveTab]  = useState<'dashboard'|'stationmap'>('dashboard');
  const [allStations,setAllStations]= useState<any[]>([]);
  const [now,        setNow]        = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Load all JSON
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}atc_sites.json`).then(r=>r.json()).then(setSites);
    fetch(`${import.meta.env.BASE_URL}atc_flow.json`).then(r=>r.json()).then(setFlow);
    fetch(`${import.meta.env.BASE_URL}atc_speed.json`).then(r=>r.json()).then(setSpeed);
    fetch(`${import.meta.env.BASE_URL}atc_class.json`).then(r=>r.json()).then(setCls);
    fetch(`${import.meta.env.BASE_URL}atc_stations.geojson`).then(r=>r.json())
      .then(d => setAllStations(d.features || []));
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────
  const aadtRows   = flow?.aadt    ?? [];
  const hourlyRows = flow?.hourly  ?? [];
  const monthly    = flow?.monthly ?? [];

  const selAadt   = aadtRows.find(r=>r.id===selSite);
  const selHourly = hourlyRows.find(r=>r.id===selSite);
  const selSpeed  = speed.find(r=>r.id===selSite);
  const selCls    = cls.find(r=>r.id===selSite);
  const selSiteInfo = sites.find(s=>s.id===selSite);

  const networkAadt = useMemo(()=> aadtRows.reduce((a,r)=>a+r.aadt, 0), [aadtRows]);
  const avgSpeed    = useMemo(()=> speed.length ? speed.reduce((a,r)=>a+r.avg_speed,0)/speed.length : 0, [speed]);
  const heavyPct    = useMemo(()=> aadtRows.length ? aadtRows.reduce((a,r)=>a+r.heavy_pct,0)/aadtRows.length : 0, [aadtRows]);

  // Hourly profile chart data
  const hourlyChartData = useMemo(()=> (selHourly?.profile ?? Array(24).fill(0)).map((v,h)=>({
    hour: `${h.toString().padStart(2,'0')}:00`, flow: v,
  })), [selHourly]);

  // Monthly trend – selected site
  const monthlyChartData = useMemo(()=>
    monthly.filter(r=>r.id===selSite)
      .map(r=>({ month: r.month.slice(5), total: r.total, light: r.light, heavy: r.heavy }))
  , [monthly, selSite]);

  // AADT ranking (all sites)
  const aadtRanking = useMemo(()=>
    [...aadtRows].sort((a,b)=>b.aadt-a.aadt).map((r,i)=>({
      id: r.id,
      aadt: r.aadt,
      road: sites.find(s=>s.id===r.id)?.road ?? r.id,
      color: SITE_COLORS[i % SITE_COLORS.length],
    }))
  , [aadtRows, sites]);

  // Speed comparison across sites
  const speedChartData = useMemo(()=>
    speed.map((r,i)=>({
      id:  r.id,
      avg: r.avg_speed,
      p85: r.p85_speed,
      color: SITE_COLORS[i % SITE_COLORS.length],
    }))
  , [speed]);

  // Vehicle class pie for selected site (top 8)
  const clsPieData = useMemo(()=>{
    const classes = selCls?.classes ?? [];
    const sorted = [...classes].sort((a,b)=>b.count-a.count).slice(0,8);
    return sorted.map((c,i)=>({ name: c.label, value: c.count, color: NEON[i%NEON.length] }));
  }, [selCls]);

  // Radar – vehicle mix profile all sites
  const radarData = useMemo(()=>{
    // Compare motorcycles vs light vs heavy across sites
    return aadtRows.map((r,i)=>({
      site: r.id,
      light: r.light_pct,
      heavy: r.heavy_pct,
      color: SITE_COLORS[i % SITE_COLORS.length],
    }));
  }, [aadtRows]);

  // ── Pulse animation keyframes ──────────────────────────────────────────────
  const pulseStyle = `
    @keyframes atcPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
    @keyframes atcScan  { 0%{opacity:0.4;transform:translateX(-100%)} 100%{opacity:0.8;transform:translateX(400%)} }
    @keyframes atcFade  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  `;

  return (
    <div style={{
      minHeight:'100%', background:'transparent',
      padding:'20px', display:'flex', flexDirection:'column', gap:18,
      fontFamily:`'Inter','Segoe UI',sans-serif`,
    }}>
      <style>{pulseStyle}</style>

      {/* ── TAB BAR ──────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        {(['dashboard','stationmap'] as const).map(tab => {
          const label = tab === 'dashboard' ? 'Live Dashboard' : `Station Map (${allStations.length||298} sites)`;
          return (
            <button key={tab} onClick={()=>setActiveTab(tab)} style={{
              fontSize:11, fontWeight:800, padding:'6px 16px', borderRadius:8, cursor:'pointer',
              background: activeTab===tab ? `rgba(0,245,255,0.15)` : 'rgba(255,255,255,0.04)',
              border:`1px solid ${activeTab===tab ? C.cyan : 'rgba(255,255,255,0.1)'}`,
              color: activeTab===tab ? C.cyan : 'rgba(148,163,184,0.6)', transition:'all 0.15s',
              letterSpacing:'0.05em',
            }}>{label}</button>
          );
        })}
      </div>

      {activeTab === 'dashboard' && (<>
      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:800, color:'rgba(0,245,255,0.4)', letterSpacing:'0.18em', textTransform:'uppercase' }}>
            AUTOMATIC TRAFFIC COUNTER NETWORK
          </div>
          <div style={{ fontSize:20, fontWeight:900, color:C.cyan,
            textShadow:`0 0 20px rgba(0,245,255,0.5)`, letterSpacing:'0.02em' }}>
            Live Traffic Monitoring Dashboard
          </div>
          <div style={{ fontSize:11, color:'rgba(148,163,184,0.6)', marginTop:3 }}>
            {sites.length} Permanent Mother Stations · National Road Network · Uganda
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ ...glass(C.green), padding:'8px 16px', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:C.green,
              boxShadow:`0 0 8px ${C.green}`, display:'inline-block',
              animation:'atcPulse 2s ease-in-out infinite' }}/>
            <span style={{ fontSize:10, fontWeight:800, color:C.green }}>LIVE DATA</span>
          </div>
          <div style={{ fontSize:10, color:'rgba(148,163,184,0.5)', textAlign:'right' }}>
            <div style={{ fontWeight:700, color:'rgba(148,163,184,0.8)' }}>
              {now.toLocaleDateString('en-UG',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
            </div>
            <div>{now.toLocaleTimeString('en-UG',{hour:'2-digit',minute:'2-digit'})}</div>
          </div>
        </div>
      </div>

      {/* ── KPI STRIP ────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        <KpiCard label="Network AADT (total)"
          value={networkAadt > 0 ? (networkAadt/1000).toFixed(0)+'k' : '—'}
          unit="veh/day" sub={`Across ${aadtRows.length} ATC stations`}
          color={C.cyan} icon={<Activity size={16}/>}/>
        <KpiCard label="Avg Operating Speed"
          value={avgSpeed > 0 ? avgSpeed.toFixed(1) : '—'}
          unit="km/h" sub="Mean of Dir 1 · All stations"
          color={C.green} icon={<Gauge size={16}/>}/>
        <KpiCard label="Heavy Vehicle Share"
          value={heavyPct > 0 ? heavyPct.toFixed(1) : '—'}
          unit="%" sub="Buses + trucks + semis"
          color={C.orange} icon={<Truck size={16}/>}/>
        <KpiCard label="Stations Online"
          value={String(sites.length)} unit="active"
          sub="Permanent mother stations"
          color={C.purple} icon={<Zap size={16}/>}/>
      </div>

      {/* ── ROW 2: MAP + AADT RANKING ───────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

        {/* Site Map */}
        <div style={{ ...glass(C.green), padding:14, minHeight:360 }}>
          {sectionHead('ATC Station Network Map', <MapPin size={15}/>, C.green)}
          <div style={{ borderRadius:10, overflow:'hidden', height:300,
            boxShadow:`0 0 24px rgba(0,255,136,0.12)` }}>
            <MapContainer
              center={[1.37, 32.3]}
              zoom={6}
              zoomControl={false}
              style={{ height:'100%', width:'100%', background:'#020508' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; CartoDB'
              />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade_Dark/MapServer/tile/{z}/{y}/{x}"
                opacity={0.22}
              />
              <ZoomControl position="bottomright"/>
              {sites.map((s,i)=>{
                const aRow = aadtRows.find(r=>r.id===s.id);
                const isActive = s.id === selSite;
                const col = SITE_COLORS[i % SITE_COLORS.length];
                const r = aRow ? Math.max(8, Math.min(22, aRow.aadt/600)) : 10;
                return (
                  <CircleMarker
                    key={s.id}
                    center={[s.lat, s.lng]}
                    radius={isActive ? r+4 : r}
                    pathOptions={{
                      color: isActive ? '#fff' : col,
                      fillColor: col,
                      fillOpacity: isActive ? 0.95 : 0.7,
                      weight: isActive ? 2.5 : 1,
                    }}
                    eventHandlers={{ click: ()=>setSelSite(s.id) }}
                  >
                    <LeafletTooltip permanent={isActive}>
                      <div style={{ background:'rgba(2,5,8,0.95)', color:col,
                        border:`1px solid ${col}44`, borderRadius:6,
                        padding:'3px 7px', fontSize:9, fontWeight:800 }}>
                        {s.id} · {s.road.split(' - ').join('→')}
                        {aRow && <><br/><span style={{color:'#fff'}}>{aRow.aadt.toLocaleString()} veh/day</span></>}
                      </div>
                    </LeafletTooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
          <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
            {sites.map((s,i)=>(
              <button key={s.id} onClick={()=>setSelSite(s.id)}
                style={{
                  fontSize:9, fontWeight:800, padding:'3px 9px', borderRadius:6, cursor:'pointer',
                  background: selSite===s.id ? `rgba(${hexRgb(SITE_COLORS[i%SITE_COLORS.length])},0.25)` : 'rgba(255,255,255,0.05)',
                  border:`1px solid ${selSite===s.id ? SITE_COLORS[i%SITE_COLORS.length] : 'rgba(255,255,255,0.1)'}`,
                  color: selSite===s.id ? SITE_COLORS[i%SITE_COLORS.length] : 'rgba(148,163,184,0.7)',
                  transition:'all 0.15s',
                }}>
                {s.id}
              </button>
            ))}
          </div>
        </div>

        {/* AADT Ranking */}
        <div style={{ ...glass(C.cyan), padding:14 }}>
          {sectionHead('AADT Ranking · All Stations', <TrendingUp size={15}/>, C.cyan)}
          {selSiteInfo && (
            <div style={{ marginBottom:10, padding:'8px 12px', borderRadius:8,
              background:`rgba(${hexRgb(C.cyan)},0.07)`,
              border:`1px solid rgba(${hexRgb(C.cyan)},0.15)` }}>
              <div style={{ fontSize:10, fontWeight:800, color:C.cyan }}>{selSite} · {selSiteInfo.road}</div>
              <div style={{ fontSize:9, color:'rgba(148,163,184,0.6)', marginTop:2 }}>
                {selAadt && <>AADT: <b style={{color:'#fff'}}>{selAadt.aadt.toLocaleString()}</b> veh/day ·{' '}
                Light: <b style={{color:C.green}}>{selAadt.light_pct}%</b> ·{' '}
                Heavy: <b style={{color:C.orange}}>{selAadt.heavy_pct}%</b> ·{' '}
                {selAadt.days} days of data</>}
              </div>
            </div>
          )}
          <Chart3DWrap tilt={1.2}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={aadtRanking} layout="vertical" margin={{left:8,right:20,top:4,bottom:4}}>
                <defs><GlowDefs id="aadtrank"/></defs>
                <CartesianGrid horizontal={false} stroke="rgba(148,163,184,0.06)"/>
                <XAxis type="number" tick={TICK_SM} tickLine={false} axisLine={AX_LINE}
                  tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                <YAxis type="category" dataKey="id" tick={TICK_SM} tickLine={false} axisLine={false} width={50}/>
                <Tooltip {...TT_NEON} formatter={(v:any)=>[`${Number(v).toLocaleString()} veh/day`,'AADT']}/>
                <Bar dataKey="aadt" shape={<Bar3D/>} radius={[0,4,4,0]}>
                  {aadtRanking.map((r,i)=>(
                    <Cell key={r.id} fill={r.color}
                      style={{ cursor:'pointer', opacity: selSite===r.id ? 1 : 0.65 }}
                      onClick={()=>setSelSite(r.id)}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>
      </div>

      {/* ── ROW 3: HOURLY PROFILE + VEHICLE CLASS PIE ──────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:14 }}>

        {/* Hourly flow profile */}
        <div style={{ ...glass(C.yellow), padding:14 }}>
          {sectionHead(`Hourly Flow Profile · ${selSite}`, <BarChart3 size={15}/>, C.yellow)}
          <div style={{ fontSize:10, color:'rgba(148,163,184,0.55)', marginBottom:8 }}>
            Average vehicles per hour · {selSiteInfo?.road}
          </div>
          <Chart3DWrap tilt={1.8}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyChartData} margin={{left:0,right:8,top:8,bottom:0}}>
                <defs><GlowDefs id="hourly"/>
                  <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.yellow} stopOpacity={0.9}/>
                    <stop offset="100%" stopColor={C.orange}  stopOpacity={0.5}/>
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.07)"/>
                <XAxis dataKey="hour" tick={{...TICK_SM, fontSize:8}} tickLine={false} axisLine={AX_LINE}
                  interval={2}/>
                <YAxis tick={TICK_SM} tickLine={false} axisLine={AX_LINE}
                  tickFormatter={v=>v>=1000?`${(v/1000).toFixed(1)}k`:String(v)}/>
                <Tooltip {...TT_NEON} formatter={(v:any)=>[`${Number(v).toLocaleString()} veh`,'Avg Flow']}/>
                <Bar dataKey="flow" fill="url(#hourGrad)" shape={<Bar3D/>} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>

        {/* Vehicle class pie */}
        <div style={{ ...glass(C.purple), padding:14 }}>
          {sectionHead(`Vehicle Mix · ${selSite}`, <Truck size={15}/>, C.purple)}
          <div style={{ fontSize:10, color:'rgba(148,163,184,0.55)', marginBottom:4 }}>
            Class composition · All directions combined
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <defs>
                {NEON.map((c,i)=>(
                  <radialGradient key={i} id={`clsGrad${i}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor={c} stopOpacity={0.9}/>
                    <stop offset="100%" stopColor={c} stopOpacity={0.3}/>
                  </radialGradient>
                ))}
              </defs>
              <Pie
                data={clsPieData}
                cx="50%" cy="50%"
                outerRadius={85}
                innerRadius={38}
                paddingAngle={3}
                dataKey="value"
                labelLine={false}
                label={PieLabel}
                strokeWidth={0}
              >
                {clsPieData.map((_,i)=>(
                  <Cell key={i} fill={`url(#clsGrad${i})`}
                    style={{ filter:`drop-shadow(0 0 5px ${NEON[i%NEON.length]}44)` }}/>
                ))}
              </Pie>
              <Tooltip {...TT_NEON} formatter={(v:any, n:any)=>[Number(v).toLocaleString(), n]}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── ROW 4: MONTHLY TREND + SPEED ──────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

        {/* Monthly volume trend */}
        <div style={{ ...glass(C.blue), padding:14 }}>
          {sectionHead(`Monthly Volume Trend · ${selSite}`, <TrendingUp size={15}/>, C.blue)}
          <Chart3DWrap tilt={1.2}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyChartData} margin={{left:0,right:8,top:8,bottom:0}}>
                <AreaGradDefs id="mLight" color={C.blue}/>
                <AreaGradDefs id="mHeavy" color={C.orange}/>
                <CartesianGrid stroke="rgba(148,163,184,0.07)"/>
                <XAxis dataKey="month" tick={TICK_SM} tickLine={false} axisLine={AX_LINE}/>
                <YAxis tick={TICK_SM} tickLine={false} axisLine={AX_LINE}
                  tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:String(v)}/>
                <Tooltip {...TT_NEON} formatter={(v:any,n:any)=>[Number(v).toLocaleString(), n]}/>
                <Legend wrapperStyle={{ fontSize:10, color:'rgba(148,163,184,0.7)' }}/>
                <Area type="monotone" dataKey="light" name="Light" stroke={C.blue}   strokeWidth={2}
                  fill="url(#mLight)" dot={false}/>
                <Area type="monotone" dataKey="heavy" name="Heavy" stroke={C.orange} strokeWidth={2}
                  fill="url(#mHeavy)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>

        {/* Speed comparison */}
        <div style={{ ...glass(C.teal), padding:14 }}>
          {sectionHead('Speed Profile · All Stations', <Wind size={15}/>, C.teal)}
          <Chart3DWrap tilt={1.2}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={speedChartData} margin={{left:0,right:8,top:8,bottom:0}}>
                <defs>
                  <GlowDefs id="spd"/>
                  <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.teal}   stopOpacity={0.9}/>
                    <stop offset="100%" stopColor={C.teal}   stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="p85Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.yellow} stopOpacity={0.9}/>
                    <stop offset="100%" stopColor={C.yellow} stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.07)"/>
                <XAxis dataKey="id" tick={TICK_SM} tickLine={false} axisLine={AX_LINE}/>
                <YAxis tick={TICK_SM} tickLine={false} axisLine={AX_LINE}
                  domain={[0,'auto']} tickFormatter={v=>`${v}`} unit=" km/h"/>
                <Tooltip {...TT_NEON} formatter={(v:any,n:any)=>[`${v} km/h`, n]}/>
                <Legend wrapperStyle={{ fontSize:10, color:'rgba(148,163,184,0.7)' }}/>
                <Bar dataKey="avg" name="Avg Speed"   fill="url(#avgGrad)" shape={<Bar3D/>} radius={[4,4,0,0]}/>
                <Bar dataKey="p85" name="P85 Speed"   fill="url(#p85Grad)" shape={<Bar3D/>} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>
      </div>

      {/* ── ROW 5: LIGHT vs HEAVY RADAR + SITE DATA TABLE ─────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:14 }}>

        {/* Radar – light vs heavy composition */}
        <div style={{ ...glass(C.pink), padding:14 }}>
          {sectionHead('Light vs Heavy Mix · All Sites', <Activity size={15}/>, C.pink)}
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={90}>
              <PolarGrid stroke="rgba(255,45,120,0.15)"/>
              <PolarAngleAxis dataKey="site" tick={{ fill:'rgba(148,163,184,0.7)', fontSize:9, fontWeight:700 }}/>
              <PolarRadiusAxis angle={90} domain={[0,100]} tick={false} axisLine={false}/>
              <Radar name="Light %" dataKey="light" stroke={C.blue}   fill={C.blue}   fillOpacity={0.25} strokeWidth={2}/>
              <Radar name="Heavy %" dataKey="heavy" stroke={C.orange} fill={C.orange} fillOpacity={0.25} strokeWidth={2}/>
              <Legend wrapperStyle={{ fontSize:10, color:'rgba(148,163,184,0.7)' }}/>
              <Tooltip {...TT_NEON} formatter={(v:any,n:any)=>[`${v}%`,n]}/>
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Station data table */}
        <div style={{ ...glass(C.cyan), padding:14 }}>
          {sectionHead('Station Summary Table', <MapPin size={15}/>, C.cyan)}
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(0,245,255,0.15)' }}>
                  {['Station','Road Section','AADT (veh/day)','Light %','Heavy %','Avg Speed','P85 Speed','Days'].map(h=>(
                    <th key={h} style={{ padding:'5px 8px', textAlign:'left', fontWeight:800,
                      color:'rgba(0,245,255,0.7)', fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aadtRows.map((r,i)=>{
                  const sp  = speed.find(s=>s.id===r.id);
                  const si  = sites.find(s=>s.id===r.id);
                  const col = SITE_COLORS[i % SITE_COLORS.length];
                  const isActive = r.id === selSite;
                  return (
                    <tr key={r.id}
                      onClick={()=>setSelSite(r.id)}
                      style={{
                        cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.04)',
                        background: isActive ? `rgba(${hexRgb(col)},0.08)` : 'transparent',
                        transition:'background 0.15s',
                      }}>
                      <td style={{ padding:'5px 8px', fontWeight:800, color:col }}>{r.id}</td>
                      <td style={{ padding:'5px 8px', color:'rgba(226,234,244,0.8)', maxWidth:160,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {si?.road ?? '—'}
                      </td>
                      <td style={{ padding:'5px 8px', fontWeight:800, color:'#fff' }}>
                        {r.aadt.toLocaleString()}
                      </td>
                      <td style={{ padding:'5px 8px', color:C.blue,   fontWeight:700 }}>{r.light_pct}%</td>
                      <td style={{ padding:'5px 8px', color:C.orange, fontWeight:700 }}>{r.heavy_pct}%</td>
                      <td style={{ padding:'5px 8px', color:C.teal,  fontWeight:700 }}>
                        {sp?.avg_speed ?? '—'} km/h
                      </td>
                      <td style={{ padding:'5px 8px', color:C.yellow, fontWeight:700 }}>
                        {sp?.p85_speed ?? '—'} km/h
                      </td>
                      <td style={{ padding:'5px 8px', color:'rgba(148,163,184,0.6)' }}>{r.days}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <div style={{ textAlign:'center', paddingTop:8, paddingBottom:4 }}>
        <div style={{ fontSize:9, color:'rgba(100,116,139,0.4)', letterSpacing:'0.08em' }}>
          ATC NETWORK · DNR / UNRA · Data: 2017–2022 · {sites.length} permanent mother stations ·{' '}
          6-class vehicle scheme (TIS data capture) · Source: UNRA Traffic Management Unit
        </div>
      </div>
      </>)} {/* end dashboard tab */}

      {/* ── STATION MAP TAB (all 298 traffic count stations) ─────────────── */}
      {activeTab === 'stationmap' && (
        <StationMapPanel allStations={allStations} />
      )}

    </div>
  );
}
