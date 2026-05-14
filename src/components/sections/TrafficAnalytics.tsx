/**
 * TrafficAnalytics — rich demand analytics dashboard.
 * Data sources (all fetched on mount):
 *   public/data/traffic_summary.json       → KPIs + congestion breakdown
 *   public/data/traffic_predictions.geojson → per-link AADT + forecasts
 *   public/atc_stations.geojson             → ATC station network (public root)
 *
 * Uses inline SVG for charts — no external chart library.
 */
import { useState, useEffect, useMemo } from 'react';

// ─── Data types ───────────────────────────────────────────────────────────────

interface PredProps {
  link_id:           string;
  link_name:         string | null;
  road_no:           string | null;
  road_class:        string | null;
  region:            string | null;
  length_km:         number | null;
  aadt_predicted:    number | null;
  growth_2030:       number | null;
  growth_2040:       number | null;
  heavy_vehicle_pct: number | null;
  congestion_risk:   string | null;
  vehicle_km_daily:  number | null;
}
interface PredFeature { type: 'Feature'; geometry: unknown; properties: PredProps }

interface Summary {
  total_vehicle_km_daily:        number;
  links_at_capacity_risk_pct:    number;
  highest_growth_corridor_2040: {
    link_id?:   string;
    link_name:  string;
    aadt_2025:  number;
    aadt_2040:  number;
  };
  congestion_breakdown: Record<string, number>;
}

interface StationProps {
  TCS_NAME?:  string;
  STATION?:   string;
  Link_Name?: string;
  Link_ID?:   string;
  REGION?:    string;
}
interface StationFeature { properties: StationProps }

// ─── Style constants ──────────────────────────────────────────────────────────

const GLASS: React.CSSProperties = {
  background:          'rgba(15,23,42,0.45)',
  backdropFilter:      'blur(20px)',
  WebkitBackdropFilter:'blur(20px)',
  border:              '1px solid rgba(255,255,255,0.08)',
  borderRadius:         16,
};

const C = {
  cyan:   '#00f5ff',
  green:  '#00ff88',
  orange: '#ff6b35',
  purple: '#b967ff',
  yellow: '#ffd23f',
  pink:   '#ff2d78',
  teal:   '#00d4aa',
  blue:   '#4d9fff',
};

const CONG_COLORS: Record<string, string> = {
  Critical: '#ff2d78',
  High:     '#ff6b35',
  Medium:   '#ffd23f',
  Low:      '#00ff88',
};

const LINE_COLORS = [C.cyan, C.green, C.yellow, C.orange, C.purple];

function hexRgb(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color,
}: { label: string; value: string; sub: string; color: string }) {
  const rgb = hexRgb(color);
  return (
    <div style={{
      ...GLASS,
      padding: '18px 20px',
      border:  `1px solid rgba(${rgb},0.22)`,
      boxShadow: `0 0 28px rgba(${rgb},0.07)`,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.11em',
        color: `rgba(${rgb},0.65)`, marginBottom: 7,
      }}>{label}</div>
      <div style={{
        fontSize: 27, fontWeight: 900, color, lineHeight: 1,
        textShadow: `0 0 22px rgba(${rgb},0.55)`,
      }}>{value}</div>
      <div style={{
        fontSize: 10, color: 'rgba(148,163,184,0.55)', marginTop: 5,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{sub}</div>
    </div>
  );
}

// ─── Congestion horizontal bar chart (SVG) ────────────────────────────────────

function CongestionBars({ breakdown }: { breakdown: Record<string, number> }) {
  const levels = ['Critical', 'High', 'Medium', 'Low'] as const;
  const total  = levels.reduce((s, l) => s + (breakdown[l] ?? 0), 0);
  const maxVal = Math.max(...levels.map(l => breakdown[l] ?? 0), 1);

  const ROW = 34, LABEL_W = 62, W = 320;

  return (
    <svg
      viewBox={`0 0 ${W} ${levels.length * ROW + 4}`}
      style={{ width: '100%', height: levels.length * ROW + 4, display: 'block' }}
    >
      {levels.map((level, i) => {
        const count = breakdown[level] ?? 0;
        const barW  = (count / maxVal) * (W - LABEL_W - 48);
        const col   = CONG_COLORS[level];
        const y     = i * ROW + 6;
        const pct   = total ? ((count / total) * 100).toFixed(0) : '0';
        return (
          <g key={level}>
            <text x={0} y={y + 16} fill={col} fontSize={10} fontWeight={700}>{level}</text>
            {/* bar background */}
            <rect x={LABEL_W} y={y + 2} width={W - LABEL_W - 48} height={18} rx={5}
              fill={`rgba(${hexRgb(col)},0.08)`}/>
            {/* filled bar */}
            {barW > 0 && (
              <>
                <rect x={LABEL_W} y={y + 2} width={barW} height={18} rx={5}
                  fill={col} fillOpacity={0.82}/>
                {/* shimmer */}
                <rect x={LABEL_W} y={y + 2} width={barW} height={8} rx={5}
                  fill="rgba(255,255,255,0.15)"/>
              </>
            )}
            {/* count */}
            <text x={LABEL_W + barW + 7} y={y + 16} fill={col} fontSize={10} fontWeight={800}>
              {count}
            </text>
            {/* pct */}
            <text x={W} y={y + 16} fill="rgba(148,163,184,0.4)" fontSize={9} textAnchor="end">
              {pct}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Growth line chart (SVG) ──────────────────────────────────────────────────

function GrowthChart({ features }: { features: PredFeature[] }) {
  const top5 = useMemo(() => (
    [...features]
      .filter(f => f.properties.aadt_predicted && f.properties.growth_2040)
      .sort((a, b) => {
        const ra = (b.properties.growth_2040 ?? 0) / Math.max(b.properties.aadt_predicted ?? 1, 1);
        const rb = (a.properties.growth_2040 ?? 0) / Math.max(a.properties.aadt_predicted ?? 1, 1);
        return ra - rb;
      })
      .slice(0, 5)
  ), [features]);

  if (!top5.length) {
    return (
      <div style={{ color: 'rgba(148,163,184,0.35)', fontSize: 12, padding: '20px 0' }}>
        No forecast data available.
      </div>
    );
  }

  const getAadt = (f: PredFeature, yr: number): number => {
    if (yr <= 2025) return f.properties.aadt_predicted ?? 0;
    if (yr <= 2030) return f.properties.growth_2030  ?? (f.properties.aadt_predicted ?? 0) * 1.30;
    return               f.properties.growth_2040  ?? (f.properties.aadt_predicted ?? 0) * 1.90;
  };

  const years  = [2025, 2030, 2040];
  const allVals = top5.flatMap(f => years.map(yr => getAadt(f, yr)));
  const minV   = Math.min(...allVals) * 0.88;
  const maxV   = Math.max(...allVals) * 1.08;
  const range  = maxV - minV || 1;

  const W = 460, H = 170, PL = 54, PR = 12, PT = 10, PB = 26;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const xPos = (yr: number) => PL + ((yr - 2025) / 15) * chartW;
  const yPos = (v: number)  => PT + (1 - (v - minV) / range) * chartH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
        {/* horizontal grid */}
        {yTicks.map(t => {
          const y = PT + t * chartH;
          const v = maxV - t * range;
          return (
            <g key={t}>
              <line x1={PL} x2={PL + chartW} y1={y} y2={y}
                stroke="rgba(148,163,184,0.07)" strokeDasharray="3 3"/>
              <text x={PL - 5} y={y + 4}
                fill="rgba(148,163,184,0.42)" fontSize={8} textAnchor="end">
                {v >= 1000 ? `${(v/1000).toFixed(0)}k` : Math.round(v)}
              </text>
            </g>
          );
        })}

        {/* vertical year lines + labels */}
        {years.map(yr => (
          <g key={yr}>
            <line x1={xPos(yr)} x2={xPos(yr)} y1={PT} y2={PT + chartH}
              stroke="rgba(148,163,184,0.06)"/>
            <text x={xPos(yr)} y={H - 5}
              fill="rgba(148,163,184,0.55)" fontSize={9} textAnchor="middle">{yr}</text>
          </g>
        ))}

        {/* lines + dots per corridor */}
        {top5.map((f, i) => {
          const col = LINE_COLORS[i];
          const pts = years.map(yr => `${xPos(yr)},${yPos(getAadt(f, yr))}`).join(' ');
          return (
            <g key={f.properties.link_id}>
              <polyline
                points={pts} fill="none" stroke={col} strokeWidth={2.2}
                strokeLinejoin="round" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 4px ${col}99)` }}
              />
              {years.map(yr => (
                <circle
                  key={yr}
                  cx={xPos(yr)} cy={yPos(getAadt(f, yr))} r={3.5}
                  fill={col}
                  style={{ filter: `drop-shadow(0 0 5px ${col})` }}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend below SVG */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6 }}>
        {top5.map((f, i) => (
          <div key={f.properties.link_id}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 14, height: 2, background: LINE_COLORS[i], display: 'inline-block',
              borderRadius: 1, boxShadow: `0 0 5px ${LINE_COLORS[i]}`,
            }}/>
            <span style={{ fontSize: 9, color: LINE_COLORS[i], lineHeight: 1.3 }}>
              {(f.properties.link_name ?? f.properties.link_id ?? '').slice(0, 30)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function TrafficAnalytics() {
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [features, setFeatures] = useState<PredFeature[]>([]);
  const [stations, setStations] = useState<StationFeature[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/traffic_summary.json`).then(r => r.json()),
      fetch(`${base}data/traffic_predictions.geojson`).then(r => r.json()),
      fetch(`${base}atc_stations.geojson`).then(r => r.json()),  // public root
    ]).then(([summ, gj, stGJ]) => {
      setSummary(summ as Summary);
      setFeatures((gj.features ?? []) as PredFeature[]);
      setStations((stGJ.features ?? []) as StationFeature[]);
    }).catch(err => console.error('TrafficAnalytics load:', err))
      .finally(() => setLoading(false));
  }, []);

  // link_id → PredProps for station enrichment
  const predByLinkId = useMemo(
    () => new Map(features.map(f => [f.properties.link_id, f.properties])),
    [features],
  );

  // Top 10 busiest links by aadt_predicted
  const top10 = useMemo(() =>
    [...features]
      .filter(f => f.properties.aadt_predicted !== null)
      .sort((a, b) => (b.properties.aadt_predicted ?? 0) - (a.properties.aadt_predicted ?? 0))
      .slice(0, 10),
    [features],
  );

  // Network average AADT
  const avgAadt = useMemo(() =>
    features.length
      ? features.reduce((s, f) => s + (f.properties.aadt_predicted ?? 0), 0) / features.length
      : 0,
    [features],
  );

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'rgba(148,163,184,0.5)', fontSize: 13,
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}>
        Loading traffic analytics…
      </div>
    );
  }

  const breakdown   = summary?.congestion_breakdown ?? {};
  const topCorridor = summary?.highest_growth_corridor_2040;
  const growthPct   = topCorridor
    ? Math.round((topCorridor.aadt_2040 / Math.max(topCorridor.aadt_2025, 1) - 1) * 100)
    : null;

  return (
    <div style={{
      padding: '24px 24px 36px',
      fontFamily: "'Inter','Segoe UI',sans-serif",
      color: '#e2eaf4',
    }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 22 }}>
        <div style={{
          fontSize: 9, fontWeight: 800, color: 'rgba(255,210,63,0.55)',
          letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 3,
        }}>
          Uganda National Roads · Demand Analysis · ML Ensemble 2025–2040
        </div>
        <div style={{
          fontSize: 22, fontWeight: 900, color: C.yellow, lineHeight: 1.2,
          textShadow: '0 0 22px rgba(255,210,63,0.4)',
        }}>
          Traffic Analytics
        </div>
        <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)', marginTop: 4 }}>
          {features.length.toLocaleString()} road links · {stations.length} ATC stations ·
          XGBoost + LightGBM ensemble · Forecasts to 2040
        </div>
      </div>

      {/* ── KPI row ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18,
      }}>
        <KpiCard
          label="Vehicle-km / day"
          value={summary
            ? `${((summary.total_vehicle_km_daily) / 1e6).toFixed(0)}M`
            : '—'}
          sub="Total network vehicle-kilometres"
          color={C.cyan}
        />
        <KpiCard
          label="Links at capacity risk"
          value={summary
            ? `${summary.links_at_capacity_risk_pct.toFixed(1)}%`
            : '—'}
          sub="High + Critical congestion risk"
          color={C.pink}
        />
        <KpiCard
          label="Highest growth corridor"
          value={growthPct !== null ? `+${growthPct}%` : '—'}
          sub={topCorridor
            ? `${topCorridor.link_name} · ${(topCorridor.aadt_2025/1000).toFixed(0)}k → ${(topCorridor.aadt_2040/1000).toFixed(0)}k`
            : 'Loading…'}
          color={C.green}
        />
        <KpiCard
          label="Avg network AADT"
          value={avgAadt > 0 ? Math.round(avgAadt).toLocaleString() : '—'}
          sub={`Mean across ${features.length} links · veh/day`}
          color={C.yellow}
        />
      </div>

      {/* ── Row 2: Congestion breakdown (left) + Top 10 table (right) ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1.65fr', gap: 14, marginBottom: 14,
        alignItems: 'start',
      }}>

        {/* Congestion breakdown */}
        <div style={{ ...GLASS, padding: '18px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 3 }}>
            Congestion Risk Distribution
          </div>
          <div style={{
            fontSize: 10, color: 'rgba(148,163,184,0.45)', marginBottom: 18,
          }}>
            ML-predicted risk level · all {features.length} road links
          </div>
          <CongestionBars breakdown={breakdown}/>

          {/* summary pills */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16,
            paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            {(['Critical', 'High', 'Medium', 'Low'] as const).map(level => {
              const count = breakdown[level] ?? 0;
              const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
              const col   = CONG_COLORS[level];
              return (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', background: col,
                    boxShadow: `0 0 6px ${col}`, display: 'inline-block', flexShrink: 0,
                  }}/>
                  <span style={{ fontSize: 10, color: col, fontWeight: 700 }}>{level}</span>
                  <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', marginLeft: 'auto' }}>
                    {count}{' '}
                    <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.3)' }}>
                      ({total ? Math.round((count / total) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 10 busiest links */}
        <div style={{ ...GLASS, padding: '18px 20px', overflowX: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 3 }}>
            Top 10 Busiest Road Links
          </div>
          <div style={{
            fontSize: 10, color: 'rgba(148,163,184,0.45)', marginBottom: 14,
          }}>
            Sorted by predicted AADT 2025 · ML ensemble forecast
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,245,255,0.12)' }}>
                {['#', 'Road Link', 'Cls', 'AADT 2025', 'AADT 2040', 'Risk'].map(h => (
                  <th key={h} style={{
                    padding: '4px 8px', textAlign: 'left',
                    fontSize: 8, fontWeight: 800, color: 'rgba(0,245,255,0.55)',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top10.map((f, i) => {
                const p   = f.properties;
                const col = CONG_COLORS[p.congestion_risk ?? 'Low'] ?? '#94a3b8';
                const rgb = hexRgb(col);
                return (
                  <tr key={p.link_id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{
                      padding: '6px 8px', color: 'rgba(148,163,184,0.35)', fontWeight: 700,
                    }}>{i + 1}</td>
                    <td style={{
                      padding: '6px 8px', color: '#e2eaf4', fontWeight: 600,
                      maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.link_name ?? p.link_id}
                      {p.region && (
                        <span style={{ color: 'rgba(148,163,184,0.4)', fontWeight: 400, marginLeft: 4 }}>
                          · {p.region}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', color: 'rgba(148,163,184,0.55)' }}>
                      {p.road_class ?? '—'}
                    </td>
                    <td style={{
                      padding: '6px 8px', color: C.cyan, fontWeight: 800, fontFamily: 'monospace',
                    }}>
                      {(p.aadt_predicted ?? 0).toLocaleString()}
                    </td>
                    <td style={{
                      padding: '6px 8px', color: C.orange, fontWeight: 800, fontFamily: 'monospace',
                    }}>
                      {p.growth_2040 ? p.growth_2040.toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 8, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
                        background: `rgba(${rgb},0.15)`,
                        border: `1px solid rgba(${rgb},0.38)`, color: col,
                      }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: col, display: 'inline-block',
                        }}/>
                        {p.congestion_risk ?? 'Low'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Row 3: Growth chart (left) + ATC stations table (right) ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14,
        alignItems: 'start',
      }}>

        {/* Growth forecast line chart */}
        <div style={{ ...GLASS, padding: '18px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 3 }}>
            AADT Growth Forecast — Top 5 Corridors
          </div>
          <div style={{
            fontSize: 10, color: 'rgba(148,163,184,0.45)', marginBottom: 14,
          }}>
            2025 → 2030 → 2040 · Ranked by highest growth rate
          </div>
          <GrowthChart features={features}/>
        </div>

        {/* ATC stations table */}
        <div style={{ ...GLASS, padding: '18px 20px', overflowY: 'auto', maxHeight: 440 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 3 }}>
            ATC Station Network
          </div>
          <div style={{
            fontSize: 10, color: 'rgba(148,163,184,0.45)', marginBottom: 14,
          }}>
            {stations.length} traffic count stations · AADT from ML predictions
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,212,170,0.14)' }}>
                {['Station', 'Road', 'Region', 'AADT', 'Heavy %'].map(h => (
                  <th key={h} style={{
                    padding: '4px 6px', textAlign: 'left',
                    fontSize: 8, fontWeight: 800, color: 'rgba(0,212,170,0.6)',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.slice(0, 40).map((s, i) => {
                const p    = s.properties;
                const pred = predByLinkId.get(p.Link_ID ?? '');
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{
                      padding: '4px 6px', fontWeight: 700,
                      color: C.teal, fontSize: 9,
                    }}>
                      {p.TCS_NAME ?? p.STATION ?? '—'}
                    </td>
                    <td style={{
                      padding: '4px 6px', color: 'rgba(226,234,244,0.7)',
                      maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', fontSize: 9,
                    }}>
                      {p.Link_Name ?? '—'}
                    </td>
                    <td style={{ padding: '4px 6px', color: 'rgba(148,163,184,0.55)', fontSize: 9 }}>
                      {p.REGION ?? '—'}
                    </td>
                    <td style={{
                      padding: '4px 6px', color: C.cyan,
                      fontFamily: 'monospace', fontSize: 9, fontWeight: 700,
                    }}>
                      {pred?.aadt_predicted
                        ? pred.aadt_predicted.toLocaleString()
                        : <span style={{ color: 'rgba(148,163,184,0.25)' }}>—</span>}
                    </td>
                    <td style={{
                      padding: '4px 6px', color: C.orange,
                      fontFamily: 'monospace', fontSize: 9, fontWeight: 700,
                    }}>
                      {pred?.heavy_vehicle_pct !== undefined && pred.heavy_vehicle_pct !== null
                        ? `${pred.heavy_vehicle_pct.toFixed(0)}%`
                        : <span style={{ color: 'rgba(148,163,184,0.25)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {stations.length > 40 && (
            <div style={{
              marginTop: 8, fontSize: 9, color: 'rgba(148,163,184,0.3)', textAlign: 'center',
            }}>
              Showing 40 of {stations.length} stations
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        marginTop: 22, fontSize: 8, color: 'rgba(100,116,139,0.35)', textAlign: 'center',
      }}>
        Uganda National Roads · UNRA / DNR 2025 · XGBoost + LightGBM ensemble ·
        ATC data: UNRA Traffic Management Unit · Forecasts modelled 2025–2040
      </div>
    </div>
  );
}
