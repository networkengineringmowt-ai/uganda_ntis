import { useMemo } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, TrendingUp,
  Building2, Layers, Wrench, Activity, MapPin, BarChart3,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts';
import {
  NEON, TICK, TICK_SM, AX_LINE, TT_NEON,
  Bar3D, GlowDefs, Chart3DWrap, AreaGradDefs, hexRgb,
} from '../../lib/chart3d';
import { useBMS } from '../../store/BMSContext';
import { conditionColor, conditionLabel, formatUGX, formatDate } from '../../utils/helpers';
import { ModuleNavBar } from '../../shared/ModuleNavBar';

// ─── Neon colours ─────────────────────────────────────────────────────────────
const N = {
  cyan:   '#00f5ff', green: '#00ff88', orange: '#ff6b35',
  purple: '#b967ff', yellow:'#ffd23f', pink:  '#ff2d78',
  blue:   '#4d9fff', teal:  '#00d4aa',
};

const COND_COLOR: Record<number,string> = {
  1: N.pink, 2: N.orange, 3: N.yellow, 4: N.green, 5: N.cyan,
};
const COND_LABEL: Record<number,string> = {
  1:'Critical', 2:'Poor', 3:'Fair', 4:'Good', 5:'Excellent',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const gl = (accent = N.cyan): React.CSSProperties => ({
  background:   'rgba(2,5,8,0.82)',
  border:       `1px solid rgba(${hexRgb(accent)},0.18)`,
  borderRadius: 14,
  backdropFilter: 'blur(18px)',
  padding:      '14px 16px',
});

function SHead({ label, icon, color }: { label:string; icon:React.ReactNode; color:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
      <span style={{ color, filter:`drop-shadow(0 0 6px ${color})` }}>{icon}</span>
      <span style={{ fontSize:12, fontWeight:800, color, letterSpacing:'0.05em',
        textShadow:`0 0 12px rgba(${hexRgb(color)},0.5)` }}>{label}</span>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg,rgba(${hexRgb(color)},0.4),transparent)` }}/>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, color, sub, onClick, pulse }:{
  label:string; value:string|number; icon:React.ReactNode;
  color:string; sub?:string; onClick?:()=>void; pulse?:boolean;
}) {
  const rgb = hexRgb(color);
  return (
    <div onClick={onClick} style={{
      ...gl(color), cursor: onClick ? 'pointer' : 'default',
      boxShadow:`0 0 20px rgba(${rgb},0.07), inset 0 1px 0 rgba(${rgb},0.1)`,
      display:'flex', alignItems:'flex-start', gap:12,
    }}>
      <div style={{
        width:38, height:38, borderRadius:10, flexShrink:0,
        background:`rgba(${rgb},0.15)`, border:`1px solid rgba(${rgb},0.25)`,
        display:'flex', alignItems:'center', justifyContent:'center',
        color, animation: pulse ? 'pulse 2s ease-in-out infinite' : undefined,
        boxShadow:`0 0 10px rgba(${rgb},0.2)`,
      }}>{icon}</div>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:22, fontWeight:900, color, lineHeight:1,
          textShadow:`0 0 16px rgba(${rgb},0.5)` }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div style={{ fontSize:10, fontWeight:700, color:'rgba(226,234,244,0.8)', marginTop:3 }}>{label}</div>
        {sub && <div style={{ fontSize:9, color:'rgba(148,163,184,0.55)', marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Custom Pie label ─────────────────────────────────────────────────────────
function PieLbl({ cx,cy,midAngle,outerRadius,percent,name }:any) {
  if (percent < 0.05) return null;
  const r = Math.PI/180;
  const x = cx+(outerRadius+18)*Math.cos(-midAngle*r);
  const y = cy+(outerRadius+18)*Math.sin(-midAngle*r);
  return <text x={x} y={y} fill="#e2eaf4" textAnchor={x>cx?'start':'end'}
    dominantBaseline="central" fontSize={9} fontWeight={700}>
    {name} {(percent*100).toFixed(0)}%</text>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { state, navigate } = useBMS();
  const { structures, workOrders, inspections } = state;

  const stats = useMemo(() => {
    const bridges  = structures.filter(s => s.type === 'bridge');
    const culverts = structures.filter(s => s.type === 'culvert');
    const byCond: Record<number,number> = {1:0,2:0,3:0,4:0,5:0};
    structures.forEach(s => { byCond[s.conditionRating] = (byCond[s.conditionRating]||0)+1; });
    const overdue   = structures.filter(s => s.inspectionDue).length;
    const critical  = byCond[1];
    const poor      = byCond[2];
    const activeWOs = workOrders.filter(w => w.status === 'In Progress').length;
    const totalCost = workOrders.reduce((sum,w) => sum+w.cost, 0);
    const byRegion: Record<string,number> = {};
    structures.forEach(s => { const r = s.region||'Unknown'; byRegion[r]=(byRegion[r]||0)+1; });
    const byType: Record<string,number> = {};
    workOrders.forEach(w => { byType[w.type]=(byType[w.type]||0)+w.cost; });
    const woByStatus = { 'In Progress':0, Completed:0, Planned:0, 'On Hold':0 };
    workOrders.forEach(w => { if (w.status in woByStatus) (woByStatus as any)[w.status]++; });
    const inspByMonth: Record<string,number> = {};
    inspections.forEach(i => {
      const m = i.completedAt?.slice(0,7) || i.date?.slice(0,7) || '?';
      inspByMonth[m] = (inspByMonth[m]||0)+1;
    });
    return { bridges:bridges.length, culverts:culverts.length, total:structures.length,
      byCond, overdue, critical, poor, activeWOs, totalCost, byRegion, byType, woByStatus, inspByMonth };
  }, [structures, workOrders, inspections]);

  const topCritical = useMemo(() =>
    structures.filter(s=>s.conditionRating<=2)
      .sort((a,b)=>a.conditionRating-b.conditionRating||b.priorityScore-a.priorityScore)
      .slice(0,6), [structures]);

  const recentInsp = useMemo(() =>
    [...inspections]
      .sort((a,b)=>new Date(b.completedAt).getTime()-new Date(a.completedAt).getTime())
      .slice(0,5), [inspections]);

  // ── Chart data ───────────────────────────────────────────────────────────────
  const condData = [1,2,3,4,5].map(c => ({
    name: COND_LABEL[c], count: stats.byCond[c]||0, color: COND_COLOR[c],
  }));

  const regionData = Object.entries(stats.byRegion)
    .sort(([,a],[,b])=>b-a)
    .map(([name,count],i)=>({ name, count, color:NEON[i%NEON.length] }));

  const woStatusData = Object.entries(stats.woByStatus)
    .filter(([,v])=>v>0)
    .map(([name,value],i)=>({ name, value, color:NEON[i%NEON.length] }));

  const woTypeData = Object.entries(stats.byType)
    .sort(([,a],[,b])=>b-a).slice(0,6)
    .map(([name,cost],i)=>({ name:name.replace(' Works','').replace('Maintenance','Maint.'), cost, color:NEON[i%NEON.length] }));

  const inspMonthData = Object.entries(stats.inspByMonth)
    .sort(([a],[b])=>a.localeCompare(b)).slice(-8)
    .map(([month,count])=>({ month:month.slice(5), count }));

  const priorityBins = useMemo(()=>{
    const bins = [{label:'0–20',min:0,max:20,count:0},{label:'21–40',min:21,max:40,count:0},
      {label:'41–60',min:41,max:60,count:0},{label:'61–80',min:61,max:80,count:0},
      {label:'81–100',min:81,max:100,count:0}];
    structures.forEach(s => {
      const b = bins.find(b=>s.priorityScore>=b.min && s.priorityScore<=b.max);
      if (b) b.count++;
    });
    return bins.map((b,i)=>({...b, color:NEON[i%NEON.length]}));
  }, [structures]);

  const TOTAL = stats.total || 1;

  return (
    <div style={{
      padding:20, display:'flex', flexDirection:'column', gap:16,
      fontFamily:`'Inter','Segoe UI',sans-serif`,
    }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      <ModuleNavBar module="BMS" />

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div>
        <div style={{fontSize:9,fontWeight:800,color:'rgba(0,245,255,0.4)',letterSpacing:'0.18em',textTransform:'uppercase'}}>
          BRIDGE MANAGEMENT SYSTEM</div>
        <div style={{fontSize:18,fontWeight:900,color:N.cyan,textShadow:`0 0 18px rgba(0,245,255,0.45)`,letterSpacing:'0.02em'}}>
          BMS Operations Dashboard</div>
        <div style={{fontSize:10,color:'rgba(148,163,184,0.6)',marginTop:2}}>
          {stats.total} structures · {stats.bridges} bridges · {stats.culverts} major culverts · Uganda National Road Network
        </div>
      </div>

      {/* ── KPI ROW 1 ────────────────────────────────────────────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        <KpiCard label="Total Bridges"      value={stats.bridges}  icon={<Building2 size={17}/>} color={N.cyan}   sub={`${TOTAL} total structures`}     onClick={()=>navigate('registry')}/>
        <KpiCard label="Major Culverts"     value={stats.culverts} icon={<Layers size={17}/>}    color={N.blue}   sub="Across Uganda road network"       onClick={()=>navigate('registry')}/>
        <KpiCard label="Critical + Poor"    value={stats.critical+stats.poor} icon={<AlertTriangle size={17}/>} color={N.pink}
          sub={`${stats.critical} critical · ${stats.poor} poor`} onClick={()=>navigate('priority')} pulse={stats.critical>0}/>
        <KpiCard label="Inspections Due"    value={stats.overdue}  icon={<Clock size={17}/>}     color={N.orange} sub={`${stats.activeWOs} works active`} onClick={()=>navigate('inspections')}/>
      </div>

      {/* ── KPI ROW 2 ────────────────────────────────────────────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        <KpiCard label="Condition ≥ Good"   value={stats.byCond[5]+stats.byCond[4]} icon={<CheckCircle2 size={17}/>} color={N.green}  sub="Excellent + Good"/>
        <KpiCard label="Fair Condition"     value={stats.byCond[3]}  icon={<Activity size={17}/>} color={N.yellow} sub="Monitoring required"/>
        <KpiCard label="Active Work Orders" value={stats.activeWOs}  icon={<Wrench size={17}/>}   color={N.purple} sub="In progress" onClick={()=>navigate('maintenance')}/>
        <KpiCard label="Maintenance Budget" value={formatUGX(stats.totalCost)} icon={<TrendingUp size={17}/>} color={N.teal} sub="Total committed"/>
      </div>

      {/* ── CHART ROW 1: Condition distribution + Work Order status pie ── */}
      <div style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:14}}>

        {/* Chart 1 — Condition distribution */}
        <div style={gl(N.pink)}>
          <SHead label="Condition Distribution" icon={<BarChart3 size={14}/>} color={N.pink}/>
          <Chart3DWrap tilt={1.8}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={condData} margin={{left:0,right:8,top:8,bottom:0}}>
                <defs><GlowDefs id="cond"/></defs>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.07)"/>
                <XAxis dataKey="name" tick={TICK_SM} tickLine={false} axisLine={AX_LINE}/>
                <YAxis tick={TICK_SM} tickLine={false} axisLine={AX_LINE}/>
                <Tooltip {...TT_NEON} formatter={(v:any)=>[`${v} structures`,'Count']}/>
                <Bar dataKey="count" shape={<Bar3D/>} radius={[4,4,0,0]}>
                  {condData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>

        {/* Chart 2 — Work order status pie */}
        <div style={gl(N.purple)}>
          <SHead label="Work Order Status" icon={<Wrench size={14}/>} color={N.purple}/>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <defs>
                {NEON.map((c,i)=>(
                  <radialGradient key={i} id={`wog${i}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor={c} stopOpacity={0.9}/>
                    <stop offset="100%" stopColor={c} stopOpacity={0.25}/>
                  </radialGradient>
                ))}
              </defs>
              <Pie data={woStatusData.length?woStatusData:[{name:'No Data',value:1,color:N.cyan}]}
                cx="50%" cy="50%" outerRadius={78} innerRadius={32}
                paddingAngle={4} dataKey="value" labelLine={false} label={PieLbl} strokeWidth={0}>
                {(woStatusData.length?woStatusData:[{name:'No Data',value:1,color:N.cyan}]).map((_,i)=>(
                  <Cell key={i} fill={`url(#wog${i})`}
                    style={{filter:`drop-shadow(0 0 4px ${NEON[i%NEON.length]}44)`}}/>
                ))}
              </Pie>
              <Tooltip {...TT_NEON}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── CHART ROW 2: Region breakdown + Inspection trend ───────────── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>

        {/* Chart 3 — Structures by region */}
        <div style={gl(N.green)}>
          <SHead label="Structures by Region" icon={<MapPin size={14}/>} color={N.green}/>
          <Chart3DWrap tilt={1.4}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={regionData} layout="vertical" margin={{left:10,right:20,top:4,bottom:4}}>
                <defs><GlowDefs id="reg"/></defs>
                <CartesianGrid horizontal={false} stroke="rgba(148,163,184,0.06)"/>
                <XAxis type="number" tick={TICK_SM} tickLine={false} axisLine={AX_LINE}/>
                <YAxis type="category" dataKey="name" tick={TICK_SM} tickLine={false} axisLine={false} width={64}/>
                <Tooltip {...TT_NEON} formatter={(v:any)=>[`${v} structures`,'Count']}/>
                <Bar dataKey="count" shape={<Bar3D/>}>
                  {regionData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>

        {/* Chart 4 — Inspection history */}
        <div style={gl(N.blue)}>
          <SHead label="Inspection Activity (Monthly)" icon={<CheckCircle2 size={14}/>} color={N.blue}/>
          <Chart3DWrap tilt={1.2}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={inspMonthData.length?inspMonthData:[{month:'No data',count:0}]}
                margin={{left:0,right:8,top:8,bottom:0}}>
                <AreaGradDefs id="inspGrad" color={N.blue}/>
                <CartesianGrid stroke="rgba(148,163,184,0.07)"/>
                <XAxis dataKey="month" tick={TICK_SM} tickLine={false} axisLine={AX_LINE}/>
                <YAxis tick={TICK_SM} tickLine={false} axisLine={AX_LINE}/>
                <Tooltip {...TT_NEON} formatter={(v:any)=>[`${v} inspections`,'Count']}/>
                <Area type="monotone" dataKey="count" stroke={N.blue} strokeWidth={2}
                  fill="url(#inspGrad)" dot={{fill:N.blue,r:3,strokeWidth:0}}/>
              </AreaChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>
      </div>

      {/* ── CHART ROW 3: Maintenance budget + Priority score dist ──────── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>

        {/* Chart 5 — Maintenance cost by type */}
        <div style={gl(N.orange)}>
          <SHead label="Maintenance Budget by Work Type" icon={<Wrench size={14}/>} color={N.orange}/>
          <Chart3DWrap tilt={1.6}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={woTypeData.length?woTypeData:[{name:'No data',cost:0}]}
                margin={{left:0,right:8,top:8,bottom:0}}>
                <defs><GlowDefs id="wtype"/>
                  <linearGradient id="wostGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={N.orange} stopOpacity={0.9}/>
                    <stop offset="100%" stopColor={N.yellow}  stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.07)"/>
                <XAxis dataKey="name" tick={{...TICK_SM,fontSize:8}} tickLine={false} axisLine={AX_LINE}/>
                <YAxis tick={TICK_SM} tickLine={false} axisLine={AX_LINE}
                  tickFormatter={v=>v>=1e9?`${(v/1e9).toFixed(0)}B`:v>=1e6?`${(v/1e6).toFixed(0)}M`:`${v}`}/>
                <Tooltip {...TT_NEON} formatter={(v:any)=>[formatUGX(Number(v)),'Budget']}/>
                <Bar dataKey="cost" fill="url(#wostGrad)" shape={<Bar3D/>} radius={[4,4,0,0]}>
                  {woTypeData.map((_,i)=><Cell key={i} fill={NEON[i%NEON.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>

        {/* Chart 6 — Priority score distribution */}
        <div style={gl(N.yellow)}>
          <SHead label="Priority Score Distribution" icon={<Activity size={14}/>} color={N.yellow}/>
          <Chart3DWrap tilt={1.6}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={priorityBins} margin={{left:0,right:8,top:8,bottom:0}}>
                <defs><GlowDefs id="prio"/>
                  <linearGradient id="prioGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={N.yellow} stopOpacity={0.95}/>
                    <stop offset="100%" stopColor={N.orange}  stopOpacity={0.35}/>
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.07)"/>
                <XAxis dataKey="label" tick={TICK_SM} tickLine={false} axisLine={AX_LINE}/>
                <YAxis tick={TICK_SM} tickLine={false} axisLine={AX_LINE}/>
                <Tooltip {...TT_NEON} formatter={(v:any)=>[`${v} structures`,'Count']}/>
                <Bar dataKey="count" fill="url(#prioGrad)" shape={<Bar3D/>} radius={[4,4,0,0]}>
                  {priorityBins.map((d,i)=><Cell key={i} fill={d.color}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
        </div>
      </div>

      {/* ── BOTTOM: Critical alert list + Recent inspections ────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>

        <div style={gl(N.pink)}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <SHead label="Critical & Poor Structures" icon={<AlertTriangle size={14}/>} color={N.pink}/>
            <button onClick={()=>navigate('priority')} style={{
              fontSize:9,fontWeight:700,color:N.blue,background:'none',border:'none',
              cursor:'pointer',padding:'2px 6px',whiteSpace:'nowrap',
            }}>All {stats.critical+stats.poor} →</button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {topCritical.map(s=>(
              <div key={s.id} onClick={()=>navigate('registry')} style={{
                display:'flex',alignItems:'center',gap:10,padding:'7px 10px',borderRadius:8,
                cursor:'pointer',background:'rgba(255,255,255,0.04)',
                borderLeft:`2px solid ${conditionColor(s.conditionRating)}`,
              }}>
                <span style={{width:6,height:6,borderRadius:'50%',background:conditionColor(s.conditionRating),
                  boxShadow:`0 0 6px ${conditionColor(s.conditionRating)}`,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#e2eaf4',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</div>
                  <div style={{fontSize:9,color:'rgba(148,163,184,0.55)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.road}</div>
                </div>
                <div style={{fontSize:9,fontWeight:800,color:conditionColor(s.conditionRating),flexShrink:0}}>
                  {conditionLabel(s.conditionRating)}
                </div>
              </div>
            ))}
            {topCritical.length===0 && (
              <div style={{textAlign:'center',padding:'20px 0',fontSize:10,color:N.green,fontWeight:700}}>
                ✓ Network in good health — no critical structures
              </div>
            )}
          </div>
        </div>

        <div style={gl(N.teal)}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <SHead label="Recent Inspections" icon={<CheckCircle2 size={14}/>} color={N.teal}/>
            <button onClick={()=>navigate('inspections')} style={{
              fontSize:9,fontWeight:700,color:N.blue,background:'none',border:'none',
              cursor:'pointer',padding:'2px 6px',whiteSpace:'nowrap',
            }}>All →</button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {recentInsp.map(insp=>(
              <div key={insp.id} style={{
                display:'flex',alignItems:'center',gap:10,padding:'7px 10px',borderRadius:8,
                background:'rgba(255,255,255,0.04)',
              }}>
                <div style={{
                  width:28,height:28,borderRadius:8,flexShrink:0,display:'flex',
                  alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,
                  background:conditionColor(insp.overallCondition)+'22',
                  color:conditionColor(insp.overallCondition),
                  boxShadow:`0 0 6px ${conditionColor(insp.overallCondition)}44`,
                }}>{insp.overallCondition}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#e2eaf4',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{insp.structureName}</div>
                  <div style={{fontSize:9,color:'rgba(148,163,184,0.55)'}}>{insp.inspector} · {insp.type}</div>
                </div>
                <div style={{fontSize:9,color:'rgba(148,163,184,0.45)',flexShrink:0}}>{formatDate(insp.date)}</div>
              </div>
            ))}
            {recentInsp.length===0 && (
              <div style={{textAlign:'center',padding:'20px 0',fontSize:10,color:'rgba(148,163,184,0.4)'}}>
                No inspections recorded yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
