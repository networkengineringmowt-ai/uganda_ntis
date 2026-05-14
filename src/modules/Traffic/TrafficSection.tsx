/**
 * TrafficSection — Traffic Map view with ATC-site-style layout:
 *   Left sidebar (280px) — KPIs, sparkline, class spread chart
 *   Right main area — controls bar, Leaflet map, timeline bar
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  MapContainer, TileLayer, ZoomControl, GeoJSON,
  CircleMarker, Tooltip as LeafletTooltip,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Clock, Play, Pause } from 'lucide-react';
import { hexRgb } from '../../lib/chart3d';
import FeatureAnalyticsPanel from '../../shared/FeatureAnalyticsPanel';
import type { FeatureData, RoadLinkFeature, AtcStationFeature } from '../../shared/FeatureAnalyticsPanel';
import { ROAD_STYLES, ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';

// ─── Types ────────────────────────────────────────────────────────────────────
type MapMode    = 'adt' | 'surface' | 'class';
type SurfFilter = 'all' | 'paved' | 'unsealed';
type ClassFilter = 'all' | 'A' | 'B' | 'C' | 'M';

interface PredProps {
  link_id: string; link_name: string | null; road_no: string | null;
  road_class: string | null; region: string | null; length_km: number | null;
  aadt_predicted: number | null; growth_2030: number | null; growth_2040: number | null;
  heavy_vehicle_pct: number | null; congestion_risk: string | null; vehicle_km_daily: number | null;
}
interface PredFeature { type: 'Feature'; geometry: any; properties: PredProps }

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  cyan: '#00f5ff', green: '#00ff88', orange: '#ff6b35', purple: '#b967ff',
  yellow: '#ffd23f', pink: '#ff2d78', blue: '#4d9fff', teal: '#00d4aa', amber: '#f59e0b',
};

// Uganda road growth index (2016 = 0.62, 2020 = COVID dip, 2025 = 1.0, 2035 = 1.55)
const GROWTH_FACTORS: Record<number, number> = {
  2016: 0.62, 2017: 0.66, 2018: 0.71, 2019: 0.76, 2020: 0.65,
  2021: 0.74, 2022: 0.82, 2023: 0.90, 2024: 0.96, 2025: 1.00,
  2026: 1.05, 2027: 1.10, 2028: 1.16, 2029: 1.22, 2030: 1.28,
  2031: 1.33, 2032: 1.39, 2033: 1.44, 2034: 1.49, 2035: 1.55,
};

const CLASS_COLORS: Record<string, string> = {
  A: C.cyan, B: C.green, C: C.amber, M: '#94a3b8',
};

const REGION_CLR: Record<string, string> = {
  Central: C.cyan, Eastern: C.orange, 'North Eastern': C.pink,
  Northern: C.purple, Western: C.green, Southern: C.yellow,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function adtColor(aadt: number): string {
  if (aadt < 2000)  return C.green;
  if (aadt < 8000)  return C.yellow;
  if (aadt < 15000) return C.orange;
  return C.pink;
}
function roadWeight(rc: string | null): number {
  if (rc === 'M') return 4.0; if (rc === 'A') return 3.0; if (rc === 'B') return 2.0; return 1.5;
}
function getEatTime(d: Date) {
  const h = ((d.getUTCHours() + 3) % 24).toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
function formatLongDate(d: Date): string {
  const DAYS  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const day = d.getDate();
  const suf = [11,12,13].includes(day) ? 'th'
    : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
  return `${DAYS[d.getDay()]} ${day}${suf} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Sparkline area (sidebar KPI 3) ───────────────────────────────────────────
function SparklineArea({ avgAadt }: { avgAadt: number }) {
  const years  = [2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];
  const values = years.map(y => avgAadt * (GROWTH_FACTORS[y] ?? 1));
  const W = 236, H = 58, PL = 4, PR = 4, PT = 8, PB = 14;
  const cW = W - PL - PR, cH = H - PT - PB;
  const min = Math.min(...values) * 0.88;
  const max = Math.max(...values) * 1.06;
  const range = max - min || 1;
  const xp = (i: number) => PL + (i / (years.length - 1)) * cW;
  const yp = (v: number) => PT + (1 - (v - min) / range) * cH;
  const pts = values.map((v, i) => `${xp(i).toFixed(1)},${yp(v).toFixed(1)}`);
  const ptsStr = pts.join(' ');
  const areaD  = `M ${xp(0).toFixed(1)},${(PT+cH).toFixed(1)} L ${pts.join(' L ')} L ${xp(years.length-1).toFixed(1)},${(PT+cH).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:H, display:'block' }}>
      <defs>
        <linearGradient id="spkG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={C.teal} stopOpacity={0.45}/>
          <stop offset="100%" stopColor={C.teal} stopOpacity={0.03}/>
        </linearGradient>
      </defs>
      {/* COVID dip marker */}
      <line x1={xp(4).toFixed(1)} x2={xp(4).toFixed(1)} y1={PT} y2={PT+cH}
        stroke="rgba(255,210,63,0.25)" strokeDasharray="2 2"/>
      <text x={xp(4).toFixed(1)} y={PT+6} fill="rgba(255,210,63,0.5)" fontSize={6} textAnchor="middle">COVID</text>
      {/* area fill */}
      <path d={areaD} fill="url(#spkG)"/>
      {/* line */}
      <polyline points={ptsStr} fill="none" stroke={C.teal} strokeWidth={1.8}
        strokeLinejoin="round" strokeLinecap="round"
        style={{ filter:`drop-shadow(0 0 3px ${C.teal}88)` }}/>
      {/* dots at 2020 dip and 2025 */}
      <circle cx={xp(4).toFixed(1)} cy={yp(values[4]).toFixed(1)} r={2.5} fill={C.yellow}/>
      <circle cx={xp(9).toFixed(1)} cy={yp(values[9]).toFixed(1)} r={2.5} fill={C.teal}/>
      {/* x-axis labels */}
      <text x={xp(0)}   y={H-2} fill="rgba(148,163,184,0.4)" fontSize={7} textAnchor="middle">2016</text>
      <text x={xp(4)}   y={H-2} fill="rgba(255,210,63,0.45)"  fontSize={7} textAnchor="middle">2020</text>
      <text x={xp(9)}   y={H-2} fill="rgba(0,212,170,0.55)"   fontSize={7} textAnchor="end">2025</text>
    </svg>
  );
}

// ─── Class node spread bars (sidebar) ─────────────────────────────────────────
function ClassSpreadBars({ counts }: { counts: Record<string, number> }) {
  const CLASSES = ['A','B','C','M'] as const;
  const max = Math.max(...CLASSES.map(c => counts[c] ?? 0), 1);
  const W = 232, ROW = 24;
  return (
    <svg viewBox={`0 0 ${W} ${CLASSES.length * ROW + 4}`}
      style={{ width:'100%', height: CLASSES.length * ROW + 4, display:'block' }}>
      {CLASSES.map((cls, i) => {
        const count = counts[cls] ?? 0;
        const col   = CLASS_COLORS[cls] ?? '#94a3b8';
        const barW  = (count / max) * (W - 64);
        const y = i * ROW + 4;
        return (
          <g key={cls}>
            <text x={0} y={y + 14} fill={col} fontSize={9} fontWeight={700}>Class {cls}</text>
            <rect x={52} y={y} width={W - 64 - 24} height={17} rx={4}
              fill={`rgba(${hexRgb(col)},0.07)`}/>
            {barW > 0 && <>
              <rect x={52} y={y} width={barW} height={17} rx={4}
                fill={col} fillOpacity={0.72}/>
              <rect x={52} y={y} width={barW} height={8} rx={4}
                fill="rgba(255,255,255,0.14)"/>
            </>}
            <text x={W} y={y + 13} fill={col} fontSize={9} fontWeight={800} textAnchor="end">{count}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Map GeoJSON layer ────────────────────────────────────────────────────────
function TrafficLayer({
  features, mode, year, surfMap, onSelect,
}: {
  features: PredFeature[]; mode: MapMode; year: number;
  surfMap: Record<string, string>; onSelect: (p: PredProps) => void;
}) {
  const gf = GROWTH_FACTORS[year] ?? 1;

  const styleFeat = useCallback(
    (feat?: PredFeature) => {
      if (!feat?.properties) return {};
      const p = feat.properties;
      let color = '#94a3b8', dashArray: string | undefined;
      switch (mode) {
        case 'adt':
          color = adtColor((p.aadt_predicted ?? 0) * gf);
          break;
        case 'surface': {
          const s = surfMap[p.link_id] ?? 'unknown';
          color     = s === 'paved' ? ROAD_STYLES.paved.color
                    : s === 'unpaved' ? ROAD_STYLES.unpaved.color
                    : ROAD_STYLES.unknown.color;
          dashArray = s === 'unpaved' ? ROAD_STYLES.unpaved.dashArray : undefined;
          break;
        }
        case 'class':
          color = CLASS_COLORS[p.road_class ?? ''] ?? '#94a3b8';
          break;
      }
      return { color, weight: roadWeight(p.road_class), opacity: 0.88, fillOpacity: 0, dashArray };
    },
    [mode, year, gf, surfMap],
  );

  const onEach = useCallback(
    (feat: PredFeature, layer: L.Layer) => {
      (layer as L.Path).on({
        click:     () => onSelect(feat.properties),
        mouseover: (e: L.LeafletMouseEvent) => (e.target as L.Path).setStyle({ weight: 5, opacity: 1 }),
        mouseout:  (e: L.LeafletMouseEvent) =>
          (e.target as L.Path).setStyle(styleFeat(feat) as L.PathOptions),
      });
    },
    [onSelect, styleFeat],
  );

  const geojson  = useMemo(() => ({ type: 'FeatureCollection' as const, features }), [features]);
  const layerKey = mode === 'adt' ? `adt-${year}` : mode;

  return (
    <GeoJSON key={layerKey} data={geojson as any}
      style={styleFeat as any} onEachFeature={onEach as any}/>
  );
}

// ─── Map legend strip ─────────────────────────────────────────────────────────
function MapLegend({ mode }: { mode: MapMode }) {
  const items: [string, string][] =
    mode === 'adt'     ? [['<2k',C.green],['2k–8k',C.yellow],['8k–15k',C.orange],['>15k',C.pink]]
    : mode === 'surface'? [['Paved',ROAD_STYLES.paved.color],['Unpaved',ROAD_STYLES.unpaved.color],['Unknown',ROAD_STYLES.unknown.color]]
    :                     [['Class A',C.cyan],['Class B',C.green],['Class C',C.amber],['Class M','#94a3b8']];
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 10px', alignItems:'center' }}>
      {items.map(([l,col]) => (
        <span key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:col }}>
          <span style={{ width:14, height:3, background:col, borderRadius:2, display:'inline-block' }}/>
          {l}
        </span>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function TrafficSection() {
  const [features,    setFeatures]    = useState<PredFeature[]>([]);
  const [surfMap,     setSurfMap]     = useState<Record<string, string>>({});
  const [stations,    setStations]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [mode,        setMode]        = useState<MapMode>('adt');
  const [surfFilter,  setSurfFilter]  = useState<SurfFilter>('all');
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [timelineYear,setTimelineYear]= useState(2025);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [now,         setNow]         = useState(() => new Date());
  const [selFeature,  setSelFeature]  = useState<FeatureData | null>(null);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Timeline play animation
  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => {
        setTimelineYear(y => {
          if (y >= 2035) { setIsPlaying(false); return 2035; }
          return y + 1;
        });
      }, 850);
    } else if (playRef.current) {
      clearInterval(playRef.current);
      playRef.current = null;
    }
    return () => { if (playRef.current) { clearInterval(playRef.current); playRef.current = null; } };
  }, [isPlaying]);

  // Data load
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/traffic_predictions.geojson`).then(r => r.json()),
      fetch(`${base}data/road_surface.json`).then(r => r.json()),
      fetch(`${base}atc_stations.geojson`).then(r => r.json()),
    ]).then(([gj, surf, stGJ]) => {
      setFeatures((gj.features ?? []) as PredFeature[]);
      setSurfMap(surf as Record<string, string>);
      setStations((stGJ.features ?? []) as any[]);
    }).catch(err => console.error('TrafficSection load:', err))
      .finally(() => setLoading(false));
  }, []);

  const predByLink = useMemo(
    () => new Map(features.map(f => [f.properties.link_id, f.properties])),
    [features],
  );

  const filteredFeatures = useMemo(() => features.filter(f => {
    const surf = surfMap[f.properties.link_id];
    if (surfFilter === 'paved'    && surf !== 'paved')   return false;
    if (surfFilter === 'unsealed' && surf !== 'unpaved') return false;
    if (classFilter !== 'all'     && f.properties.road_class !== classFilter) return false;
    return true;
  }), [features, surfMap, surfFilter, classFilter]);

  const kpis = useMemo(() => {
    if (!features.length) return null;
    const totalAdt  = features.reduce((s, f) => s + (f.properties.aadt_predicted ?? 0), 0);
    const avgAadt   = totalAdt / features.length;
    const avg2040   = features.reduce((s, f) => s + (f.properties.growth_2040 ?? avgAadt * 1.95), 0) / features.length;
    const growthRatio = ((avg2040 / Math.max(avgAadt, 1)) - 1) * 100;
    const pavedKeys = Object.values(surfMap).filter(v => v === 'paved').length;
    const totalSurf = Object.keys(surfMap).length;
    const pavingIndex = totalSurf ? (pavedKeys / totalSurf) * 100 : 0;
    const classCounts: Record<string, number> = {};
    for (const f of features) {
      const c = f.properties.road_class ?? 'Unknown';
      classCounts[c] = (classCounts[c] ?? 0) + 1;
    }
    return { totalAdt, avgAadt, growthRatio, pavingIndex, classCounts };
  }, [features, surfMap]);

  function onLinkClick(p: PredProps) {
    const surf = surfMap[p.link_id];
    setSelFeature({
      type: 'road-link', name: p.link_name ?? p.link_id,
      roadClass: p.road_class ?? '?', lengthKm: p.length_km ?? 0,
      surface: surf === 'paved' ? 'Bituminous' : surf === 'unpaved' ? 'Unsealed' : 'Unknown',
      region: p.region ?? undefined, aadt: p.aadt_predicted ?? undefined,
      congestionRisk: p.congestion_risk ?? undefined,
      forecast2030: p.growth_2030 ?? undefined, forecast2040: p.growth_2040 ?? undefined,
    } as RoadLinkFeature);
  }

  function onStationClick(feat: any) {
    const p    = feat.properties ?? {};
    const pred = predByLink.get(p.Link_ID ?? '');
    setSelFeature({
      type: 'atc-station', id: p.TCS_NAME ?? String(p.TCS_NO ?? '?'),
      name: p.TCS_NAME ?? 'Unknown', road: p.Link_Name ?? undefined,
      region: p.REGION ?? undefined, aadt: pred?.aadt_predicted ?? 0,
      lightPct: pred ? 100 - (pred.heavy_vehicle_pct ?? 0) : undefined,
      heavyPct: pred?.heavy_vehicle_pct ?? undefined,
    } as AtcStationFeature);
  }

  const eatStr  = getEatTime(now);
  const dateStr = formatLongDate(now);

  const KPI_GLASS: React.CSSProperties = {
    background: 'rgba(2,5,8,0.88)', border: '1px solid rgba(0,245,255,0.1)',
    borderRadius: 10, padding: '10px 12px',
  };

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%',
        background:'#020508', color:'rgba(148,163,184,0.5)', fontSize:13,
        fontFamily:"'Inter','Segoe UI',sans-serif" }}>
        Loading traffic data…
      </div>
    );
  }

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden',
      background:'#020508', fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(1.4)}}
        .tpill{cursor:pointer;border-radius:6px;padding:3px 9px;font-size:9px;font-weight:700;
               border:1px solid;transition:all .15s;letter-spacing:.04em;background:transparent;}
      `}</style>

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
      <div style={{
        width:280, flexShrink:0, display:'flex', flexDirection:'column', gap:8,
        padding:'10px 10px 14px', background:'rgba(2,5,8,0.90)',
        borderRight:'1px solid rgba(0,245,255,0.07)', overflowY:'auto',
      }}>
        {/* Header */}
        <div style={{ padding:'4px 2px 2px' }}>
          <div style={{ fontSize:8, fontWeight:800, color:'rgba(0,212,170,0.55)',
            letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:2 }}>
            Uganda National Roads · UNRA
          </div>
          <div style={{ fontSize:14, fontWeight:900, color:C.teal, lineHeight:1.2,
            textShadow:`0 0 18px rgba(0,212,170,0.45)` }}>
            National Traffic Prediction
          </div>
          <div style={{ fontSize:9, color:'rgba(148,163,184,0.5)', marginTop:3, lineHeight:1.5 }}>
            Multiparametric Network Diagnostics
            <br/><span style={{ color:'rgba(0,212,170,0.65)' }}>{dateStr}</span>
          </div>
          <div style={{ marginTop:8, height:1,
            background:'linear-gradient(90deg,transparent,rgba(0,212,170,0.28),transparent)' }}/>
        </div>

        {/* KPI 1 – Total Network ADT */}
        <div style={{ ...KPI_GLASS, borderColor:'rgba(0,245,255,0.14)' }}>
          <div style={{ fontSize:8, fontWeight:700, color:'rgba(0,245,255,0.45)',
            textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:2 }}>
            Total Network ADT
          </div>
          <div style={{ fontSize:26, fontWeight:900, color:C.cyan, lineHeight:1,
            textShadow:`0 0 22px rgba(0,245,255,0.4)` }}>
            {kpis ? `${Math.round(kpis.totalAdt/1000)}k` : '—'}
          </div>
          <div style={{ fontSize:9, color:'rgba(148,163,184,0.42)', marginTop:3 }}>
            vehicles / day · {features.length} survey nodes
          </div>
        </div>

        {/* KPI 2 – Network Growth Ratio */}
        <div style={{ ...KPI_GLASS, borderColor:'rgba(0,255,136,0.14)' }}>
          <div style={{ fontSize:8, fontWeight:700, color:'rgba(0,255,136,0.45)',
            textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:2 }}>
            Network Growth Ratio 2025 → 2040
          </div>
          <div style={{ fontSize:26, fontWeight:900, color:C.green, lineHeight:1,
            textShadow:`0 0 22px rgba(0,255,136,0.4)` }}>
            {kpis ? `+${kpis.growthRatio.toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize:9, color:'rgba(148,163,184,0.42)', marginTop:3 }}>
            ML-modelled forecast to 2040
          </div>
        </div>

        {/* KPI 3 – Sparkline trajectory */}
        <div style={{ ...KPI_GLASS, borderColor:'rgba(0,212,170,0.12)' }}>
          <div style={{ fontSize:8, fontWeight:700, color:'rgba(0,212,170,0.45)',
            textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>
            Network Trajectory Envelope (2016 – Now)
          </div>
          {kpis && <SparklineArea avgAadt={kpis.avgAadt}/>}
        </div>

        {/* KPI 4+5 – Stations + Survey Nodes */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div style={{ ...KPI_GLASS, borderColor:'rgba(255,210,63,0.14)' }}>
            <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,210,63,0.45)',
              textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>
              Active ATC Stations
            </div>
            <div style={{ fontSize:22, fontWeight:900, color:C.yellow, lineHeight:1 }}>
              {stations.length || 298}
            </div>
            <div style={{ fontSize:8, color:'rgba(148,163,184,0.4)', marginTop:2 }}>count stations</div>
          </div>
          <div style={{ ...KPI_GLASS, borderColor:'rgba(77,159,255,0.14)' }}>
            <div style={{ fontSize:7, fontWeight:700, color:'rgba(77,159,255,0.45)',
              textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>
              Total Survey Nodes
            </div>
            <div style={{ fontSize:22, fontWeight:900, color:C.blue, lineHeight:1 }}>
              {features.length}
            </div>
            <div style={{ fontSize:8, color:'rgba(148,163,184,0.4)', marginTop:2 }}>road links</div>
          </div>
        </div>

        {/* KPI 6 – Surface Paving Index */}
        <div style={{ ...KPI_GLASS, borderColor:'rgba(185,103,255,0.14)' }}>
          <div style={{ fontSize:8, fontWeight:700, color:'rgba(185,103,255,0.45)',
            textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>
            Surface Paving Index
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:22, fontWeight:900, color:C.purple, lineHeight:1 }}>
              {kpis ? `${kpis.pavingIndex.toFixed(0)}%` : '—'}
            </div>
            <div style={{ flex:1, height:7, background:'rgba(185,103,255,0.1)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${kpis?.pavingIndex ?? 0}%`,
                background:'linear-gradient(90deg,#b967ff,#00d4aa)', borderRadius:4 }}/>
            </div>
          </div>
          <div style={{ fontSize:9, color:'rgba(148,163,184,0.42)', marginTop:3 }}>
            links with Bituminous / Asphalt surface
          </div>
        </div>

        {/* Class Node Spread */}
        <div style={{ ...KPI_GLASS, borderColor:'rgba(148,163,184,0.08)' }}>
          <div style={{ fontSize:8, fontWeight:700, color:'rgba(148,163,184,0.4)',
            textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>
            Class Node Spread
          </div>
          {kpis && <ClassSpreadBars counts={kpis.classCounts}/>}
        </div>
      </div>

      {/* ── RIGHT: CONTROLS + MAP + TIMELINE ─────────────────────────────── */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Controls bar */}
        <div style={{
          height:50, flexShrink:0, display:'flex', alignItems:'center', gap:12,
          padding:'0 14px', background:'rgba(2,5,8,0.88)',
          borderBottom:'1px solid rgba(255,255,255,0.055)',
        }}>
          {/* Symbology dropdown */}
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ fontSize:8, fontWeight:800, color:'rgba(148,163,184,0.45)',
              textTransform:'uppercase', letterSpacing:'0.1em', whiteSpace:'nowrap' }}>Symbology</span>
            <select value={mode} onChange={e => setMode(e.target.value as MapMode)}
              style={{ background:'rgba(0,245,255,0.08)', border:'1px solid rgba(0,245,255,0.28)',
                borderRadius:7, color:C.cyan, fontSize:11, fontWeight:700,
                padding:'3px 8px', cursor:'pointer', outline:'none', fontFamily:'inherit' }}>
              <option value="adt">Traffic Delay (ADT)</option>
              <option value="surface">Surface Type</option>
              <option value="class">Road Class</option>
            </select>
          </div>

          <div style={{ width:1, height:26, background:'rgba(255,255,255,0.08)', flexShrink:0 }}/>

          {/* Surface pills */}
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:8, fontWeight:800, color:'rgba(148,163,184,0.4)',
              textTransform:'uppercase', letterSpacing:'0.08em' }}>Surface</span>
            {(['all','paved','unsealed'] as SurfFilter[]).map(sf => (
              <button key={sf} className="tpill"
                onClick={() => setSurfFilter(sf)}
                style={{
                  borderColor: surfFilter === sf ? 'rgba(0,245,255,0.4)' : 'rgba(255,255,255,0.1)',
                  color: surfFilter === sf ? C.cyan : 'rgba(148,163,184,0.5)',
                  background: surfFilter === sf ? 'rgba(0,245,255,0.1)' : 'transparent',
                }}>
                {sf === 'all' ? 'All' : sf === 'paved' ? 'Paved' : 'Unsealed'}
              </button>
            ))}
          </div>

          <div style={{ width:1, height:26, background:'rgba(255,255,255,0.08)', flexShrink:0 }}/>

          {/* Class pills */}
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:8, fontWeight:800, color:'rgba(148,163,184,0.4)',
              textTransform:'uppercase', letterSpacing:'0.08em' }}>Class</span>
            {(['all','A','B','C','M'] as ClassFilter[]).map(cf => {
              const col = cf === 'all' ? '#94a3b8' : CLASS_COLORS[cf] ?? '#94a3b8';
              const active = classFilter === cf;
              return (
                <button key={cf} className="tpill"
                  onClick={() => setClassFilter(cf)}
                  style={{
                    borderColor: active ? `rgba(${hexRgb(col)},0.45)` : 'rgba(255,255,255,0.1)',
                    color: active ? col : 'rgba(148,163,184,0.5)',
                    background: active ? `rgba(${hexRgb(col)},0.1)` : 'transparent',
                  }}>
                  {cf === 'all' ? 'All' : `Class ${cf}`}
                </button>
              );
            })}
          </div>

          {/* Legend – right side */}
          <div style={{ marginLeft:'auto', flexShrink:0 }}>
            <MapLegend mode={mode}/>
          </div>
        </div>

        {/* Map */}
        <div style={{ flex:1, minHeight:0, position:'relative' }}>
          <MapContainer center={[1.37,32.3]} zoom={7} zoomControl={false}
            style={{ height:'100%', width:'100%', background:'#020508' }}>
            <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery}/>
            <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.7}/>
            <ZoomControl position="bottomright"/>

            {filteredFeatures.length > 0 && (
              <TrafficLayer features={filteredFeatures} mode={mode}
                year={timelineYear} surfMap={surfMap} onSelect={onLinkClick}/>
            )}

            {/* ATC station dots */}
            {stations.map((feat, i) => {
              const [lng, lat] = feat.geometry?.coordinates ?? [0,0];
              if (!lat || !lng) return null;
              const p   = feat.properties ?? {};
              const col = REGION_CLR[p.REGION ?? ''] ?? '#94a3b8';
              return (
                <CircleMarker key={i} center={[lat, lng]} radius={3}
                  pathOptions={{ color:col, fillColor:col, fillOpacity:0.55, weight:0.8 }}
                  eventHandlers={{ click: () => onStationClick(feat) }}>
                  <LeafletTooltip>
                    <div style={{ background:'rgba(2,5,8,0.96)', color:col,
                      border:`1px solid ${col}55`, borderRadius:6, padding:'3px 8px',
                      fontSize:9, fontWeight:700 }}>
                      <div>{p.TCS_NAME}</div>
                      <div style={{ color:'rgba(226,234,244,0.7)', fontWeight:400 }}>{p.Link_Name}</div>
                      <div style={{ color:'rgba(148,163,184,0.45)', fontSize:8 }}>{p.REGION}</div>
                    </div>
                  </LeafletTooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Year badge */}
          {timelineYear !== 2025 && (
            <div style={{ position:'absolute', top:12, left:12, zIndex:900,
              background:'rgba(2,5,8,0.90)', border:'1px solid rgba(255,210,63,0.35)',
              borderRadius:10, padding:'5px 12px', backdropFilter:'blur(12px)' }}>
              <span style={{ fontSize:11, fontWeight:900, color:C.yellow }}>YEAR {timelineYear}</span>
              <span style={{ fontSize:9, color:'rgba(148,163,184,0.45)', marginLeft:6 }}>
                ×{(GROWTH_FACTORS[timelineYear] ?? 1).toFixed(2)} growth factor
              </span>
            </div>
          )}

          {/* Click hint */}
          <div style={{ position:'absolute', bottom:8, left:12, zIndex:900,
            fontSize:9, color:'rgba(148,163,184,0.28)', pointerEvents:'none' }}>
            Click a road link or station dot to inspect
          </div>

          {/* Feature analytics overlay */}
          {selFeature && (
            <div style={{ position:'absolute', top:10, right:10, zIndex:900 }}>
              <FeatureAnalyticsPanel feature={selFeature}
                onClose={() => setSelFeature(null)} width={310}/>
            </div>
          )}
        </div>

        {/* Timeline bar */}
        <div style={{
          height:54, flexShrink:0, display:'flex', alignItems:'center', gap:12,
          padding:'0 16px', background:'rgba(2,5,8,0.92)',
          borderTop:'1px solid rgba(255,255,255,0.05)',
        }}>
          {/* Date + EAT */}
          <div style={{ flexShrink:0, minWidth:180 }}>
            <div style={{ fontSize:10, fontWeight:800, color:C.teal }}>{dateStr}</div>
            <div style={{ fontSize:9, color:'rgba(148,163,184,0.45)',
              display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
              <Clock size={9}/> {eatStr} EAT (UTC+3)
            </div>
          </div>

          <div style={{ width:1, height:30, background:'rgba(255,255,255,0.07)', flexShrink:0 }}/>

          {/* Play / Pause */}
          <button
            onClick={() => {
              if (timelineYear >= 2035) { setTimelineYear(2016); setIsPlaying(true); }
              else setIsPlaying(p => !p);
            }}
            style={{ width:32, height:32, borderRadius:'50%', border:'none', cursor:'pointer',
              background: isPlaying ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.08)',
              color: isPlaying ? C.green : 'rgba(148,163,184,0.7)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              boxShadow: isPlaying ? `0 0 12px rgba(0,255,136,0.3)` : 'none',
              transition:'all .2s' }}>
            {isPlaying ? <Pause size={14}/> : <Play size={14}/>}
          </button>

          {/* Year label */}
          <div style={{ fontSize:13, fontWeight:900, color:C.yellow, flexShrink:0, minWidth:40 }}>
            {timelineYear}
          </div>

          {/* Slider */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:2 }}>
            <input type="range" min={2016} max={2035} value={timelineYear}
              onChange={e => { setTimelineYear(Number(e.target.value)); setIsPlaying(false); }}
              style={{ width:'100%', accentColor:C.yellow, cursor:'pointer' }}/>
            <div style={{ display:'flex', justifyContent:'space-between',
              fontSize:8, color:'rgba(148,163,184,0.32)' }}>
              <span>2016</span><span>2020</span><span>2025</span><span>2030</span><span>2035</span>
            </div>
          </div>

          {/* Speed legend gradient */}
          <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <div style={{ width:90, height:6, borderRadius:3,
              background:'linear-gradient(90deg,#00ff88,#ffd23f,#ff6b35,#ff2d78)' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', width:90 }}>
              <span style={{ fontSize:7, color:'rgba(0,255,136,0.6)' }}>Low</span>
              <span style={{ fontSize:7, color:'rgba(148,163,184,0.3)' }}>← ADT →</span>
              <span style={{ fontSize:7, color:'rgba(255,45,120,0.6)' }}>High</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
