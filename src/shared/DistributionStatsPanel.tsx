import React from 'react';
import { computeDistribution, histogramBins, type DistStats } from './distributionStats';

// Purely additive UI components for the Deep Analytics "Numeric Distribution
// Statistics" panels. Styled to match the existing dark-glass aesthetic used
// throughout Traffic Analytics — never alters any existing layout or markup.

const CARD: React.CSSProperties = {
  background: 'rgba(10,16,30,0.6)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14,
  padding: 16,
};

const LABEL: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: 'rgba(255,255,255,0.45)',
};

const VALUE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.92)',
  fontVariantNumeric: 'tabular-nums',
};

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={LABEL}>{label}</span>
      <span style={VALUE}>{value}</span>
    </div>
  );
}

function fmt(v: number | null, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return v.toFixed(digits);
}

export function MiniHistogram({ values, accent = '#22d3ee' }: { values: (number | null | undefined)[]; accent?: string }) {
  const bins = histogramBins(values, 12);
  if (bins.length === 0) return null;
  const max = Math.max(...bins.map((b) => b.count), 1);
  return (
    <svg width="100%" height={44} viewBox="0 0 240 44" preserveAspectRatio="none" style={{ display: 'block', marginTop: 8 }}>
      {bins.map((b, i) => {
        const w = 240 / bins.length;
        const h = (b.count / max) * 40;
        return (
          <rect
            key={i}
            x={i * w + 1}
            y={44 - h}
            width={Math.max(w - 2, 1)}
            height={h}
            fill={accent}
            opacity={0.7}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

export interface StatFieldSpec {
  key: string;
  label: string;
  unit?: string;
  values: (number | null | undefined)[];
  accent?: string;
}

export function FieldDistributionCard({ field }: { field: StatFieldSpec }) {
  const s: DistStats | null = computeDistribution(field.values);
  const unit = field.unit ? ` ${field.unit}` : '';
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{field.label}</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>n={s?.n ?? 0}</span>
      </div>
      {!s ? (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>No numeric data available</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <StatRow label="Mean" value={fmt(s.mean) + unit} />
              <StatRow label="Median" value={fmt(s.median) + unit} />
              <StatRow label="Mode" value={fmt(s.mode) + unit} />
              <StatRow label="Std Dev" value={fmt(s.stdDev) + unit} />
              <StatRow label="Variance" value={fmt(s.variance)} />
              <StatRow label="Coef. Var" value={fmt(s.coefVar) + '%'} />
            </div>
            <div>
              <StatRow label="Min" value={fmt(s.min) + unit} />
              <StatRow label="Max" value={fmt(s.max) + unit} />
              <StatRow label="Range" value={fmt(s.range) + unit} />
              <StatRow label="Q1 – Q3" value={`${fmt(s.q1)} – ${fmt(s.q3)}${unit}`} />
              <StatRow label="IQR" value={fmt(s.iqr) + unit} />
              <StatRow label="P90 – P95" value={`${fmt(s.p90)} – ${fmt(s.p95)}${unit}`} />
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              fontSize: 10,
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            <span>Skewness: {s.skewness !== null ? s.skewness.toFixed(3) : '—'}</span>
            <span>Kurtosis: {s.kurtosis !== null ? s.kurtosis.toFixed(3) : '—'}</span>
            <span>P5/P10/P99: {fmt(s.p5)}/{fmt(s.p10)}/{fmt(s.p99)}</span>
          </div>
          <MiniHistogram values={field.values} accent={field.accent} />
        </>
      )}
    </div>
  );
}

export function DistributionStatsSection({
  title,
  subtitle,
  fields,
}: {
  title: string;
  subtitle?: string;
  fields: StatFieldSpec[];
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3 }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        {fields.map((f) => (
          <FieldDistributionCard key={f.key} field={f} />
        ))}
      </div>
    </div>
  );
}

export function DistributionTable({
  title,
  subtitle,
  groups,
  style,
}: {
  title: string;
  subtitle?: string;
  groups: { label: string; values: (number | null | undefined)[] }[];
  style?: React.CSSProperties;
}) {
  const rows = groups.map((g) => ({ label: g.label, stats: computeDistribution(g.values) }));
  const cols: { key: keyof DistStats; label: string }[] = [
    { key: 'n', label: 'N' },
    { key: 'mean', label: 'Mean' },
    { key: 'median', label: 'Median' },
    { key: 'stdDev', label: 'StdDev' },
    { key: 'coefVar', label: 'CV%' },
    { key: 'min', label: 'Min' },
    { key: 'q1', label: 'Q1' },
    { key: 'q3', label: 'Q3' },
    { key: 'max', label: 'Max' },
    { key: 'p90', label: 'P90' },
    { key: 'p95', label: 'P95' },
    { key: 'skewness', label: 'Skew' },
    { key: 'kurtosis', label: 'Kurt' },
  ];
  return (
    <div style={{ marginTop: 24, gridColumn: '1 / -1', ...style }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3 }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ ...CARD, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ ...LABEL, textAlign: 'left', padding: '8px 10px' }}>Group</th>
              {cols.map((c) => (
                <th key={c.key} style={{ ...LABEL, textAlign: 'right', padding: '8px 10px' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{r.label}</td>
                {cols.map((c) => {
                  const v = r.stats ? r.stats[c.key] : null;
                  const display =
                    v === null || v === undefined
                      ? '—'
                      : c.key === 'n'
                      ? String(v)
                      : typeof v === 'number'
                      ? fmt(v, c.key === 'skewness' || c.key === 'kurtosis' ? 3 : 2)
                      : '—';
                  return (
                    <td key={c.key} style={{ padding: '6px 10px', textAlign: 'right', ...VALUE, fontWeight: 500 }}>
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
