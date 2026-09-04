/**
 * Shared conditional-formatting primitives for data tables across the
 * platform - road-class pills, AADT heat scale, percentage colouring,
 * null/zero highlighting, and critical-row left borders. Condition-rating
 * traffic-light colouring already exists as conditionColor/conditionBadge
 * in utils/helpers.ts; this module covers the rest so every table applies
 * the same visual language.
 */

// ─── Road class pill ──────────────────────────────────────────────────────────
// Covers both the single-letter trunk-road classes (A/B/C/M) and the
// word-form classes used in a few datasets (District/Urban/Community).
const ROAD_CLASS_COLORS: Record<string, string> = {
  A: '#00f5ff', B: '#00ff88', C: '#ffd23f', M: '#b967ff',
  Trunk: '#00f5ff', District: '#00ff88', Urban: '#ff6b35', Community: '#94a3b8',
};

export function roadClassColor(cls: string | null | undefined): string {
  if (!cls) return '#94a3b8';
  return ROAD_CLASS_COLORS[cls] ?? ROAD_CLASS_COLORS[cls.trim()] ?? '#94a3b8';
}

export function RoadClassPill({ cls }: { cls: string | null | undefined }) {
  const color = roadClassColor(cls);
  if (!cls) return <span style={{ color: 'rgba(148,163,184,0.4)' }}>-</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 22, padding: '2px 8px', borderRadius: 999,
      background: `${color}1f`, border: `1px solid ${color}55`,
      color, fontSize: 10, fontWeight: 800, letterSpacing: '0.02em',
    }}>
      {cls}
    </span>
  );
}

// ─── AADT heat scale ──────────────────────────────────────────────────────────
// Discrete buckets (not continuous interpolation) - cheap to evaluate across
// thousands of virtualized cells and matches the threshold-based colouring
// style already used elsewhere in the codebase (e.g. IRI thresholds).
const AADT_BUCKETS: Array<{ max: number; bg: string; fg: string }> = [
  { max: 500,    bg: 'rgba(0,212,170,0.10)',  fg: '#00d4aa' },   // very light
  { max: 2000,   bg: 'rgba(0,255,136,0.10)',  fg: '#00ff88' },   // light
  { max: 5000,   bg: 'rgba(255,210,63,0.14)', fg: '#ffd23f' },   // moderate
  { max: 10000,  bg: 'rgba(255,107,53,0.16)', fg: '#ff6b35' },   // heavy
  { max: Infinity, bg: 'rgba(255,51,102,0.18)', fg: '#ff3366' }, // very heavy
];

export function aadtHeat(value: number | null | undefined): { bg: string; fg: string } {
  if (value == null || Number.isNaN(value)) return { bg: 'transparent', fg: 'inherit' };
  return AADT_BUCKETS.find(b => value <= b.max) ?? AADT_BUCKETS[AADT_BUCKETS.length - 1];
}

export function AadtHeatCell({ value }: { value: number | null | undefined }) {
  if (value == null || Number.isNaN(value) || value === 0) {
    return <span style={NULL_ZERO_STYLE}>0</span>;
  }
  const { bg, fg } = aadtHeat(value);
  return (
    <span style={{
      display: 'inline-block', width: '100%', padding: '2px 8px', borderRadius: 5,
      background: bg, color: fg, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
      textAlign: 'right',
    }}>
      {value.toLocaleString()}
    </span>
  );
}

// ─── Percentage colouring ─────────────────────────────────────────────────────
// Default assumes higher = better (scores, coverage, utilisation). Pass
// `invert` for fields where lower is better.
export function percentageColor(value: number, invert = false): string {
  const v = invert ? 100 - value : value;
  if (v >= 75) return '#00ff88';
  if (v >= 50) return '#ffd23f';
  if (v >= 25) return '#ff6b35';
  return '#ff3366';
}

export function PercentCell({ value, invert }: { value: number | null | undefined; invert?: boolean }) {
  if (value == null || Number.isNaN(value)) return <span style={NULL_ZERO_STYLE}>-</span>;
  const color = percentageColor(value, invert);
  return (
    <span style={{ color, fontWeight: 700 }}>
      {value.toFixed(value % 1 === 0 ? 0 : 1)}%
    </span>
  );
}

// ─── Null / zero highlight ─────────────────────────────────────────────────────
export function isNullOrZero(v: unknown): boolean {
  return v == null || v === '' || v === 0;
}

export const NULL_ZERO_STYLE: React.CSSProperties = {
  display: 'inline-block', padding: '1px 7px', borderRadius: 5,
  background: 'rgba(255,159,10,0.14)', border: '1px solid rgba(255,159,10,0.3)',
  color: '#ff9f0a', fontWeight: 700,
};

/** Wraps a formatted value, swapping in the orange null/zero flag when empty. */
export function NullableCell({ value, children }: { value: unknown; children: React.ReactNode }) {
  if (isNullOrZero(value)) return <span style={NULL_ZERO_STYLE}>0</span>;
  return <>{children}</>;
}

// ─── Condition colour by string label ─────────────────────────────────────────
// For datasets that store condition as a label ('Very Poor'…'Excellent')
// rather than the 1–5 ConditionRating used elsewhere - same traffic-light scale.
const CONDITION_LABEL_COLORS: Record<string, string> = {
  'Very Poor': '#ef4444', 'Poor': '#f97316', 'Fair': '#eab308',
  'Good': '#84cc16', 'Very Good': '#22c55e', 'Excellent': '#22c55e',
};

export function conditionLabelColor(label: string | null | undefined): string {
  if (!label) return '#94a3b8';
  return CONDITION_LABEL_COLORS[label] ?? '#94a3b8';
}

export function ConditionLabelBadge({ label }: { label: string | null | undefined }) {
  const color = conditionLabelColor(label);
  if (!label) return <span style={{ color: 'rgba(148,163,184,0.4)' }}>-</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999,
      background: `${color}1f`, border: `1px solid ${color}55`,
      color, fontSize: 10, fontWeight: 800,
    }}>
      {label}
    </span>
  );
}

// ─── Critical-row left border ─────────────────────────────────────────────────
export function criticalRowStyle(isCritical: boolean): React.CSSProperties {
  return {
    borderLeft: isCritical ? '3px solid #ff3366' : '3px solid transparent',
  };
}
