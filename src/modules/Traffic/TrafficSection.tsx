import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  MapContainer, TileLayer, ZoomControl, GeoJSON,
  CircleMarker, Tooltip as LeafletTooltip,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Activity, AlertTriangle, Clock, MapPin, TrendingUp, Zap } from 'lucide-react';
import { hexRgb } from '../../lib/chart3d';
import FeatureAnalyticsPanel from '../../shared/FeatureAnalyticsPanel';
import type { FeatureData, RoadLinkFeature, AtcStationFeature } from '../../shared/FeatureAnalyticsPanel';
import { CONGESTION_COLORS } from '../../shared/mapSymbols';

// ─── Types ────────────────────────────────────────────────────────────────────
type AttrMode = 'live' | 'aadt' | 'heavy' | 'surface' | 'forecast2030' | 'forecast2040' | 'stations';

interface PredProps {
  link_id: string;
  link_name: string | null;
  road_no: string | null;
  road_class: string | null;
  region: string | null;
  length_km: number | null;
  aadt_predicted: number | null;
  growth_2030: number | null;
  growth_2040: number | null;
  heavy_vehicle_pct: number | null;
  congestion_risk: string | null;
  vehicle_km_daily: number | null;
}
interface PredFeature {
  type: 'Feature';
  geometry: any;
  properties: PredProps;
}
interface PredSummary {
  total_vehicle_km_daily: number;
  highest_growth_corridor_2040: { link_name: string; aadt_2025: number; aadt_2040: number };
  congestion_breakdown: Record<string, number>;
}

// ─── Real-time estimator ──────────────────────────────────────────────────────
const PEAK_FACTORS: Record<number, number> = {
  0: 0.018, 1: 0.012, 2: 0.010, 3: 0.010, 4: 0.015, 5: 0.025,
  6: 0.048, 7: 0.075, 8: 0.082, 9: 0.065, 10: 0.055, 11: 0.052,
  12: 0.058, 13: 0.060, 14: 0.062, 15: 0.068, 16: 0.078, 17: 0.085,
  18: 0.072, 19: 0.055, 20: 0.042, 21: 0.035, 22: 0.028, 23: 0.022,
};
const WEEKEND_FACTOR: Record<number, number> = { 0: 0.72, 1: 1, 2: 1, 3: 1, 4: 1, 5: 0.85, 6: 0.72 };
const CAPACITY: Record<string, number> = { A: 10000, B: 5000, C: 2500, M: 15000, D: 1500 };

function getEatHour(d: Date) { return (d.getUTCHours() + 3) % 24; }
function getEatDay(d: Date) { return new Date(d.getTime() + 3 * 3_600_000).getUTCDay(); }
function getCurrentVph(aadt: number, now: Date) {
  return Math.round(aadt * (PEAK_FACTORS[getEatHour(now)] ?? 0.04) * (WEEKEND_FACTOR[getEatDay(now)] ?? 1));
}
function vcr2risk(vcr: number): string {
  if (vcr <= 0.4) return 'Low';
  if (vcr <= 0.7) return 'Medium';
  if (vcr <= 0.9) return 'High';
  return 'Critical';
}
function formatEAT(d: Date) {
  const h = ((d.getUTCHours() + 3) % 24).toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  cyan: '#00f5ff', green: '#00ff88', orange: '#ff6b35',
  purple: '#b967ff', yellow: '#ffd23f', pink: '#ff2d78',
  blue: '#4d9fff', teal: '#00d4aa',
};
const CONG = CONGESTION_COLORS;

const REGION_CLR: Record<string, string> = {
  Central: C.cyan,   Eastern: C.orange, East: C.orange,
  Northern: C.purple, North: C.purple, 'North East': C.pink,
  Western: C.green,  West: C.green,    South: C.yellow,
};

const glass = (accent: string): React.CSSProperties => ({
  background: 'rgba(2,5,8,0.88)',
  border: `1px solid rgba(${hexRgb(accent)},0.2)`,
  borderRadius: 12,
  backdropFilter: 'blur(18px)',
});

// ─── Attribute mode config ────────────────────────────────────────────────────
interface ModeConf { label: string; color: string; desc: string }
const MODES: Record<AttrMode, ModeConf> = {
  live:         { label: 'Live Now',       color: C.green,  desc: 'Current-hour vph' },
  aadt:         { label: 'AADT',           color: C.cyan,   desc: 'Annual avg traffic' },
  heavy:        { label: 'Heavy %',        color: C.orange, desc: '% heavy vehicles' },
  surface:      { label: 'Surface',        color: C.yellow, desc: 'Paved / unpaved' },
  forecast2030: { label: 'Forecast 2030',  color: C.purple, desc: 'Projected congestion' },
  forecast2040: { label: 'Forecast 2040',  color: C.pink,   desc: 'Long-term forecast' },
  stations:     { label: 'Count Stations', color: C.teal,   desc: '298 ATC station network' },
};

// ─── Per-feature color function ───────────────────────────────────────────────
function featureColor(
  p: PredProps, mode: AttrMode, now: Date, surfMap: Record<string, string>,
): string {
  const aadt = p.aadt_predicted ?? 0;
  const cap  = CAPACITY[p.road_class ?? 'C'] ?? 2500;
  switch (mode) {
    case 'live': {
      const vph = getCurrentVph(aadt, now);
      return CONG[vcr2risk(vph / (cap / 10))] ?? '#94a3b8';
    }
    case 'aadt':
      if (aadt < 500)   return C.blue;
      if (aadt < 2000)  return C.green;
      if (aadt < 5000)  return C.yellow;
      if (aadt < 10000) return C.orange;
      return C.pink;
    case 'heavy': {
      const pct = p.heavy_vehicle_pct ?? 0;
      if (pct < 10) return C.green;
      if (pct < 25) return C.yellow;
      if (pct < 40) return C.orange;
      return C.pink;
    }
    case 'surface': {
      const s = surfMap[p.link_id] ?? 'unknown';
      return s === 'paved' ? C.cyan : s === 'unpaved' ? '#ff8c00' : '#6B7280';
    }
    case 'forecast2030': {
      const a = p.growth_2030 ?? aadt;
      return CONG[vcr2risk(a / cap)] ?? '#94a3b8';
    }
    case 'forecast2040': {
      const a = p.growth_2040 ?? aadt;
      return CONG[vcr2risk(a / cap)] ?? '#94a3b8';
    }
    case 'stations':
      return 'rgba(148,163,184,0.2)';
    default:
      return '#94a3b8';
  }
}

function roadWeight(rc: string | null): number {
  if (rc === 'M') return 4.0;
  if (rc === 'A') return 3.0;
  if (rc === 'B') return 2.0;
  return 1.5;
}

// ─── Map layer ────────────────────────────────────────────────────────────────
function TrafficLayer({
  features, mode, now, surfMap, onSelect,
}: {
  features: PredFeature[];
  mode: AttrMode;
  now: Date;
  surfMap: Record<string, string>;
  onSelect: (p: PredProps) => void;
}) {
  const eatHour = getEatHour(now);

  const styleFeat = useCallback(
    (feat?: PredFeature) => {
      if (!feat?.properties) return {};
      const color = featureColor(feat.properties, mode, now, surfMap);
      return {
        color,
        weight: roadWeight(feat.properties.road_class),
        opacity: mode === 'stations' ? 0.25 : 0.9,
        fillOpacity: 0,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, eatHour, surfMap],
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

  const geojson = useMemo(() => ({ type: 'FeatureCollection' as const, features }), [features]);
  // Force remount when mode changes; in live mode, also when EAT hour changes
  const layerKey = mode === 'live' ? `live-${eatHour}` : mode;

  return (
    <GeoJSON
      key={layerKey}
      data={geojson as any}
      style={styleFeat as any}
      onEachFeature={onEach as any}
    />
  );
}

// ─── Legend strip ─────────────────────────────────────────────────────────────
function Legend({ mode }: { mode: AttrMode }) {
  if (mode === 'aadt') {
    const items = [['<500','#4d9fff'],['500–2k',C.green],['2k–5k',C.yellow],['5k–10k',C.orange],['>10k',C.pink]];
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(([l, c]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: c }}>
            <span style={{ width: 14, height: 3, background: c, borderRadius: 2, display: 'inline-block' }}/>{l}
          </span>
        ))}
      </div>
    );
  }
  if (mode === 'heavy') {
    const items = [['<10%',C.green],['10–25%',C.yellow],['25–40%',C.orange],['>40%',C.pink]];
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(([l, c]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: c }}>
            <span style={{ width: 14, height: 3, background: c, borderRadius: 2, display: 'inline-block' }}/>{l}
          </span>
        ))}
      </div>
    );
  }
  if (mode === 'surface') {
    const items = [['Paved',C.cyan],['Unpaved','#ff8c00'],['Unknown','#6B7280']];
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        {items.map(([l, c]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: c }}>
            <span style={{ width: 14, height: 3, background: c, borderRadius: 2, display: 'inline-block' }}/>{l}
          </span>
        ))}
      </div>
    );
  }
  if (mode === 'stations') {
    const items = [['Central',C.cyan],['Eastern',C.orange],['Northern',C.purple],['Western',C.green]];
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {items.map(([l, c]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: c }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block' }}/>{l}
          </span>
        ))}
      </div>
    );
  }
  // live / forecast → congestion palette
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {['Low','Medium','High','Critical'].map(r => (
        <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: CONG[r] }}>
          <span style={{ width: 14, height: 3, background: CONG[r], borderRadius: 2, display: 'inline-block' }}/>{r}
        </span>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function TrafficSection() {
  const [features,   setFeatures]   = useState<PredFeature[]>([]);
  const [surfMap,    setSurfMap]    = useState<Record<string, string>>({});
  const [stations,   setStations]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [mode,       setMode]       = useState<AttrMode>('live');
  const [now,        setNow]        = useState(() => new Date());
  const [selFeature, setSelFeature] = useState<FeatureData | null>(null);

  // Live refresh
  useEffect(() => {
    if (mode !== 'live') return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [mode]);

  // Data load
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/traffic_predictions.geojson`).then(r => r.json()),
      fetch(`${base}data/road_surface.json`).then(r => r.json()),
      fetch(`${base}atc_stations.geojson`).then(r => r.json()),
    ]).then(([gj, surf, statGJ]) => {
      setFeatures((gj.features ?? []) as PredFeature[]);
      setSurfMap(surf as Record<string, string>);
      setStations((statGJ.features ?? []) as any[]);
      setLoading(false);
    }).catch(err => { console.error('TrafficSection load:', err); setLoading(false); });
  }, []);

  // Link_ID → prediction lookup (for station click)
  const predByLink = useMemo(
    () => new Map(features.map(f => [f.properties.link_id, f.properties])),
    [features],
  );

  // ── KPI derivations ──
  const kpis = useMemo(() => {
    if (!features.length) return null;
    const totalVkm = features.reduce((s, f) => s + (f.properties.vehicle_km_daily ?? 0), 0);
    const totalKm  = features.reduce((s, f) => s + (f.properties.length_km ?? 0), 0);
    const avgAadt  = features.reduce((s, f) => s + (f.properties.aadt_predicted ?? 0), 0) / features.length;
    const totalVph = features.reduce((s, f) => s + getCurrentVph(f.properties.aadt_predicted ?? 0, now), 0);

    let crit = 0, high = 0, med = 0, low = 0;
    for (const f of features) {
      const p   = f.properties;
      const cap = CAPACITY[p.road_class ?? 'C'] ?? 2500;
      const aadt = p.aadt_predicted ?? 0;
      let risk: string;
      if (mode === 'live') {
        risk = vcr2risk(getCurrentVph(aadt, now) / (cap / 10));
      } else if (mode === 'forecast2030') {
        risk = vcr2risk((p.growth_2030 ?? aadt) / cap);
      } else if (mode === 'forecast2040') {
        risk = vcr2risk((p.growth_2040 ?? aadt) / cap);
      } else {
        risk = vcr2risk(aadt / cap);
      }
      if (risk === 'Critical') crit++;
      else if (risk === 'High') high++;
      else if (risk === 'Medium') med++;
      else low++;
    }

    const peakFeat = features.reduce(
      (best, f) => (f.properties.aadt_predicted ?? 0) > (best.properties.aadt_predicted ?? 0) ? f : best,
      features[0],
    );

    return { totalVkm, totalKm, avgAadt, totalVph, crit, high, med, low, peakFeat };
  }, [features, mode, now]);

  // ── Feature click handlers ──
  function onLinkClick(p: PredProps) {
    const surf = surfMap[p.link_id];
    const rf: RoadLinkFeature = {
      type: 'road-link',
      name: p.link_name ?? p.link_id,
      roadClass: p.road_class ?? '?',
      lengthKm: p.length_km ?? 0,
      surface: surf === 'paved' ? 'Bituminous' : surf === 'unpaved' ? 'Unsealed' : 'Unknown',
      region: p.region ?? undefined,
      aadt: p.aadt_predicted ?? undefined,
      congestionRisk: p.congestion_risk ?? undefined,
      forecast2030: p.growth_2030 ?? undefined,
      forecast2040: p.growth_2040 ?? undefined,
    };
    setSelFeature(rf);
  }

  function onStationClick(feat: any) {
    const p = feat.properties ?? {};
    const pred = predByLink.get(p.Link_ID ?? '');
    const sf: AtcStationFeature = {
      type: 'atc-station',
      id: p.TCS_NAME ?? String(p.TCS_NO ?? '?'),
      name: p.TCS_NAME ?? 'Unknown',
      road: p.Link_Name ?? undefined,
      region: p.REGION ?? undefined,
      aadt: pred?.aadt_predicted ?? 0,
      lightPct: pred ? 100 - (pred.heavy_vehicle_pct ?? 0) : undefined,
      heavyPct: pred?.heavy_vehicle_pct ?? undefined,
    };
    setSelFeature(sf);
  }

  const eatStr   = formatEAT(now);
  const modeConf = MODES[mode];
  const accent   = modeConf.color;

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', background: '#020508',
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
      background: '#020508', fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <style>{`@keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.55;transform:scale(1.4)}}`}</style>

      {/* ─── LEFT: MAP PANE ─────────────────────────────────────────────── */}
      <div style={{ flex: '1 1 0', minWidth: 0, position: 'relative' }}>
        <MapContainer
          center={[1.37, 32.3]} zoom={7} zoomControl={false}
          style={{ height: '100%', width: '100%', background: '#020508' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; CartoDB"
          />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade_Dark/MapServer/tile/{z}/{y}/{x}"
            opacity={0.14}
          />
          <ZoomControl position="bottomright"/>

          {features.length > 0 && (
            <TrafficLayer
              features={features}
              mode={mode}
              now={now}
              surfMap={surfMap}
              onSelect={onLinkClick}
            />
          )}

          {/* ATC station dots */}
          {stations.map((feat, i) => {
            const [lng, lat] = feat.geometry?.coordinates ?? [0, 0];
            if (!lat || !lng) return null;
            const p = feat.properties ?? {};
            const col = REGION_CLR[p.REGION ?? ''] ?? '#94a3b8';
            const prominent = mode === 'stations';
            return (
              <CircleMarker
                key={i} center={[lat, lng]}
                radius={prominent ? 5 : 3}
                pathOptions={{
                  color: col, fillColor: col,
                  fillOpacity: prominent ? 0.85 : 0.3,
                  weight: prominent ? 1.2 : 0.5,
                }}
                eventHandlers={{ click: () => onStationClick(feat) }}
              >
                {prominent && (
                  <LeafletTooltip>
                    <div style={{
                      background: 'rgba(2,5,8,0.96)', color: col,
                      border: `1px solid ${col}55`, borderRadius: 6,
                      padding: '4px 8px', fontSize: 9, fontWeight: 800,
                    }}>
                      <div>{p.TCS_NAME}</div>
                      <div style={{ color: 'rgba(226,234,244,0.8)', fontWeight: 400, marginTop: 1 }}>
                        {p.Link_Name}
                      </div>
                      <div style={{ color: 'rgba(148,163,184,0.5)', marginTop: 1 }}>
                        {p.STATION} · {p.REGION}
                      </div>
                    </div>
                  </LeafletTooltip>
                )}
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Mode badge */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 900,
          ...glass(accent), padding: '6px 12px',
          display: 'flex', alignItems: 'center', gap: 7,
          boxShadow: `0 0 20px rgba(${hexRgb(accent)},0.25)`,
        }}>
          {mode === 'live' && (
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: C.green,
              display: 'inline-block', animation: 'livePulse 2s ease-in-out infinite',
              boxShadow: `0 0 8px ${C.green}`,
            }}/>
          )}
          <span style={{ fontSize: 10, fontWeight: 800, color: accent, letterSpacing: '0.05em' }}>
            {mode === 'live' ? `LIVE · ${eatStr} EAT` : modeConf.label.toUpperCase()}
          </span>
          <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)' }}>{modeConf.desc}</span>
        </div>

        {/* Click hint */}
        <div style={{
          position: 'absolute', bottom: 40, left: 12, zIndex: 900,
          fontSize: 9, color: 'rgba(148,163,184,0.35)', pointerEvents: 'none',
        }}>
          Click a road link or station dot to inspect
        </div>
      </div>

      {/* ─── RIGHT: DETAILS PANE ────────────────────────────────────────── */}
      <div style={{
        width: 340, flexShrink: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: '12px 12px 16px',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(2,5,8,0.65)',
      }}>

        {/* Header */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: `rgba(${hexRgb(accent)},0.5)`,
            letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            UGANDA NATIONAL ROADS · TRAFFIC
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: accent, lineHeight: 1.2,
            textShadow: `0 0 16px rgba(${hexRgb(accent)},0.4)` }}>
            Traffic Monitor
          </div>
          {mode === 'live' && (
            <div style={{ fontSize: 10, color: C.green, marginTop: 2,
              display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={11}/> {eatStr} EAT · auto-refresh 60 s
            </div>
          )}
        </div>

        {/* ── Attribute selector ── */}
        <div style={{ ...glass(accent), padding: '10px 10px 8px' }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: 'rgba(148,163,184,0.4)',
            textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 7 }}>
            MAP ATTRIBUTE
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(Object.keys(MODES) as AttrMode[]).map(m => {
              const mc = MODES[m];
              const active = mode === m;
              return (
                <button key={m}
                  onClick={() => { setMode(m); setNow(new Date()); }}
                  style={{
                    fontSize: 9, fontWeight: 800, padding: '4px 9px', borderRadius: 6,
                    cursor: 'pointer',
                    border: `1px solid ${active ? mc.color : 'rgba(255,255,255,0.1)'}`,
                    background: active ? `rgba(${hexRgb(mc.color)},0.15)` : 'rgba(255,255,255,0.04)',
                    color: active ? mc.color : 'rgba(148,163,184,0.6)',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                  {m === 'live' && active && (
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%', background: C.green,
                      display: 'inline-block', animation: 'livePulse 2s ease-in-out infinite',
                    }}/>
                  )}
                  {mc.label}
                </button>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{ marginTop: 9 }}>
            <Legend mode={mode}/>
          </div>
        </div>

        {/* ── KPI cards (2 × 2) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

          {/* Network */}
          <div style={{ ...glass(C.cyan), padding: '10px 12px' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(0,245,255,0.45)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
              Network
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.cyan, lineHeight: 1 }}>
              {kpis ? `${(kpis.totalKm / 1000).toFixed(0)}k` : '—'}
            </div>
            <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)', marginTop: 2 }}>
              km · {features.length} links
            </div>
            <div style={{ fontSize: 9, color: 'rgba(0,245,255,0.65)', marginTop: 4 }}>
              {kpis ? `${(kpis.totalVkm / 1e6).toFixed(0)}M veh-km/day` : '—'}
            </div>
          </div>

          {/* Traffic */}
          <div style={{ ...glass(mode === 'live' ? C.green : C.yellow), padding: '10px 12px' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: `rgba(${hexRgb(mode === 'live' ? C.green : C.yellow)},0.45)`,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
              {mode === 'live' ? 'Network VPH' : 'Avg AADT'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1,
              color: mode === 'live' ? C.green : C.yellow }}>
              {kpis
                ? mode === 'live'
                    ? `${(kpis.totalVph / 1000).toFixed(0)}k`
                    : `${Math.round(kpis.avgAadt).toLocaleString()}`
                : '—'}
            </div>
            <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)', marginTop: 2 }}>
              {mode === 'live' ? 'veh/hr all links' : 'veh/day mean'}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.55)', marginTop: 4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Peak: {kpis?.peakFeat.properties.link_name ?? '—'}
            </div>
          </div>

          {/* Congestion */}
          <div style={{ ...glass(C.pink), padding: '10px 12px' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,45,120,0.45)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
              Congestion
              <span style={{ fontWeight: 400, color: 'rgba(148,163,184,0.4)', marginLeft: 4 }}>
                {mode === 'live' ? 'this hour' : mode.includes('forecast') ? mode.replace('forecast','') : 'annual'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {[
                ['Crit', kpis?.crit ?? 0, C.pink],
                ['High', kpis?.high ?? 0, C.orange],
                ['Med',  kpis?.med  ?? 0, C.yellow],
                ['Low',  kpis?.low  ?? 0, C.green],
              ].map(([label, count, color]) => (
                <div key={String(label)} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: String(color), lineHeight: 1 }}>
                    {count}
                  </div>
                  <div style={{ fontSize: 7, color: 'rgba(148,163,184,0.4)', marginTop: 1 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stations */}
          <div style={{ ...glass(C.teal), padding: '10px 12px' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(0,212,170,0.45)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
              ATC Stations
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.teal, lineHeight: 1 }}>
              {stations.length || 298}
            </div>
            <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)', marginTop: 2 }}>
              traffic count stations
            </div>
            <div style={{ fontSize: 9, color: 'rgba(0,212,170,0.65)', marginTop: 4 }}>
              15 permanent + 10 new ATC
            </div>
          </div>

        </div>

        {/* ── Feature analytics (inline right pane) ── */}
        {selFeature ? (
          <FeatureAnalyticsPanel
            feature={selFeature}
            onClose={() => setSelFeature(null)}
            width={316}
          />
        ) : (
          <div style={{
            flex: 1, minHeight: 100,
            background: 'rgba(2,5,8,0.5)',
            border: '1px solid rgba(148,163,184,0.08)',
            borderRadius: 12,
            padding: 14,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            color: 'rgba(148,163,184,0.3)',
          }}>
            <MapPin size={20} style={{ opacity: 0.35 }}/>
            <div style={{ fontSize: 10, textAlign: 'center', lineHeight: 1.5 }}>
              Click a road link or station dot<br/>to view detailed analytics
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ fontSize: 8, color: 'rgba(100,116,139,0.35)', textAlign: 'center', paddingTop: 2 }}>
          Uganda National Roads · UNRA / DNR 2025 · {features.length} links ·
          XGBoost + LightGBM ensemble · ML trained 2018–2025
        </div>
      </div>
    </div>
  );
}
