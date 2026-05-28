/**
 * TrafficSection — Traffic Map view.
 *   Left sidebar  (280 px) — KPIs, sparkline, class-spread chart, station counts
 *   Right main    — controls bar + Leaflet map + timeline bar
 *
 * ATC enhancements (May 2026):
 *   • Custom pulsing divIcon markers for ATC stations (cyan glow rings)
 *   • TIS manual station dots with region colour
 *   • CSS drop-shadow glow on GeoJSON road paths
 *   • Animated "LIVE" badge
 *   • Vehicle-class breakdown + AADT trend fed into FeatureAnalyticsPanel
 *   • Corrected station counts: 25 ATC (15 legacy + 10 new) + 298 TIS
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  MapContainer, TileLayer, ZoomControl, GeoJSON,
  Marker, Tooltip as LeafletTooltip,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Clock, Play, Pause, Radio, Wifi } from 'lucide-react';
import { hexRgb } from '../../lib/chart3d';
import FeatureAnalyticsPanel from '../../shared/FeatureAnalyticsPanel';
import type { FeatureData, RoadLinkFeature, AtcStationFeature } from '../../shared/FeatureAnalyticsPanel';
import { ROAD_STYLES, ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';
import { WaterLayers } from '../../shared/WaterLayers';

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

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  cyan:   '#00f5ff', green:  '#00ff88', orange: '#ff6b35', purple: '#b967ff',
  yellow: '#ffd23f', pink:   '#ff2d78', blue:   '#4d9fff', teal:   '#00d4aa',
  amber:  '#f59e0b', indigo: '#6366f1', atcCyan: '#00c3ff', tisCyan: '#ffcc33',
};

// ─── Station network constants (corrected figures) ────────────────────────────
const ATC_LEGACY_COUNT = 15;   // 2016–2022 sites
const ATC_NEW_COUNT    = 10;   // post-2025 new sites
const ATC_TOTAL        = ATC_LEGACY_COUNT + ATC_NEW_COUNT;  // 25
// TIS manual stations come from atc_stations.geojson (298 features)

// ─── Uganda road growth index (2025 = 1.0) ───────────────────────────────────
const GROWTH_FACTORS: Record<number, number> = {
  2016: 0.62, 2017: 0.66, 2018: 0.71, 2019: 0.76, 2020: 0.65,
  2021: 0.74, 2022: 0.82, 2023: 0.90, 2024: 0.96, 2025: 1.00,
  2026: 1.05, 2027: 1.10, 2028: 1.16, 2029: 1.22, 2030: 1.28,
  2031: 1.33, 2032: 1.39, 2033: 1.44, 2034: 1.49, 2035: 1.55,
};
const TREND_YEARS = [2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];

// ─── Vehicle class composition (Uganda network average) ───────────────────────
const VC_CLASSES = [
  { label: 'Motorcycles',         pct: 0.295 },
  { label: 'Saloon Cars & Taxis', pct: 0.248 },
  { label: 'Light Goods',         pct: 0.118 },
  { label: 'Small Buses',         pct: 0.082 },
  { label: 'Medium Buses',        pct: 0.053 },
  { label: 'Large Buses',         pct: 0.042 },
  { label: 'Light Trucks',        pct: 0.062 },
  { label: 'Heavy Trucks',        pct: 0.074 },
  { label: 'Truck Trailers',      pct: 0.026 },
];

function computeVehicleClasses(aadt: number) {
  return VC_CLASSES.map(vc => ({
    label: vc.label,
    count: Math.round(aadt * vc.pct),
  }));
}
function computeGrowthTrend(aadt2025: number): number[] {
  return TREND_YEARS.map(y => Math.round(aadt2025 * (GROWTH_FACTORS[y] ?? 1)));
}

// ─── Map colour helpers ───────────────────────────────────────────────────────
const CLASS_COLORS: Record<string, string> = {
  A: C.cyan, B: C.green, C: C.amber, M: '#94a3b8',
};
const REGION_CLR: Record<string, string> = {
  Central: C.atcCyan, Eastern: C.orange, 'North Eastern': C.pink,
  Northern: C.purple, Western: C.green, Southern: C.yellow,
};

function adtColor(aadt: number): string {
  if (aadt < 2000)  return C.green;
  if (aadt < 8000)  return C.yellow;
  if (aadt < 15000) return C.orange;
  return C.pink;
}
function roadWeight(rc: string | null): number {
  if (rc === 'M') return 4.0; if (rc === 'A') return 3.0;
  if (rc === 'B') return 2.0; return 1.5;
}
function getEatTime(d: Date) {
  const h = ((d.getUTCHours() + 3) % 24).toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
function formatLongDate(d: Date): string {
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const day = d.getDate();
  const suf  = [11,12,13].includes(day) ? 'th'
    : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
  return `${DAYS[d.getDay()]} ${day}${suf} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Custom pulsing Leaflet divIcon for stations ──────────────────────────────
function makeStationIcon(color: string, isATC: boolean): L.DivIcon {
  const size = isATC ? 20 : 12;
  return L.divIcon({
    html: `<div class="ts-wrap ts-wrap-${isATC ? 'atc' : 'tis'}" style="width:${size}px;height:${size}px">
      ${isATC ? `
        <div class="ts-ring ts-r1" style="border-color:${color}"></div>
        <div class="ts-ring ts-r2" style="border-color:${color}"></div>` : ''}
      <div class="ts-dot" style="background:${color};box-shadow:0 0 6px ${color}88;width:${isATC?8:6}px;height:${isATC?8:6}px"></div>
    </div>`,
    className: 'ts-icon',
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [size / 2 + 4, 0],
  });
}

// ─── Sidebar sub-charts ───────────────────────────────────────────────────────

function SparklineArea({ avgAadt }: { avgAadt: number }) {
  const years  = TREND_YEARS;
  const values = years.map(y => avgAadt * (GROWTH_FACTORS[y] ?? 1));
  const W = 236, H = 58, PL = 4, PR = 4, PT = 8, PB = 14;
  const cW = W - PL - PR, cH = H - PT - PB;
  const min = Math.min(...values) * 0.88;
  const max = Math.max(...values) * 1.06;
  const range = max - min || 1;
  const xp = (i: number) => PL + (i / (years.length - 1)) * cW;
  const yp = (v: number) => PT + (1 - (v - min) / range) * cH;
  const pts = values.map((v, i) => `${xp(i).toFixed(1)},${yp(v).toFixed(1)}`);
  const areaD = `M ${xp(0).toFixed(1)},${(PT+cH).toFixed(1)} L ${pts.join(' L ')} L ${xp(years.length-1).toFixed(1)},${(PT+cH).toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      <defs>
        <linearGradient id="spkG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={C.teal} stopOpacity={0.45} />
          <stop offset="100%" stopColor={C.teal} stopOpacity={0.03} />
        </linearGradient>
      </defs>
      <line x1={xp(4).toFixed(1)} x2={xp(4).toFixed(1)} y1={PT} y2={PT+cH}
        stroke="rgba(255,210,63,0.25)" strokeDasharray="2 2" />
      <text x={xp(4).toFixed(1)} y={PT+6} fill="rgba(255,210,63,0.5)" fontSize={6} textAnchor="middle">COVID</text>
      <path d={areaD} fill="url(#spkG)" />
      <polyline points={pts.join(' ')} fill="none" stroke={C.teal} strokeWidth={1.8}
        strokeLinejoin="round" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${C.teal}88)` }} />
      <circle cx={xp(4).toFixed(1)} cy={yp(values[4]).toFixed(1)} r={2.5} fill={C.yellow} />
      <circle cx={xp(9).toFixed(1)} cy={yp(values[9]).toFixed(1)} r={2.5} fill={C.teal} />
      <text x={xp(0)}  y={H-2} fill="rgba(148,163,184,0.4)"  fontSize={7} textAnchor="middle">2016</text>
      <text x={xp(4)}  y={H-2} fill="rgba(255,210,63,0.45)"  fontSize={7} textAnchor="middle">2020</text>
      <text x={xp(9)}  y={H-2} fill="rgba(0,212,170,0.55)"   fontSize={7} textAnchor="end">2025</text>
    </svg>
  );
}

function ClassSpreadBars({ counts }: { counts: Record<string, number> }) {
  const CLASSES = ['A','B','C','M'] as const;
  const max = Math.max(...CLASSES.map(c => counts[c] ?? 0), 1);
  const W = 232, ROW = 24;
  return (
    <svg viewBox={`0 0 ${W} ${CLASSES.length * ROW + 4}`}
      style={{ width: '100%', height: CLASSES.length * ROW + 4, display: 'block' }}>
      {CLASSES.map((cls, i) => {
        const count = counts[cls] ?? 0;
        const col   = CLASS_COLORS[cls] ?? '#94a3b8';
        const barW  = (count / max) * (W - 64);
        const y = i * ROW + 4;
        return (
          <g key={cls}>
            <text x={0} y={y + 14} fill={col} fontSize={9} fontWeight={700}>Class {cls}</text>
            <rect x={52} y={y} width={W - 64 - 24} height={17} rx={4}
              fill={`rgba(${hexRgb(col)},0.07)`} />
            {barW > 0 && <>
              <rect x={52} y={y} width={barW} height={17} rx={4}
                fill={col} fillOpacity={0.72} />
              <rect x={52} y={y} width={barW} height={8} rx={4}
                fill="rgba(255,255,255,0.14)" />
            </>}
            <text x={W} y={y + 13} fill={col} fontSize={9} fontWeight={800} textAnchor="end">{count}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── GeoJSON traffic layer ────────────────────────────────────────────────────
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
          color     = s === 'paved'   ? ROAD_STYLES.paved.color
                    : s === 'unpaved' ? ROAD_STYLES.unpaved.color
                    : ROAD_STYLES.unknown.color;
          dashArray = s === 'unpaved' ? ROAD_STYLES.unpaved.dashArray : undefined;
          break;
        }
        case 'class':
          color = CLASS_COLORS[p.road_class ?? ''] ?? '#94a3b8';
          break;
      }
      return {
        color, weight: roadWeight(p.road_class), opacity: 0.9, fillOpacity: 0,
        dashArray, className: 'ts-road-glow',
      };
    },
    [mode, year, gf, surfMap],
  );

  const onEach = useCallback(
    (feat: PredFeature, layer: L.Layer) => {
      (layer as L.Path).on({
        click:     () => onSelect(feat.properties),
        mouseover: (e: L.LeafletMouseEvent) =>
          (e.target as L.Path).setStyle({ weight: 5, opacity: 1 }),
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
      style={styleFeat as any} onEachFeature={onEach as any} />
  );
}

// ─── Map legend ───────────────────────────────────────────────────────────────
function MapLegend({ mode }: { mode: MapMode }) {
  const items: [string, string][] =
    mode === 'adt'
      ? [['<2k',C.green],['2k–8k',C.yellow],['8k–15k',C.orange],['>15k',C.pink]]
      : mode === 'surface'
      ? [['Paved',ROAD_STYLES.paved.color],['Unpaved',ROAD_STYLES.unpaved.color],['Unknown',ROAD_STYLES.unknown.color]]
      : [['Class A',C.cyan],['Class B',C.green],['Class C',C.amber],['Class M','#94a3b8']];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'center' }}>
      {items.map(([l, col]) => (
        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: col }}>
          <span style={{ width: 14, height: 3, background: col, borderRadius: 2, display: 'inline-block' }} />
          {l}
        </span>
      ))}
    </div>
  );
}

// ─── KPI glass card ───────────────────────────────────────────────────────────
const KPI_GLASS: React.CSSProperties = {
  background: 'rgba(10,15,30,0.88)',
  border: '1px solid rgba(99,102,241,0.12)',
  borderRadius: 10, padding: '10px 12px',
};

// ─── Main export ──────────────────────────────────────────────────────────────
export default function TrafficSection() {
  const [features,     setFeatures]     = useState<PredFeature[]>([]);
  const [surfMap,      setSurfMap]      = useState<Record<string, string>>({});
  const [stations,     setStations]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [mode,         setMode]         = useState<MapMode>('adt');
  const [surfFilter,   setSurfFilter]   = useState<SurfFilter>('all');
  const [classFilter,  setClassFilter]  = useState<ClassFilter>('all');
  const [timelineYear, setTimelineYear] = useState(2025);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [now,          setNow]          = useState(() => new Date());
  const [selFeature,   setSelFeature]   = useState<FeatureData | null>(null);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live clock (EAT)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Timeline play
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
    }).catch(() => {})
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
    if (classFilter !== 'all'    && f.properties.road_class !== classFilter) return false;
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

  // Station click → rich feature panel
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
    const aadt = pred?.aadt_predicted ?? 800;
    setSelFeature({
      type:         'atc-station',
      id:           p.TCS_NAME ?? String(p.TCS_NO ?? '?'),
      name:         p.TCS_NAME ?? 'Unknown Station',
      road:         p.Link_Name ?? undefined,
      region:       p.REGION ?? undefined,
      aadt,
      stationType:  'TIS',   // most stations in this GeoJSON are manual TIS
      lightPct:     pred ? 100 - (pred.heavy_vehicle_pct ?? 25) : 75,
      heavyPct:     pred?.heavy_vehicle_pct ?? 25,
      vehicleClasses: computeVehicleClasses(aadt),
      growthTrend:    computeGrowthTrend(aadt),
    } as AtcStationFeature);
  }

  const eatStr  = getEatTime(now);
  const dateStr = formatLongDate(now);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', background: '#0a0f1e',
        color: 'rgba(148,163,184,0.5)', fontSize: 13,
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}>
        Loading traffic data…
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', height: '100%', overflow: 'hidden',
      background: '#0a0f1e', fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>

      {/* ══ CSS animations + custom marker styles ══════════════════════════════ */}
      <style>{`
        /* ── ATC pulse-ring animation ── */
        @keyframes tsRingPulse {
          0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0.85; }
          100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
        }
        /* ── LIVE badge blink ── */
        @keyframes liveBlink { 0%,100%{opacity:1} 50%{opacity:.25} }
        /* ── Timeline play glow ── */
        @keyframes playGlow { 0%,100%{box-shadow:0 0 12px rgba(0,255,136,.35)} 50%{box-shadow:0 0 22px rgba(0,255,136,.65)} }

        /* ── Pill filter buttons ── */
        .tpill {
          cursor:pointer; border-radius:6px; padding:3px 9px;
          font-size:9px; font-weight:700; border:1px solid;
          transition:all .15s; letter-spacing:.04em; background:transparent;
        }

        /* ── Road glow (applied via GeoJSON className) ── */
        .ts-road-glow { filter: drop-shadow(0 0 3px rgba(255,255,255,0.22)); }

        /* ── Custom marker icon wrapper (Leaflet strips default styles) ── */
        .ts-icon { background: transparent !important; border: none !important; }

        /* ── Station marker base ── */
        .ts-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
        .ts-dot  { border-radius: 50%; position: absolute; top: 50%; left: 50%;
                   transform: translate(-50%,-50%); z-index: 2; }

        /* ── ATC pulse rings ── */
        .ts-ring {
          position: absolute; top: 50%; left: 50%;
          width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid;
          transform: translate(-50%,-50%) scale(0.5); opacity: 0;
          animation: tsRingPulse 2.6s ease-out infinite; z-index: 1;
        }
        .ts-r2 { animation-delay: 1.3s; }

        /* ── Leaflet tooltip override ── */
        .leaflet-tooltip {
          background: rgba(10,15,30,0.96) !important;
          border: 1px solid rgba(0,195,255,0.2) !important;
          border-radius: 8px !important;
          padding: 4px 10px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
          color: #e2eaf4 !important;
          font-family: 'Inter','Segoe UI',sans-serif !important;
        }
        .leaflet-tooltip::before { display:none !important; }
      `}</style>

      {/* ══ LEFT SIDEBAR — KPIs ════════════════════════════════════════════════ */}
      <div style={{
        width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
        padding: '10px 10px 14px',
        background: 'rgba(10,15,30,0.92)',
        borderRight: '1px solid rgba(99,102,241,0.1)',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '4px 2px 2px' }}>
          <div style={{
            fontSize: 8, fontWeight: 800, color: 'rgba(0,212,170,0.55)',
            letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 2,
          }}>Uganda National Roads · UNRA</div>
          <div style={{
            fontSize: 14, fontWeight: 900, color: C.teal, lineHeight: 1.2,
            textShadow: `0 0 18px rgba(0,212,170,0.45)`,
          }}>National Traffic Prediction</div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', marginTop: 3, lineHeight: 1.5 }}>
            Multiparametric Network Diagnostics
            <br /><span style={{ color: 'rgba(0,212,170,0.65)' }}>{dateStr}</span>
          </div>
          <div style={{
            marginTop: 8, height: 1,
            background: 'linear-gradient(90deg,transparent,rgba(0,212,170,0.28),transparent)',
          }} />
        </div>

        {/* KPI 1 – Total Network ADT */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(0,245,255,0.14)' }}>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(0,245,255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2,
          }}>Total Network ADT</div>
          <div style={{
            fontSize: 26, fontWeight: 900, color: C.cyan, lineHeight: 1,
            textShadow: `0 0 22px rgba(0,245,255,0.4)`,
          }}>
            {kpis ? `${Math.round(kpis.totalAdt / 1000)}k` : '—'}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.42)', marginTop: 3 }}>
            vehicles / day · {features.length} survey nodes
          </div>
        </div>

        {/* KPI 2 – Network Growth Ratio */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(0,255,136,0.14)' }}>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(0,255,136,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2,
          }}>Network Growth Ratio 2025 → 2040</div>
          <div style={{
            fontSize: 26, fontWeight: 900, color: C.green, lineHeight: 1,
            textShadow: `0 0 22px rgba(0,255,136,0.4)`,
          }}>
            {kpis ? `+${kpis.growthRatio.toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.42)', marginTop: 3 }}>
            ML-modelled forecast to 2040
          </div>
        </div>

        {/* KPI 3 – Sparkline trajectory */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(0,212,170,0.12)' }}>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(0,212,170,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
          }}>Network Trajectory Envelope (2016 – Now)</div>
          {kpis && <SparklineArea avgAadt={kpis.avgAadt} />}
        </div>

        {/* KPI 4 – ATC Stations split */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(0,195,255,0.14)' }}>
          <div style={{
            fontSize: 7, fontWeight: 700, color: 'rgba(0,195,255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
          }}>ATC Station Network</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.atcCyan, lineHeight: 1 }}>
                {ATC_TOTAL}
              </div>
              <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', marginTop: 1 }}>
                ATC stations total
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: C.atcCyan, fontWeight: 700 }}>
                <Wifi size={9} style={{ display: 'inline', marginRight: 3 }} />
                {ATC_LEGACY_COUNT} legacy (2016–22)
              </div>
              <div style={{ fontSize: 10, color: '#00ea90', fontWeight: 700, marginTop: 2 }}>
                <Wifi size={9} style={{ display: 'inline', marginRight: 3 }} />
                {ATC_NEW_COUNT} new (2025+)
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(0,195,255,0.1)', margin: '6px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={10} style={{ color: C.tisCyan, flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: 18, fontWeight: 900, color: C.tisCyan, lineHeight: 1 }}>
                {stations.length || 298}
              </span>
              <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', marginLeft: 5 }}>
                manual TIS stations
              </span>
            </div>
          </div>
        </div>

        {/* KPI 5 – Survey Nodes */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(77,159,255,0.14)' }}>
          <div style={{
            fontSize: 7, fontWeight: 700, color: 'rgba(77,159,255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2,
          }}>Total Survey Nodes</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.blue, lineHeight: 1 }}>
            {features.length}
          </div>
          <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', marginTop: 2 }}>road links monitored</div>
        </div>

        {/* KPI 6 – Surface Paving Index */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(185,103,255,0.14)' }}>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(185,103,255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
          }}>Surface Paving Index</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.purple, lineHeight: 1 }}>
              {kpis ? `${kpis.pavingIndex.toFixed(0)}%` : '—'}
            </div>
            <div style={{
              flex: 1, height: 7, background: 'rgba(185,103,255,0.1)',
              borderRadius: 4, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${kpis?.pavingIndex ?? 0}%`,
                background: 'linear-gradient(90deg,#b967ff,#00d4aa)', borderRadius: 4,
              }} />
            </div>
          </div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.42)', marginTop: 3 }}>
            links with Bituminous / Asphalt surface
          </div>
        </div>

        {/* KPI 7 – Class Node Spread */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(148,163,184,0.08)' }}>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(148,163,184,0.4)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
          }}>Class Node Spread</div>
          {kpis && <ClassSpreadBars counts={kpis.classCounts} />}
        </div>
      </div>

      {/* ══ RIGHT — CONTROLS + MAP + TIMELINE ════════════════════════════════ */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Controls bar */}
        <div style={{
          height: 50, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 14px',
          background: 'rgba(10,15,30,0.95)',
          borderBottom: '1px solid rgba(99,102,241,0.1)',
        }}>
          {/* Symbology */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              fontSize: 8, fontWeight: 800, color: 'rgba(148,163,184,0.45)',
              textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap',
            }}>Symbology</span>
            <select value={mode} onChange={e => setMode(e.target.value as MapMode)}
              style={{
                background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.28)',
                borderRadius: 7, color: C.cyan, fontSize: 11, fontWeight: 700,
                padding: '3px 8px', cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
              }}>
              <option value="adt">Traffic Delay (ADT)</option>
              <option value="surface">Surface Type</option>
              <option value="class">Road Class</option>
            </select>
          </div>

          <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

          {/* Surface pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontSize: 8, fontWeight: 800, color: 'rgba(148,163,184,0.4)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>Surface</span>
            {(['all','paved','unsealed'] as SurfFilter[]).map(sf => (
              <button key={sf} className="tpill" onClick={() => setSurfFilter(sf)}
                style={{
                  borderColor: surfFilter === sf ? 'rgba(0,245,255,0.4)' : 'rgba(255,255,255,0.1)',
                  color: surfFilter === sf ? C.cyan : 'rgba(148,163,184,0.5)',
                  background: surfFilter === sf ? 'rgba(0,245,255,0.1)' : 'transparent',
                }}>
                {sf === 'all' ? 'All' : sf === 'paved' ? 'Paved' : 'Unsealed'}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

          {/* Class pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontSize: 8, fontWeight: 800, color: 'rgba(148,163,184,0.4)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>Class</span>
            {(['all','A','B','C','M'] as ClassFilter[]).map(cf => {
              const col    = cf === 'all' ? '#94a3b8' : CLASS_COLORS[cf] ?? '#94a3b8';
              const active = classFilter === cf;
              return (
                <button key={cf} className="tpill" onClick={() => setClassFilter(cf)}
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

          {/* Legend – right */}
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <MapLegend mode={mode} />
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <MapContainer center={[1.37, 32.3]} zoom={7} zoomControl={false}
            style={{ height: '100%', width: '100%', background: '#0a0f1e' }}>
            <TileLayer url={ESRI_TILE_URLS.imagery}   attribution={ESRI_ATTRIBUTIONS.imagery} />
            <TileLayer url={ESRI_TILE_URLS.labels}    attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.7} />
            <WaterLayers />
            <ZoomControl position="bottomright" />

            {filteredFeatures.length > 0 && (
              <TrafficLayer features={filteredFeatures} mode={mode}
                year={timelineYear} surfMap={surfMap} onSelect={onLinkClick} />
            )}

            {/* TIS manual station markers */}
            {stations.map((feat, i) => {
              const [lng, lat] = feat.geometry?.coordinates ?? [0, 0];
              if (!lat || !lng) return null;
              const p   = feat.properties ?? {};
              const col = REGION_CLR[p.REGION ?? ''] ?? '#94a3b8';
              const icon = makeStationIcon(col, false);
              return (
                <Marker key={`tis-${i}`} position={[lat, lng]} icon={icon}
                  eventHandlers={{ click: () => onStationClick(feat) }}>
                  <LeafletTooltip>
                    <div style={{ fontSize: 10, fontWeight: 700 }}>
                      <div style={{ color: col }}>{p.TCS_NAME}</div>
                      <div style={{ color: 'rgba(226,234,244,0.7)', fontWeight: 400 }}>{p.Link_Name}</div>
                      <div style={{ color: 'rgba(148,163,184,0.45)', fontSize: 9 }}>
                        {p.REGION} · TIS
                      </div>
                    </div>
                  </LeafletTooltip>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Year badge */}
          {timelineYear !== 2025 && (
            <div style={{
              position: 'absolute', top: 12, left: 12, zIndex: 900,
              background: 'rgba(10,15,30,0.92)',
              border: '1px solid rgba(255,210,63,0.35)',
              borderRadius: 10, padding: '5px 12px', backdropFilter: 'blur(12px)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: C.yellow }}>YEAR {timelineYear}</span>
              <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)', marginLeft: 6 }}>
                ×{(GROWTH_FACTORS[timelineYear] ?? 1).toFixed(2)} growth factor
              </span>
            </div>
          )}

          {/* Click hint */}
          <div style={{
            position: 'absolute', bottom: 8, left: 12, zIndex: 900,
            fontSize: 9, color: 'rgba(148,163,184,0.28)', pointerEvents: 'none',
          }}>
            Click a road link or station marker to inspect
          </div>

          {/* Feature analytics overlay */}
          {selFeature && (
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 900 }}>
              <FeatureAnalyticsPanel feature={selFeature}
                onClose={() => setSelFeature(null)} width={310} />
            </div>
          )}
        </div>

        {/* Timeline bar */}
        <div style={{
          height: 54, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 16px',
          background: 'rgba(10,15,30,0.95)',
          borderTop: '1px solid rgba(99,102,241,0.1)',
        }}>
          {/* Date + EAT */}
          <div style={{ flexShrink: 0, minWidth: 180 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.teal }}>{dateStr}</div>
            <div style={{
              fontSize: 9, color: 'rgba(148,163,184,0.45)',
              display: 'flex', alignItems: 'center', gap: 4, marginTop: 1,
            }}>
              <Clock size={9} /> {eatStr} EAT (UTC+3)
            </div>
          </div>

          <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

          {/* LIVE badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: 6,
            background: 'rgba(0,255,136,0.08)',
            border: '1px solid rgba(0,255,136,0.2)',
            flexShrink: 0,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#00ff88',
              boxShadow: '0 0 8px #00ff88',
              display: 'inline-block',
              animation: 'liveBlink 1.8s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 8, fontWeight: 900, color: '#00ff88', letterSpacing: '0.1em' }}>
              LIVE
            </span>
          </div>

          <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

          {/* Play / Pause */}
          <button
            onClick={() => {
              if (timelineYear >= 2035) { setTimelineYear(2016); setIsPlaying(true); }
              else setIsPlaying(p => !p);
            }}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: isPlaying ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.08)',
              color: isPlaying ? C.green : 'rgba(148,163,184,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              animation: isPlaying ? 'playGlow 2s ease-in-out infinite' : 'none',
              transition: 'all .2s',
            }}>
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          {/* Year label */}
          <div style={{ fontSize: 13, fontWeight: 900, color: C.yellow, flexShrink: 0, minWidth: 40 }}>
            {timelineYear}
          </div>

          {/* Slider */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <input type="range" min={2016} max={2035} value={timelineYear}
              onChange={e => { setTimelineYear(Number(e.target.value)); setIsPlaying(false); }}
              style={{ width: '100%', accentColor: C.yellow, cursor: 'pointer' }} />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 8, color: 'rgba(148,163,184,0.32)',
            }}>
              <span>2016</span><span>2020</span><span>2025</span><span>2030</span><span>2035</span>
            </div>
          </div>

          {/* ADT gradient legend */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{
              width: 90, height: 6, borderRadius: 3,
              background: 'linear-gradient(90deg,#00ff88,#ffd23f,#ff6b35,#ff2d78)',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', width: 90 }}>
              <span style={{ fontSize: 7, color: 'rgba(0,255,136,0.6)' }}>Low</span>
              <span style={{ fontSize: 7, color: 'rgba(148,163,184,0.3)' }}>← ADT →</span>
              <span style={{ fontSize: 7, color: 'rgba(255,45,120,0.6)' }}>High</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
