/**
 * FeatureAnalyticsPanel — glass slide-in detail panel for map feature clicks.
 * Supports: road-link | bridge | culvert | atc-station
 * Rendered alongside (not over) the MapContainer.
 */
import { X, MapPin, Activity, TrendingUp, AlertTriangle, Droplets } from 'lucide-react';
import { CONGESTION_COLORS, STRUCTURE_STYLES } from './mapSymbols';

// ─── Feature data types ───────────────────────────────────────────────────────

export interface RoadLinkFeature {
  type: 'road-link';
  name: string;
  roadClass: string;
  lengthKm: number;
  surface: string;
  region?: string;
  aadt?: number;
  congestionRisk?: string;
  forecast2030?: number;
  forecast2040?: number;
}

export interface BridgeFeature {
  type: 'bridge';
  id: string;
  name?: string;
  road?: string;
  spanLength?: number;
  conditionRating?: number;
  lastInspection?: string;
  material?: string;
  crossingType?: string;
}

export interface CulvertFeature {
  type: 'culvert';
  id: string;
  name?: string;
  road?: string;
  conditionRating?: number;
  crossingType?: string;
  lastInspection?: string;
}

export interface AtcStationFeature {
  type: 'atc-station';
  id: string;
  name: string;
  road?: string;
  region?: string;
  aadt: number;
  lightPct?: number;
  heavyPct?: number;
  monthly?: { month: string; total: number }[];
}

export type FeatureData = RoadLinkFeature | BridgeFeature | CulvertFeature | AtcStationFeature;

// ─── Style helpers ────────────────────────────────────────────────────────────

function hexRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

const CONDITION_LABEL: Record<number, string> = {
  1: 'Very Poor', 2: 'Poor', 3: 'Fair', 4: 'Good', 5: 'Very Good',
};
const CONDITION_COLOR: Record<number, string> = {
  1: '#ff2d78', 2: '#ff6b35', 3: '#ffd23f', 4: '#00ff88', 5: '#00f5ff',
};

// ─── Sparkline (SVG line chart for monthly AADT) ──────────────────────────────

function Sparkline({ data, color = '#00f5ff' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 200, H = 48, pad = 4;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35}/>
          <stop offset="100%" stopColor={color} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <polyline
        points={`${pad},${H - pad} ${pts} ${W - pad},${H - pad}`}
        fill="url(#spark-grad)"
        stroke="none"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
      />
    </svg>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function Row({ label, value, color = '#e2eaf4' }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.55)',
        textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}

// ─── Panel header ─────────────────────────────────────────────────────────────

function PanelHeader({
  icon, title, subtitle, accent, onClose,
}: {
  icon: React.ReactNode; title: string; subtitle?: string;
  accent: string; onClose: () => void;
}) {
  const rgb = hexRgb(accent);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: `rgba(${rgb},0.18)`,
          border: `1px solid rgba(${rgb},0.35)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent, flexShrink: 0,
        }}>{icon}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: accent,
            textShadow: `0 0 14px rgba(${rgb},0.5)`, lineHeight: 1.25 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
      </div>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', color: 'rgba(148,163,184,0.45)',
        cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center',
        transition: 'color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.color = '#e2eaf4')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(148,163,184,0.45)')}
      >
        <X size={14}/>
      </button>
    </div>
  );
}

// ─── Feature renderers ────────────────────────────────────────────────────────

function RoadLinkPanel({ f, onClose }: { f: RoadLinkFeature; onClose: () => void }) {
  const accent = '#00f5ff';
  const congColor = f.congestionRisk ? (CONGESTION_COLORS[f.congestionRisk] ?? '#94a3b8') : '#94a3b8';
  return (
    <>
      <PanelHeader icon={<MapPin size={14}/>} title={f.name} subtitle={`Class ${f.roadClass} · ${f.region ?? ''}`}
        accent={accent} onClose={onClose}/>
      <Row label="Class"   value={f.roadClass}/>
      <Row label="Length"  value={`${f.lengthKm.toFixed(1)} km`}/>
      <Row label="Surface" value={f.surface}
        color={f.surface === 'Bituminous' || f.surface === 'Paved' ? '#00f5ff' : '#ffd23f'}/>
      {f.aadt !== undefined && <Row label="AADT 2025" value={`${f.aadt.toLocaleString()} veh/day`}/>}
      {f.congestionRisk && (
        <Row label="Congestion" value={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: congColor,
              boxShadow: `0 0 6px ${congColor}`, display: 'inline-block'}}/>
            {f.congestionRisk}
          </span>
        } color={congColor}/>
      )}
      {f.forecast2030 !== undefined && <Row label="Forecast 2030" value={`${f.forecast2030.toLocaleString()} veh/day`} color="#ffd23f"/>}
      {f.forecast2040 !== undefined && <Row label="Forecast 2040" value={`${f.forecast2040.toLocaleString()} veh/day`} color="#ff6b35"/>}
    </>
  );
}

function BridgePanel({ f, onClose }: { f: BridgeFeature; onClose: () => void }) {
  const accent = STRUCTURE_STYLES.bridge.color;
  const cRating = f.conditionRating ?? null;
  return (
    <>
      <PanelHeader icon={<Activity size={14}/>}
        title={f.name ?? f.id} subtitle={f.road ?? undefined}
        accent={accent} onClose={onClose}/>
      <Row label="Structure ID" value={f.id}/>
      {f.material    && <Row label="Material"    value={f.material}/>}
      {f.spanLength  !== undefined && <Row label="Span Length" value={`${f.spanLength} m`}/>}
      {f.crossingType && <Row label="Crossing"   value={f.crossingType}/>}
      {cRating !== null && (
        <Row label="Condition" value={
          <span style={{ color: CONDITION_COLOR[cRating] }}>
            {cRating}/5 — {CONDITION_LABEL[cRating]}
          </span>
        }/>
      )}
      {f.lastInspection && (
        <Row label="Last Inspection" value={f.lastInspection.slice(0, 10)}/>
      )}
    </>
  );
}

function CulvertPanel({ f, onClose }: { f: CulvertFeature; onClose: () => void }) {
  const accent = STRUCTURE_STYLES.culvert.color;
  const cRating = f.conditionRating ?? null;
  return (
    <>
      <PanelHeader icon={<Droplets size={14}/>}
        title={f.name ?? f.id} subtitle={f.road ?? undefined}
        accent={accent} onClose={onClose}/>
      <Row label="Structure ID" value={f.id}/>
      {f.crossingType && <Row label="Type"      value={f.crossingType}/>}
      {cRating !== null && (
        <Row label="Condition" value={
          <span style={{ color: CONDITION_COLOR[cRating] }}>
            {cRating}/5 — {CONDITION_LABEL[cRating]}
          </span>
        }/>
      )}
      {f.lastInspection && (
        <Row label="Last Inspection" value={f.lastInspection.slice(0, 10)}/>
      )}
    </>
  );
}

function AtcPanel({ f, onClose }: { f: AtcStationFeature; onClose: () => void }) {
  const accent = '#00ff88';
  const sparkData = f.monthly?.map(m => m.total) ?? [];
  return (
    <>
      <PanelHeader icon={<TrendingUp size={14}/>}
        title={f.name} subtitle={f.road ?? f.region ?? undefined}
        accent={accent} onClose={onClose}/>
      <Row label="Station ID"  value={f.id}/>
      {f.region && <Row label="Region" value={f.region}/>}
      <Row label="AADT" value={`${f.aadt.toLocaleString()} veh/day`}/>
      {f.lightPct !== undefined && <Row label="Light vehicles" value={`${f.lightPct}%`} color="#4d9fff"/>}
      {f.heavyPct !== undefined && (
        <Row label="Heavy vehicles" value={`${f.heavyPct}%`}
          color={f.heavyPct > 30 ? '#ff6b35' : '#ffd23f'}/>
      )}
      {sparkData.length >= 2 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            12-month volume trend
          </div>
          <Sparkline data={sparkData} color={accent}/>
          {f.monthly && (
            <div style={{ display: 'flex', justifyContent: 'space-between',
              fontSize: 8, color: 'rgba(148,163,184,0.35)', marginTop: 3 }}>
              <span>{f.monthly[0]?.month}</span>
              <span>{f.monthly[f.monthly.length - 1]?.month}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function FeatureAnalyticsPanel({
  feature,
  onClose,
  width = 260,
}: {
  feature: FeatureData | null;
  onClose: () => void;
  width?: number;
}) {
  if (!feature) return null;

  const accentMap = {
    'road-link':   '#00f5ff',
    'bridge':      STRUCTURE_STYLES.bridge.color,
    'culvert':     STRUCTURE_STYLES.culvert.color,
    'atc-station': '#00ff88',
  };
  const accent = accentMap[feature.type];
  const rgb = hexRgb(accent);

  return (
    <div style={{
      width,
      flexShrink: 0,
      background: 'rgba(15,23,42,0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid rgba(${rgb},0.22)`,
      borderRadius: 16,
      padding: '16px 18px',
      boxShadow: `0 8px 40px rgba(0,0,0,0.55), 0 0 30px rgba(${rgb},0.08)`,
      overflowY: 'auto',
      maxHeight: '100%',
      color: '#e2eaf4',
    }}>
      {feature.type === 'road-link'   && <RoadLinkPanel f={feature} onClose={onClose}/>}
      {feature.type === 'bridge'      && <BridgePanel   f={feature} onClose={onClose}/>}
      {feature.type === 'culvert'     && <CulvertPanel  f={feature} onClose={onClose}/>}
      {feature.type === 'atc-station' && <AtcPanel      f={feature} onClose={onClose}/>}
    </div>
  );
}
