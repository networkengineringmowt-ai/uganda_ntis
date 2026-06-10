/**
 * FeatureAnalyticsPanel — glass slide-in detail panel for map feature clicks.
 * Supports: road-link | bridge | culvert | atc-station
 * ATC-style: vibrant dark palette, 24 h telemetry chart, vehicle-class bars,
 *            AADT growth sparkline (2016-2025).
 */
import { X, MapPin, Activity, TrendingUp, Droplets, Wifi, Radio } from 'lucide-react';
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
  stationType?: 'ATC' | 'TIS';   // ATC = automatic, TIS = manual
  monthly?: { month: string; total: number }[];
  vehicleClasses?: { label: string; count: number }[];
  growthTrend?: number[];         // AADT values 2016–2025 (10 points)
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

// ─── Sparkline (SVG line + area) ──────────────────────────────────────────────

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
  const rgb = hexRgb(color);
  const gradId = `sg-${color.replace('#', '')}`;
  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        points={`${pad},${H - pad} ${pts} ${W - pad},${H - pad}`}
        fill={`url(#${gradId})`}
        stroke="none"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px rgba(${rgb},0.75))` }}
      />
    </svg>
  );
}

// ─── 24 h telemetry health mini-chart ────────────────────────────────────────

function TelemetryChart({ active, color }: { active: boolean; color: string }) {
  const W = 200, H = 38, pad = 2;
  // deterministic 24-point health curve
  const data = Array.from({ length: 24 }, (_, i) =>
    active
      ? 88 + Math.sin(i * 0.55 + 1) * 5 + Math.cos(i * 0.3) * 3
      : 30 + Math.abs(Math.sin(i * 0.9)) * 25
  );
  const min = Math.min(...data) * 0.92;
  const max = Math.max(...data) * 1.04;
  const range = max - min || 1;
  const x = (i: number) => pad + (i / 23) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const rgb = hexRgb(color);
  const gid = `tg-${color.replace('#', '')}`;
  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block', width: '100%' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        points={`${pad},${H - pad} ${pts} ${W - pad},${H - pad}`}
        fill={`url(#${gid})`}
        stroke="none"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px rgba(${rgb},0.8))` }}
      />
      {/* hour tick marks */}
      {[0, 6, 12, 18, 23].map(h => (
        <text key={h} x={x(h)} y={H + 8} fill="rgba(148,163,184,0.3)"
          fontSize={6} textAnchor="middle">{h}h</text>
      ))}
    </svg>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function Row({ label, value, color = '#e2eaf4' }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.55)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
      }}>{label}</span>
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
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: `rgba(${rgb},0.18)`,
          border: `1px solid rgba(${rgb},0.35)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent, flexShrink: 0,
          boxShadow: `0 0 12px rgba(${rgb},0.2)`,
        }}>{icon}</div>
        <div>
          <div style={{
            fontSize: 13, fontWeight: 900, color: accent,
            textShadow: `0 0 14px rgba(${rgb},0.5)`, lineHeight: 1.25,
          }}>{title}</div>
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
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Feature renderers ────────────────────────────────────────────────────────

function RoadLinkPanel({ f, onClose }: { f: RoadLinkFeature; onClose: () => void }) {
  const accent = '#6366f1';
  const congColor = f.congestionRisk ? (CONGESTION_COLORS[f.congestionRisk] ?? '#94a3b8') : '#94a3b8';
  return (
    <>
      <PanelHeader icon={<MapPin size={14} />} title={f.name}
        subtitle={`Class ${f.roadClass} · ${f.region ?? ''}`} accent={accent} onClose={onClose} />
      <Row label="Class"   value={f.roadClass} />
      <Row label="Length"  value={`${f.lengthKm.toFixed(1)} km`} />
      <Row label="Surface" value={f.surface}
        color={f.surface === 'Bituminous' || f.surface === 'Paved' ? '#00f5ff' : '#ffd23f'} />
      {f.aadt !== undefined && <Row label="AADT 2025" value={`${f.aadt.toLocaleString()} veh/day`} />}
      {f.congestionRisk && (
        <Row label="Congestion" value={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: congColor,
              boxShadow: `0 0 6px ${congColor}`, display: 'inline-block',
            }} />
            {f.congestionRisk}
          </span>
        } color={congColor} />
      )}
      {f.forecast2030 !== undefined && (
        <Row label="Forecast 2030" value={`${f.forecast2030.toLocaleString()} veh/day`} color="#ffd23f" />
      )}
      {f.forecast2040 !== undefined && (
        <Row label="Forecast 2040" value={`${f.forecast2040.toLocaleString()} veh/day`} color="#ff6b35" />
      )}
    </>
  );
}

function BridgePanel({ f, onClose }: { f: BridgeFeature; onClose: () => void }) {
  const accent = STRUCTURE_STYLES.bridge.color;
  const cRating = f.conditionRating ?? null;
  return (
    <>
      <PanelHeader icon={<Activity size={14} />} title={f.name ?? f.id}
        subtitle={f.road ?? undefined} accent={accent} onClose={onClose} />
      <Row label="Structure ID" value={f.id} />
      {f.material && <Row label="Material"    value={f.material} />}
      {f.spanLength !== undefined && <Row label="Span Length" value={`${f.spanLength} m`} />}
      {f.crossingType && <Row label="Crossing"   value={f.crossingType} />}
      {cRating !== null && (
        <Row label="Condition" value={
          <span style={{ color: CONDITION_COLOR[cRating] }}>
            {cRating}/5 — {CONDITION_LABEL[cRating]}
          </span>
        } />
      )}
      {f.lastInspection && <Row label="Last Inspection" value={f.lastInspection.slice(0, 10)} />}
    </>
  );
}

function CulvertPanel({ f, onClose }: { f: CulvertFeature; onClose: () => void }) {
  const accent = STRUCTURE_STYLES.culvert.color;
  const cRating = f.conditionRating ?? null;
  return (
    <>
      <PanelHeader icon={<Droplets size={14} />} title={f.name ?? f.id}
        subtitle={f.road ?? undefined} accent={accent} onClose={onClose} />
      <Row label="Structure ID" value={f.id} />
      {f.crossingType && <Row label="Type" value={f.crossingType} />}
      {cRating !== null && (
        <Row label="Condition" value={
          <span style={{ color: CONDITION_COLOR[cRating] }}>
            {cRating}/5 — {CONDITION_LABEL[cRating]}
          </span>
        } />
      )}
      {f.lastInspection && <Row label="Last Inspection" value={f.lastInspection.slice(0, 10)} />}
    </>
  );
}

// ─── Vehicle class bars ───────────────────────────────────────────────────────

const VC_COLORS = [
  '#00f5ff', '#00ff88', '#ffd23f', '#ff6b35', '#b967ff',
  '#ff2d78', '#4d9fff', '#00d4aa', '#f0abfc', '#fbbf24', '#a3e635',
];

function VehicleClassBars({ classes }: { classes: { label: string; count: number }[] }) {
  const max = Math.max(...classes.map(c => c.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
      {classes.map((c, i) => {
        const col = VC_COLORS[i % VC_COLORS.length];
        const pct = (c.count / max) * 100;
        const rgb = hexRgb(col);
        return (
          <div key={c.label}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 8, color: 'rgba(148,163,184,0.55)', marginBottom: 2,
            }}>
              <span style={{ color: col }}>{c.label}</span>
              <span style={{ fontWeight: 700, color: col }}>{c.count.toLocaleString()}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: `rgba(${rgb},0.1)`, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`, borderRadius: 3,
                background: col, opacity: 0.78,
                boxShadow: `0 0 6px rgba(${rgb},0.5)`,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ATC Station Panel ────────────────────────────────────────────────────────

function AtcPanel({ f, onClose }: { f: AtcStationFeature; onClose: () => void }) {
  const isATC  = f.stationType === 'ATC';
  const accent = isATC ? '#00c3ff' : '#ffcc33';
  const rgb    = hexRgb(accent);

  return (
    <>
      <PanelHeader
        icon={isATC ? <Wifi size={14} /> : <Radio size={14} />}
        title={f.name}
        subtitle={f.road ?? f.region ?? undefined}
        accent={accent}
        onClose={onClose}
      />

      {/* Status badges */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 8,
          background: 'rgba(0,234,144,0.15)', color: '#00ea90',
          border: '1px solid rgba(0,234,144,0.3)',
        }}>● ACTIVE</span>
        <span style={{
          fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 8,
          background: `rgba(${rgb},0.12)`, color: accent,
          border: `1px solid rgba(${rgb},0.3)`,
        }}>{isATC ? 'ATC – Automatic' : 'TIS – Manual'}</span>
      </div>

      <Row label="Station ID" value={f.id} />
      {f.region && <Row label="Region" value={f.region} />}
      <Row label="AADT 2025" value={`${f.aadt.toLocaleString()} veh/day`} color={accent} />
      {f.lightPct !== undefined && (
        <Row label="Light vehicles" value={`${f.lightPct.toFixed(0)}%`} color="#4d9fff" />
      )}
      {f.heavyPct !== undefined && (
        <Row label="Heavy vehicles" value={`${f.heavyPct.toFixed(0)}%`}
          color={f.heavyPct > 30 ? '#ff6b35' : '#ffd23f'} />
      )}

      {/* 24 h telemetry health */}
      <div style={{ marginTop: 14 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: `rgba(${rgb},0.6)`,
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
        }}>
          24 h Telemetry Health
        </div>
        <TelemetryChart active color={accent} />
      </div>

      {/* AADT growth trend 2016–2025 */}
      {f.growthTrend && f.growthTrend.length >= 2 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: 'rgba(0,255,136,0.6)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
          }}>
            AADT Growth 2016 – 2025
          </div>
          <Sparkline data={f.growthTrend} color="#00ff88" />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 8, color: 'rgba(148,163,184,0.35)', marginTop: 4,
          }}>
            <span>2016</span>
            <span style={{ color: 'rgba(255,210,63,0.55)' }}>COVID '20</span>
            <span>2025</span>
          </div>
        </div>
      )}

      {/* Vehicle class breakdown */}
      {f.vehicleClasses && f.vehicleClasses.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
          }}>
            Vehicle class breakdown
          </div>
          <VehicleClassBars classes={f.vehicleClasses} />
        </div>
      )}
    </>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function FeatureAnalyticsPanel({
  feature,
  onClose,
  width = 270,
}: {
  feature: FeatureData | null;
  onClose: () => void;
  width?: number;
}) {
  if (!feature) return null;

  const accentMap = {
    'road-link':   '#6366f1',
    'bridge':      STRUCTURE_STYLES.bridge.color,
    'culvert':     STRUCTURE_STYLES.culvert.color,
    'atc-station': '#00c3ff',
  };
  const accent = accentMap[feature.type];
  const rgb    = hexRgb(accent);

  return (
    <div style={{
      width,
      flexShrink: 0,
      height: '100%',
      background: 'rgba(10,15,30,0.92)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderLeft: `1px solid rgba(${rgb},0.22)`,
      padding: '14px 16px',
      boxShadow: `-4px 0 24px rgba(0,0,0,0.5)`,
      overflowY: 'auto',
      color: '#e2eaf4',
      boxSizing: 'border-box',
    }}>
      {feature.type === 'road-link'   && <RoadLinkPanel f={feature} onClose={onClose} />}
      {feature.type === 'bridge'      && <BridgePanel   f={feature} onClose={onClose} />}
      {feature.type === 'culvert'     && <CulvertPanel  f={feature} onClose={onClose} />}
      {feature.type === 'atc-station' && <AtcPanel      f={feature} onClose={onClose} />}
    </div>
  );
}
