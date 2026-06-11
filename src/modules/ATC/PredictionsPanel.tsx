import { useEffect, useState, useCallback, useMemo } from 'react';
import { CURRENT_YEAR } from '../../shared/year';
import { MapContainer, TileLayer, ZoomControl, GeoJSON } from 'react-leaflet';
import { WaterLayers } from '../../shared/WaterLayers';
import { InfraLayers } from '../../shared/InfraLayers';
import { MapLegend, LEGEND_CONGESTION } from '../../shared/MapLegend';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TrendingUp, Zap, AlertTriangle, Activity, Clock } from 'lucide-react';
import { hexRgb } from '../../lib/chart3d';
import FeatureAnalyticsPanel from '../../shared/FeatureAnalyticsPanel';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PredProps {
  link_id: string;
  link_name: string | null;
  road_no: string | null;
  road_class: string | null;
  region: string | null;
  length_km: number | null;
  aadt_predicted: number | null;
  aadt_lower_95: number | null;
  aadt_upper_95: number | null;
  growth_2025: number | null;
  growth_2030: number | null;
  growth_2040: number | null;
  peak_hour_volume: number | null;
  heavy_vehicle_pct: number | null;
  congestion_risk: string | null;
  congestion_risk_score: number | null;
  top_features: string | string[] | null;
  vehicle_km_daily: number | null;
}
interface PredFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: any };
  properties: PredProps;
}
interface PredSummary {
  total_vehicle_km_daily: number;
  links_at_capacity_risk_pct: number;
  highest_growth_corridor_2040: {
    link_id: string; link_name: string;
    aadt_2025: number; aadt_2040: number;
  };
  congestion_breakdown: Record<string, number>;
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  cyan:   '#00f5ff', green:  '#00ff88', orange: '#ff6b35',
  purple: '#b967ff', yellow: '#ffd23f', pink:   '#ff2d78',
  blue:   '#4d9fff', teal:   '#00d4aa',
};

const CONG: Record<string, { color: string; label: string }> = {
  Low:      { color: '#00ff88', label: 'Low'      },
  Medium:   { color: '#ffd23f', label: 'Medium'   },
  High:     { color: '#ff6b35', label: 'High'     },
  Critical: { color: '#ff2d78', label: 'Critical' },
};

const glass = (accent = C.cyan): React.CSSProperties => ({
  background:     'rgba(2,5,8,0.82)',
  border:         `1px solid rgba(${hexRgb(accent)},0.18)`,
  borderRadius:   14,
  backdropFilter: 'blur(18px)',
});

// ─── Forecast interpolation ───────────────────────────────────────────────────
function getAadtForYear(p: PredProps, year: number): number {
  const g25 = p.growth_2025 ?? p.aadt_predicted ?? 0;
  const g30 = p.growth_2030 ?? g25 * 1.35;
  const g40 = p.growth_2040 ?? g25 * 1.95;
  if (year <= 2025) return g25;
  if (year >= 2040) return g40;
  if (year <= 2030) return Math.round(g25 + ((year - 2025) / 5) * (g30 - g25));
  return Math.round(g30 + ((year - 2030) / 10) * (g40 - g30));
}

const CAPACITY: Record<string, number> = {
  A: 10000, B: 5000, C: 2500, M: 15000, D: 1500,
};

function congestionAtYear(p: PredProps, year: number): string {
  const aadt = getAadtForYear(p, year);
  const cap  = CAPACITY[p.road_class ?? 'C'] ?? 2500;
  const vcr  = aadt / cap;
  if (vcr <= 0.40) return 'Low';
  if (vcr <= 0.70) return 'Medium';
  if (vcr <= 0.90) return 'High';
  return 'Critical';
}

// ─── Real-time estimator ──────────────────────────────────────────────────────
// Uganda peak hour factors: fraction of daily AADT passing in that hour
const PEAK_FACTORS: Record<number, number> = {
  0: 0.018, 1: 0.012, 2: 0.010, 3: 0.010, 4: 0.015, 5: 0.025,
  6: 0.048, 7: 0.075, 8: 0.082, 9: 0.065, 10: 0.055, 11: 0.052,
  12: 0.058, 13: 0.060, 14: 0.062, 15: 0.068, 16: 0.078, 17: 0.085,
  18: 0.072, 19: 0.055, 20: 0.042, 21: 0.035, 22: 0.028, 23: 0.022,
};
// Weekend reduction factor (0=Sun, 6=Sat)
const WEEKEND_FACTOR: Record<number, number> = {
  0: 0.72, 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 0.85, 6: 0.72,
};

function getEatHour(d: Date): number {
  return (d.getUTCHours() + 3) % 24;
}
function getEatDay(d: Date): number {
  return new Date(d.getTime() + 3 * 3_600_000).getUTCDay();
}
function getCurrentVph(aadt_predicted: number, now: Date): number {
  const hourFraction = PEAK_FACTORS[getEatHour(now)] ?? 0.04;
  const weekFactor   = WEEKEND_FACTOR[getEatDay(now)] ?? 1.0;
  return Math.round(aadt_predicted * hourFraction * weekFactor);
}
function getCurrentCongestion(vph: number, road_class: string | null): string {
  const hourCapacity = (CAPACITY[road_class ?? 'C'] ?? 2500) / 10;
  const vcr = vph / hourCapacity;
  if (vcr <= 0.40) return 'Low';
  if (vcr <= 0.70) return 'Medium';
  if (vcr <= 0.90) return 'High';
  return 'Critical';
}
function formatEAT(d: Date): string {
  const h = ((d.getUTCHours() + 3) % 24).toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Map layer ────────────────────────────────────────────────────────────────
function PredLayer({
  features, year, liveMode, now, onSelect,
}: {
  features: PredFeature[];
  year: number;
  liveMode: boolean;
  now: Date;
  onSelect: (p: PredProps) => void;
}) {
  const eatHour = getEatHour(now);

  const styleFeature = useCallback(
    (feat?: PredFeature) => {
      if (!feat) return {};
      let risk: string;
      if (liveMode) {
        const vph = getCurrentVph(feat.properties.aadt_predicted ?? 0, now);
        risk = getCurrentCongestion(vph, feat.properties.road_class);
      } else {
        risk = congestionAtYear(feat.properties, year);
      }
      const color = CONG[risk]?.color ?? '#94a3b8';
      return {
        color,
        weight: feat.properties.road_class === 'A' ? 3.5
              : feat.properties.road_class === 'B' ? 2.5
              : feat.properties.road_class === 'M' ? 4.0
              : 1.8,
        opacity: 0.85,
        fillOpacity: 0,
      };
    },
    // Re-memo when year changes (forecast) or EAT hour changes (live)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [year, liveMode, eatHour]
  );

  const onEach = useCallback(
    (feat: PredFeature, layer: L.Layer) => {
      (layer as L.Path).on({
        click: () => onSelect(feat.properties),
        mouseover: (e: L.LeafletMouseEvent) => {
          (e.target as L.Path).setStyle({ weight: 5, opacity: 1 });
        },
        mouseout: (e: L.LeafletMouseEvent) => {
          (e.target as L.Path).setStyle(styleFeature(feat) as L.PathOptions);
        },
      });
    },
    [onSelect, styleFeature]
  );

  const geojson = useMemo(
    () => ({ type: 'FeatureCollection' as const, features }),
    [features]
  );

  // Key forces full remount: changes when hour changes (live) or year changes (forecast)
  const layerKey = liveMode ? `live-${eatHour}` : year;

  return (
    <GeoJSON
      key={layerKey}
      data={geojson as any}
      style={styleFeature as any}
      onEachFeature={onEach as any}
    />
  );
}

// ─── Popup detail card ────────────────────────────────────────────────────────
function LinkPopup({
  p, year, liveMode, now, onClose,
}: {
  p: PredProps; year: number; liveMode: boolean; now: Date; onClose: () => void;
}) {
  const topFeats = useMemo(() => {
    if (!p.top_features) return [];
    if (Array.isArray(p.top_features)) return p.top_features;
    try { return JSON.parse(p.top_features as string); } catch { return []; }
  }, [p.top_features]);

  const currentVph  = liveMode ? getCurrentVph(p.aadt_predicted ?? 0, now) : null;
  const risk  = liveMode && currentVph !== null
    ? getCurrentCongestion(currentVph, p.road_class)
    : congestionAtYear(p, year);
  const aadt  = getAadtForYear(p, year);
  const color = CONG[risk]?.color ?? '#94a3b8';

  return (
    <div style={{
      ...glass(color),
      padding: '14px 16px',
      minWidth: 260, maxWidth: 320,
      color: '#e2eaf4', fontSize: 11,
      boxShadow: `0 0 28px rgba(${hexRgb(color)},0.25)`,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:900, color, marginBottom:2 }}>
            {p.link_name ?? p.link_id}
          </div>
          <div style={{ fontSize:9, color:'rgba(148,163,184,0.6)', letterSpacing:'0.05em' }}>
            {p.road_no ?? ''} · {p.road_class}-class · {p.region ?? ''}
          </div>
        </div>
        <button onClick={onClose} style={{
          background:'none', border:'none', color:'rgba(148,163,184,0.5)',
          cursor:'pointer', fontSize:14, lineHeight:1, padding:0, marginLeft:8,
        }}>✕</button>
      </div>

      {/* Congestion badge */}
      <div style={{
        display:'inline-flex', alignItems:'center', gap:5,
        background:`rgba(${hexRgb(color)},0.15)`,
        border:`1px solid rgba(${hexRgb(color)},0.4)`,
        borderRadius:6, padding:'3px 10px', marginBottom:10,
        fontSize:10, fontWeight:800, color,
      }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:color, display:'inline-block' }}/>
        {risk} · {liveMode ? `Live ${formatEAT(now)} EAT` : String(year)}
      </div>

      {/* AADT / VPH + CI */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
        {liveMode && currentVph !== null ? (
          <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 10px' }}>
            <div style={{ fontSize:18, fontWeight:900, color:'#fff' }}>
              {currentVph.toLocaleString()}
            </div>
            <div style={{ fontSize:9, color:'rgba(148,163,184,0.6)' }}>Est. veh/hr (now)</div>
            <div style={{ fontSize:9, color:`rgba(${hexRgb(color)},0.7)`, marginTop:3 }}>
              AADT base: {(p.aadt_predicted ?? 0).toLocaleString()}
            </div>
          </div>
        ) : (
          <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 10px' }}>
            <div style={{ fontSize:18, fontWeight:900, color:'#fff' }}>
              {aadt.toLocaleString()}
            </div>
            <div style={{ fontSize:9, color:'rgba(148,163,184,0.6)' }}>Predicted AADT (veh/day)</div>
            <div style={{ fontSize:9, color:`rgba(${hexRgb(color)},0.7)`, marginTop:3 }}>
              95% CI: {(p.aadt_lower_95 ?? 0).toLocaleString()}–{(p.aadt_upper_95 ?? 0).toLocaleString()}
            </div>
          </div>
        )}
        <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 10px' }}>
          <div style={{ fontSize:18, fontWeight:900, color:C.orange }}>
            {(p.peak_hour_volume ?? 0).toLocaleString()}
          </div>
          <div style={{ fontSize:9, color:'rgba(148,163,184,0.6)' }}>Peak hour (AM)</div>
          <div style={{ fontSize:9, color:`rgba(${hexRgb(C.orange)},0.7)`, marginTop:3 }}>
            Heavy: {(p.heavy_vehicle_pct ?? 0).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Forecast row (only in forecast mode) */}
      {!liveMode && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, marginBottom:10 }}>
          {[2025, 2030, 2040].map(yr => {
            const v   = getAadtForYear(p, yr);
            const r   = congestionAtYear(p, yr);
            const col = CONG[r]?.color ?? '#94a3b8';
            return (
              <div key={yr} style={{
                background: yr === year ? `rgba(${hexRgb(col)},0.14)` : 'rgba(255,255,255,0.04)',
                border: `1px solid rgba(${hexRgb(col)},${yr === year ? '0.4' : '0.12'})`,
                borderRadius:7, padding:'6px 8px', textAlign:'center',
              }}>
                <div style={{ fontSize:11, fontWeight:900, color:col }}>
                  {(v/1000).toFixed(0)}k
                </div>
                <div style={{ fontSize:8, color:'rgba(148,163,184,0.5)', marginTop:1 }}>{yr}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* SHAP top features */}
      {topFeats.length > 0 && (
        <div>
          <div style={{ fontSize:9, fontWeight:700, color:'rgba(148,163,184,0.5)',
            textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5 }}>
            Top model drivers
          </div>
          {topFeats.slice(0, 3).map((f: string, i: number) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:6,
              marginBottom:3, fontSize:10, color:'rgba(226,234,244,0.8)',
            }}>
              <span style={{
                fontSize:8, fontWeight:900, color: [C.cyan, C.green, C.yellow][i],
                background:`rgba(${hexRgb([C.cyan, C.green, C.yellow][i])},0.12)`,
                borderRadius:4, padding:'1px 5px',
              }}>{i + 1}</span>
              {f}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PredictionsPanel() {
  const [features,   setFeatures]   = useState<PredFeature[]>([]);
  const [summary,    setSummary]    = useState<PredSummary | null>(null);
  const [forecastYr, setForecastYr] = useState<number>(CURRENT_YEAR);
  const [selLink,    setSelLink]    = useState<PredProps | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [liveMode,   setLiveMode]   = useState(false);
  const [now,        setNow]        = useState(() => new Date());

  // Auto-refresh every 60s when live mode is on
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, [liveMode]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/traffic_predictions.geojson`).then(r => r.json()),
      fetch(`${base}data/traffic_summary.json`).then(r => r.json()),
    ]).then(([gj, summ]) => {
      setFeatures((gj.features ?? []) as PredFeature[]);
      setSummary(summ as PredSummary);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  // ── Forecast KPIs ──
  const forecastKpis = useMemo(() => {
    if (!features.length) return null;
    const totalVkm = features.reduce((sum, f) => {
      const aadt = getAadtForYear(f.properties, forecastYr);
      return sum + aadt * (f.properties.length_km ?? 0);
    }, 0);
    const atRisk = features.filter(f => {
      const r = congestionAtYear(f.properties, forecastYr);
      return r === 'High' || r === 'Critical';
    }).length;
    const pctRisk = (atRisk / features.length * 100).toFixed(1);
    return { totalVkm, atRisk, pctRisk };
  }, [features, forecastYr]);

  // ── Live KPIs (recomputed each minute tick) ──
  const liveKpis = useMemo(() => {
    if (!features.length) return null;
    let totalVph = 0;
    let maxVph = 0;
    let peakFeature: PredFeature | null = null;
    let congestedCount = 0;
    for (const f of features) {
      const vph = getCurrentVph(f.properties.aadt_predicted ?? 0, now);
      totalVph += vph;
      if (vph > maxVph) { maxVph = vph; peakFeature = f; }
      if (['High', 'Critical'].includes(getCurrentCongestion(vph, f.properties.road_class))) {
        congestedCount++;
      }
    }
    return { totalVph, maxVph, peakFeature, congestedCount };
  }, [features, now]);

  const topCorridor = summary?.highest_growth_corridor_2040;
  const eatTimeStr  = formatEAT(now);
  const eatDayName  = DAY_NAMES[getEatDay(now)];

  const sectionHead = (label: string, icon: React.ReactNode, color: string) => (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
      <span style={{ color, filter:`drop-shadow(0 0 6px ${color})` }}>{icon}</span>
      <span style={{ fontSize:13, fontWeight:800, color, letterSpacing:'0.04em',
        textShadow:`0 0 14px rgba(${hexRgb(color)},0.5)` }}>{label}</span>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg, rgba(${hexRgb(color)},0.4), transparent)` }}/>
    </div>
  );

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
        height:400, color:'rgba(148,163,184,0.5)', fontSize:13 }}>
        Loading prediction data…
      </div>
    );
  }

  const accentColor = liveMode ? C.green : C.purple;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <style>{`@keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.55;transform:scale(1.4)}}`}</style>

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:800, color:`rgba(${hexRgb(accentColor)},0.5)`,
            letterSpacing:'0.18em', textTransform:'uppercase' }}>
            {liveMode ? 'REAL-TIME ESTIMATE · EAT CLOCK · PEAK FACTOR MODEL' : 'ST-GNN / XGBOOST ENSEMBLE · SPATIAL INTERPOLATION'}
          </div>
          <div style={{ fontSize:20, fontWeight:900, color: accentColor,
            textShadow:`0 0 20px rgba(${hexRgb(accentColor)},0.5)`, letterSpacing:'0.02em' }}>
            {liveMode ? 'Live Traffic Estimator' : 'Traffic Forecast Map'}
          </div>
          <div style={{ fontSize:11, color:'rgba(148,163,184,0.6)', marginTop:3 }}>
            {liveMode
              ? `Estimated current-hour vehicle flow · All ${features.length} road links · Updates every 60 s`
              : `ML predictions for all ${features.length} road links · Spatial-temporal model trained 2018–2025`}
          </div>
        </div>

        {/* Controls: live toggle + slider or clock */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' }}>

          {/* Live Estimate toggle */}
          <button
            onClick={() => { setLiveMode(m => !m); setNow(new Date()); }}
            style={{
              fontSize:10, fontWeight:800, padding:'6px 14px', borderRadius:8, cursor:'pointer',
              background: liveMode ? `rgba(${hexRgb(C.green)},0.18)` : 'rgba(255,255,255,0.06)',
              border: `1px solid ${liveMode ? C.green : 'rgba(255,255,255,0.15)'}`,
              color: liveMode ? C.green : 'rgba(148,163,184,0.7)',
              transition: 'all 0.2s', display:'flex', alignItems:'center', gap:6,
            }}
          >
            <span style={{
              width:7, height:7, borderRadius:'50%',
              background: liveMode ? C.green : 'rgba(148,163,184,0.35)',
              boxShadow: liveMode ? `0 0 8px ${C.green}` : 'none',
              display:'inline-block',
              animation: liveMode ? 'livePulse 2s ease-in-out infinite' : 'none',
            }}/>
            LIVE ESTIMATE
          </button>

          {liveMode ? (
            /* EAT clock card */
            <div style={{ ...glass(C.green), padding:'10px 16px', minWidth:220 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                <Clock size={13} style={{ color: C.green }}/>
                <span style={{ fontSize:10, fontWeight:800, color:C.green, letterSpacing:'0.05em' }}>
                  LIVE: {eatTimeStr} EAT
                </span>
              </div>
              <div style={{ fontSize:22, fontWeight:900, color:'#fff', letterSpacing:'0.06em', lineHeight:1 }}>
                {eatTimeStr}
              </div>
              <div style={{ fontSize:9, color:'rgba(148,163,184,0.5)', marginTop:4 }}>
                {eatDayName} · East Africa Time (UTC+3) · Updates every 60 s
              </div>
            </div>
          ) : (
            /* Forecast year slider */
            <div style={{ ...glass(C.yellow), padding:'10px 16px', minWidth:220 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <span style={{ fontSize:10, fontWeight:800, color:C.yellow, letterSpacing:'0.05em' }}>
                  FORECAST YEAR
                </span>
                <span style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{forecastYr}</span>
              </div>
              <input type="range" min={2025} max={2040} step={1}
                value={forecastYr}
                onChange={e => setForecastYr(Number(e.target.value))}
                style={{ width:'100%', accentColor: C.yellow, cursor:'pointer' }}
              />
              <div style={{ display:'flex', justifyContent:'space-between',
                fontSize:8, color:'rgba(148,163,184,0.45)', marginTop:2 }}>
                <span>2025</span><span>2030</span><span>2040</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Strip ── */}
      {liveMode ? (
        /* Live KPIs */
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[
            {
              label: 'Current time (EAT)',
              value: eatTimeStr,
              sub:   `${eatDayName} · Hour factor ${((PEAK_FACTORS[getEatHour(now)] ?? 0.04) * 100).toFixed(1)}%`,
              color: C.green, icon: <Clock size={16}/>,
            },
            {
              label: 'Est. peak corridor',
              value: liveKpis?.maxVph ? `${liveKpis.maxVph.toLocaleString()}` : '—',
              sub:   liveKpis?.peakFeature?.properties.link_name ?? 'Loading…',
              color: C.orange, icon: <TrendingUp size={16}/>,
            },
            {
              label: 'Links congested now',
              value: liveKpis ? String(liveKpis.congestedCount) : '—',
              sub:   `High + Critical · ${features.length} links total`,
              color: C.pink, icon: <AlertTriangle size={16}/>,
            },
            {
              label: 'Network load now',
              value: liveKpis ? `${((liveKpis.totalVph) / 1000).toFixed(0)}k` : '—',
              sub:   'Total veh/hr across all links',
              color: C.cyan, icon: <Activity size={16}/>,
            },
          ].map(kpi => (
            <div key={kpi.label} style={{
              ...glass(kpi.color),
              padding:'14px 16px', display:'flex', flexDirection:'column', gap:5,
              boxShadow:`0 0 24px rgba(${hexRgb(kpi.color)},0.08)`,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ color:kpi.color, opacity:0.85 }}>{kpi.icon}</span>
                <span style={{ fontSize:9, fontWeight:700, color:'rgba(148,163,184,0.6)',
                  textTransform:'uppercase', letterSpacing:'0.1em' }}>{kpi.label}</span>
              </div>
              <div style={{ fontSize:24, fontWeight:900, color:kpi.color, lineHeight:1,
                textShadow:`0 0 20px rgba(${hexRgb(kpi.color)},0.5)` }}>{kpi.value}</div>
              <div style={{ fontSize:9, color:'rgba(148,163,184,0.5)' }}>{kpi.sub}</div>
            </div>
          ))}
        </div>
      ) : (
        /* Forecast KPIs */
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[
            {
              label: 'Vehicle-km/day',
              value: forecastKpis ? `${((forecastKpis.totalVkm)/1e6).toFixed(0)}M` : '—',
              sub:   `Network total · ${forecastYr}`,
              color: C.cyan, icon: <Activity size={16}/>,
            },
            {
              label: 'Links at Capacity Risk',
              value: forecastKpis ? `${forecastKpis.pctRisk}%` : '—',
              sub:   `High + Critical (${forecastKpis?.atRisk ?? 0} links)`,
              color: C.pink, icon: <AlertTriangle size={16}/>,
            },
            {
              label: 'Highest Growth Corridor',
              value: topCorridor ? `+${Math.round((topCorridor.aadt_2040 / topCorridor.aadt_2025 - 1)*100)}%` : '—',
              sub:   topCorridor?.link_name ?? 'Loading…',
              color: C.green, icon: <TrendingUp size={16}/>,
            },
            {
              label: 'Predicted Data Coverage',
              value: `${features.filter(f => !f.properties.aadt_predicted).length === 0 ? '100' : ((features.filter(f => f.properties.aadt_predicted).length / features.length)*100).toFixed(0)}%`,
              sub:   `${features.length} links modelled`,
              color: C.teal, icon: <Zap size={16}/>,
            },
          ].map(kpi => (
            <div key={kpi.label} style={{
              ...glass(kpi.color),
              padding:'14px 16px', display:'flex', flexDirection:'column', gap:5,
              boxShadow:`0 0 24px rgba(${hexRgb(kpi.color)},0.08)`,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ color:kpi.color, opacity:0.85 }}>{kpi.icon}</span>
                <span style={{ fontSize:9, fontWeight:700, color:'rgba(148,163,184,0.6)',
                  textTransform:'uppercase', letterSpacing:'0.1em' }}>{kpi.label}</span>
              </div>
              <div style={{ fontSize:24, fontWeight:900, color:kpi.color, lineHeight:1,
                textShadow:`0 0 20px rgba(${hexRgb(kpi.color)},0.5)` }}>{kpi.value}</div>
              <div style={{ fontSize:9, color:'rgba(148,163,184,0.5)' }}>{kpi.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Map + popup side-by-side ── */}
      <div style={{ display:'grid', gridTemplateColumns: selLink ? '1fr 300px' : '1fr', gap:12 }}>

        <div style={{ ...glass(accentColor), padding:12 }}>
          {sectionHead(
            liveMode
              ? `Road Network · Live Estimate · ${eatTimeStr} EAT`
              : `Road Network · Congestion Risk ${forecastYr}`,
            liveMode ? <Clock size={14}/> : <AlertTriangle size={14}/>,
            accentColor,
          )}

          {/* Legend */}
          <div style={{ display:'flex', gap:10, marginBottom:8, flexWrap:'wrap' }}>
            {Object.entries(CONG).map(([key, { color, label }]) => (
              <div key={key} style={{ display:'flex', alignItems:'center', gap:5,
                fontSize:9, fontWeight:700, color }}>
                <span style={{ width:18, height:3, background:color,
                  borderRadius:2, display:'inline-block',
                  boxShadow:`0 0 6px ${color}` }}/>
                {label}
              </div>
            ))}
            {liveMode && (
              <div style={{ marginLeft:'auto', fontSize:9, color:C.green, fontWeight:700,
                display:'flex', alignItems:'center', gap:4 }}>
                <span style={{
                  width:6, height:6, borderRadius:'50%', background:C.green,
                  display:'inline-block', animation:'livePulse 2s ease-in-out infinite',
                  boxShadow:`0 0 6px ${C.green}`,
                }}/>
                LIVE · {eatTimeStr}
              </div>
            )}
          </div>

          <div style={{ borderRadius:10, overflow:'hidden', height:520,
            boxShadow:`0 0 28px rgba(${hexRgb(accentColor)},0.15)` }}>
            {features.length > 0 && (
              <MapContainer center={[1.37, 32.3]} zoom={6} zoomControl={false}
                style={{ height:'100%', width:'100%', background:'#020508' }}>
                <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery}/>
                <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.7}/>
                <WaterLayers />
                <InfraLayers />
                <MapLegend title="Congestion" items={LEGEND_CONGESTION} />
                <ZoomControl position="bottomright"/>
                <PredLayer
                  features={features}
                  year={forecastYr}
                  liveMode={liveMode}
                  now={now}
                  onSelect={p => setSelLink(p)}
                />
              </MapContainer>
            )}
          </div>

          <div style={{ marginTop:8, fontSize:9, color:'rgba(100,116,139,0.45)' }}>
            {liveMode
              ? `Click any road link · Colours = estimated current-hour congestion · Road line weight = road class`
              : `Click any road link to view predictions · Road line weight = road class`}
          </div>
        </div>

        {/* Link detail panel */}
        {selLink && (
          <FeatureAnalyticsPanel
            feature={{
              type: 'road-link',
              name: selLink.link_name ?? selLink.link_id,
              roadClass: selLink.road_class ?? '',
              lengthKm: selLink.length_km ?? 0,
              surface: 'Bituminous',
              region: selLink.region ?? undefined,
              aadt: selLink.aadt_predicted ?? undefined,
              congestionRisk: selLink.congestion_risk ?? undefined,
              forecast2030: selLink.growth_2030 ?? undefined,
              forecast2040: selLink.growth_2040 ?? undefined,
            }}
            onClose={() => setSelLink(null)}
            width={300}
          />
        )}
      </div>

      {/* ── Congestion breakdown table (forecast mode only) ── */}
      {!liveMode && (
        <div style={{ ...glass(C.orange), padding:14 }}>
          {sectionHead('Congestion Risk Breakdown by Road Class', <AlertTriangle size={14}/>, C.orange)}
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,107,53,0.2)' }}>
                  {['Risk Level','Links','% of Network','Road Weight','Action'].map(h => (
                    <th key={h} style={{ padding:'5px 10px', textAlign:'left',
                      fontSize:9, fontWeight:800, color:'rgba(255,107,53,0.7)',
                      textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['Critical','High','Medium','Low'].map(level => {
                  const linksAtLevel = features.filter(
                    f => congestionAtYear(f.properties, forecastYr) === level
                  ).length;
                  const pct = (linksAtLevel / features.length * 100).toFixed(1);
                  const col = CONG[level]?.color ?? '#94a3b8';
                  const action = level === 'Critical' ? 'Immediate capacity upgrade'
                               : level === 'High'     ? 'Plan capacity improvement'
                               : level === 'Medium'   ? 'Monitor traffic growth'
                               :                        'Routine maintenance';
                  return (
                    <tr key={level} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding:'6px 10px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <span style={{ width:10, height:10, borderRadius:'50%',
                            background:col, boxShadow:`0 0 6px ${col}`,
                            display:'inline-block' }}/>
                          <span style={{ fontWeight:800, color:col }}>{level}</span>
                        </div>
                      </td>
                      <td style={{ padding:'6px 10px', fontWeight:700, color:'#fff' }}>{linksAtLevel}</td>
                      <td style={{ padding:'6px 10px', color:'rgba(148,163,184,0.7)' }}>{pct}%</td>
                      <td style={{ padding:'6px 10px', color:'rgba(148,163,184,0.5)', fontSize:9 }}>
                        {level === 'Critical' ? 'A/M class priority' : level === 'High' ? 'B class review' : '—'}
                      </td>
                      <td style={{ padding:'6px 10px', fontSize:9, color:'rgba(148,163,184,0.6)' }}>{action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:8, fontSize:9, color:'rgba(100,116,139,0.4)' }}>
            Congestion risk = predicted AADT ÷ design capacity (Uganda roads standard) ·
            Capacity: M-class 15k, A-class 10k, B-class 5k, C-class 2.5k PCU/day ·
            Model: XGBoost + LightGBM ensemble, spatial-lag features, trained 2018–2025
          </div>
        </div>
      )}

      {/* ── Live congestion distribution (live mode only) ── */}
      {liveMode && (
        <div style={{ ...glass(C.green), padding:14 }}>
          {sectionHead(`Live Congestion Distribution · ${eatTimeStr} EAT`, <Clock size={14}/>, C.green)}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {['Critical','High','Medium','Low'].map(level => {
              const count = features.filter(f => {
                const vph = getCurrentVph(f.properties.aadt_predicted ?? 0, now);
                return getCurrentCongestion(vph, f.properties.road_class) === level;
              }).length;
              const pct  = (count / features.length * 100).toFixed(1);
              const col  = CONG[level]?.color ?? '#94a3b8';
              return (
                <div key={level} style={{
                  background:`rgba(${hexRgb(col)},0.07)`,
                  border:`1px solid rgba(${hexRgb(col)},0.2)`,
                  borderRadius:10, padding:'12px 14px', textAlign:'center',
                }}>
                  <div style={{ fontSize:24, fontWeight:900, color:col,
                    textShadow:`0 0 16px rgba(${hexRgb(col)},0.5)` }}>{count}</div>
                  <div style={{ fontSize:9, fontWeight:800, color:col, marginTop:3 }}>{level}</div>
                  <div style={{ fontSize:9, color:'rgba(148,163,184,0.5)', marginTop:2 }}>{pct}% of network</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:10, fontSize:9, color:'rgba(100,116,139,0.4)' }}>
            Hourly congestion = estimated veh/hr ÷ (daily capacity / 10) ·
            Peak factors derived from Uganda ATC survey data · Weekend reduction: Sat 0.85×, Sun 0.72×
          </div>
        </div>
      )}

    </div>
  );
}
