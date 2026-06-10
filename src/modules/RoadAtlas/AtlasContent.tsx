/**
 * AtlasContent — Uganda National Road Network Visual Intelligence Atlas
 *
 * Renders the full national road network dashboard using the live dashboard
 * bundle from /api/dashboard-bundle (or /data/bundle.json fallback).
 */
import { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useDashboardBundle } from '../../hooks/useDashboardBundle';

// ─── Shared chart tooltip style ───────────────────────────────────────────────
const TT = {
  contentStyle: {
    background: 'rgba(6,13,24,0.97)',
    border: '1px solid rgba(0,245,255,0.15)',
    borderRadius: 8, fontSize: 11,
  },
};

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{
        margin: 0, fontSize: 22, fontWeight: 900, color: '#f1f5f9',
        borderLeft: '4px solid #f97316', paddingLeft: 14, lineHeight: 1.2,
      }}>{title}</h2>
      {sub && (
        <p style={{ margin: '6px 0 0 18px', fontSize: 12, color: 'rgba(148,163,184,0.7)' }}>{sub}</p>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, unit, sub, color = '#00f5ff',
}: {
  label: string; value: string | number; unit?: string; sub?: string; color?: string;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '18px 20px',
    }}>
      <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>
        {value}<span style={{ fontSize: 14, marginLeft: 4, opacity: 0.7 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────
function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '20px 20px 16px',
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>{title}</div>
        {sub && <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

// ─── Loading / Error placeholders ─────────────────────────────────────────────
function LoadingPanel() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'rgba(148,163,184,0.4)' }}>
      <div>
        <div style={{ width: 32, height: 32, border: '2px solid #1e3a5f', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 11 }}>Loading intelligence data…</div>
      </div>
    </div>
  );
}

// ─── Main atlas content ───────────────────────────────────────────────────────
export default function AtlasContent() {
  const { bundle, isLoading, error, lastUpdated } = useDashboardBundle();

  // ── Extract data from bundle ──────────────────────────────────────────────
  const pavedTimeline = useMemo(() => {
    const rows = bundle?.roadPublicReferences?.paved_stock_timeline ?? [];
    return rows
      .filter(r => r.financial_year && (r.stock_paved_roads_km ?? 0) > 0)
      .map(r => {
        const fy = r.financial_year ?? '';
        const yr = parseInt(fy.split('/')[0]);
        return {
          fy,
          year: isNaN(yr) ? 0 : yr < 100 ? 2000 + yr : yr,
          km: r.stock_paved_roads_km ?? 0,
          pct: r.percent_paved_network ?? 0,
          delta: r.annual_increase_km ?? 0,
          ndp: r.ndp ?? '',
        };
      })
      .filter(r => r.year > 1980)
      .sort((a, b) => a.year - b.year);
  }, [bundle]);

  const trafficRows = useMemo(() => {
    return (bundle?.roadExcelAnalytics?.traffic?.year_summary ?? [])
      .filter(r => r.year && r.network_weighted_motorised_aadt)
      .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  }, [bundle]);

  const assetValues = useMemo(() => {
    return (bundle?.assetValueUpdate?.rows ?? [])
      .filter(r => r.fy && r.crcBillionUgx)
      .map(r => {
        const parts = (r.fy ?? '').split('/');
        const yr = parseInt(parts[0]);
        return {
          fy: r.fy ?? '',
          year: isNaN(yr) ? 0 : yr < 100 ? 2000 + yr : yr,
          crc: r.crcBillionUgx ?? 0,
          cdrc: r.cdrcBillionUgx ?? 0,
          gap: r.valueGapBillionUgx ?? 0,
        };
      })
      .filter(r => r.year > 2010)
      .sort((a, b) => a.year - b.year);
  }, [bundle]);

  const conditionCycles = useMemo(() => {
    return (bundle?.roadExcelAnalytics?.paved_condition?.cycles ?? [])
      .filter(c => c.summary?.cycle)
      .map(c => ({
        cycle: c.summary?.cycle ?? '',
        vci: c.summary?.weighted_average_vci ?? 0,
        iri: c.summary?.weighted_average_roughness ?? 0,
        coverage: c.summary?.survey_coverage_pct_of_inventory ?? 0,
      }));
  }, [bundle]);

  const regions = useMemo(() => {
    return bundle?.roadNetworkIntelligence?.regionIntelligence ?? [];
  }, [bundle]);

  const latestPaved = pavedTimeline[pavedTimeline.length - 1];
  const earliest    = pavedTimeline[0];
  const growthPct   = earliest && latestPaved
    ? (((latestPaved.km - earliest.km) / earliest.km) * 100)
    : 0;

  const latestTraffic = trafficRows[trafficRows.length - 1];
  const latestValue   = assetValues[assetValues.length - 1];
  const latestCondition = conditionCycles[conditionCycles.length - 1];

  if (isLoading && !bundle) return <LoadingPanel />;

  return (
    <div style={{
      maxWidth: 1400, margin: '0 auto',
      padding: '40px 32px 80px',
      fontFamily: '"Aptos Display","Segoe UI Variable Display",Bahnschrift,sans-serif',
    }}>
      {/* ── Header banner ── */}
      <div style={{
        marginBottom: 48, padding: '28px 32px',
        background: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(59,130,246,0.08) 100%)',
        border: '1px solid rgba(249,115,22,0.2)',
        borderRadius: 20,
      }}>
        <div style={{ fontSize: 11, color: 'rgba(249,115,22,0.8)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
          INTELLIGENCE ATLAS
        </div>
        <h1 style={{ margin: '0 0 6px', fontSize: 32, fontWeight: 900, color: '#f1f5f9', lineHeight: 1.1 }}>
          Uganda National Road Network
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'rgba(148,163,184,0.7)' }}>
          Visual intelligence platform · 21,160 km (mapped) national network · Data: DNR GIS Jun 2025 · DNR / MoWT
        </p>
        {lastUpdated && (
          <div style={{ marginTop: 12, fontSize: 10, color: 'rgba(148,163,184,0.4)' }}>
            Data updated: {new Date(lastUpdated).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 12, fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '6px 12px', borderRadius: 6 }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Network summary KPIs ── */}
      <SectionHeading title="Network Overview" sub="Current state of Uganda's national road network" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 48 }}>
        <StatCard label="Total Network" value="21,160" unit="km" sub="1,013 road links · Jun 2025" color="#00f5ff" />
        <StatCard
          label="Paved Stock"
          value={latestPaved ? latestPaved.km.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '6,312'}
          unit="km"
          sub={latestPaved ? `${latestPaved.pct.toFixed(1)}% of network · FY${latestPaved.fy}` : '30.1% of network'}
          color="#00ff88"
        />
        <StatCard
          label="Network Traffic"
          value={latestTraffic ? Math.round(latestTraffic.network_weighted_motorised_aadt ?? 0).toLocaleString() : '2,562'}
          unit="AADT"
          sub={latestTraffic ? `Motorised · ${latestTraffic.year}` : 'Motorised · 2025'}
          color="#ffd23f"
        />
        <StatCard
          label="Growth Since 1986"
          value={`+${growthPct.toFixed(0)}`}
          unit="%"
          sub={latestPaved && earliest ? `${earliest.km.toLocaleString()} → ${latestPaved.km.toLocaleString()} km` : 'Liberation to present'}
          color="#f97316"
        />
      </div>

      {/* ── Paved stock growth chart ── */}
      <SectionHeading title="Paved Road Stock Growth" sub="Historical expansion of paved network since 1986" />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 48 }}>
        <ChartCard title="Cumulative Paved Stock (km)" sub="FY 1986/87 – present">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={pavedTimeline} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="atlasGradPaved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00ff88" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={48}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...TT} formatter={(v: number) => [`${v.toLocaleString()} km`, 'Paved stock']} />
              <Area type="monotone" dataKey="km" stroke="#00ff88" strokeWidth={2} fill="url(#atlasGradPaved)"
                dot={false} animationDuration={600} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Annual Paving Rate (km/yr)" sub="Net km added per financial year">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pavedTimeline.filter(r => r.delta > 0)} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 8 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip {...TT} formatter={(v: number) => [`${v.toLocaleString()} km`, 'Added']} />
              <Bar dataKey="delta" fill="#f97316" radius={[3, 3, 0, 0]} animationDuration={600} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Traffic growth ── */}
      {trafficRows.length > 0 && (
        <>
          <SectionHeading title="Network Traffic" sub="Length-weighted motorised AADT at traffic count stations" />
          <div style={{ marginBottom: 48 }}>
            <ChartCard title="Motorised AADT Growth" sub="Network-weighted average annual daily traffic">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trafficRows} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={50}
                    tickFormatter={(v: number) => v.toLocaleString()} />
                  <Tooltip {...TT} formatter={(v: number) => [`${v.toLocaleString()} AADT`, 'Motorised']} />
                  <Line type="monotone" dataKey="network_weighted_motorised_aadt"
                    stroke="#ffd23f" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#ffd23f', strokeWidth: 0 }}
                    animationDuration={600} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}

      {/* ── Asset values ── */}
      {assetValues.length > 0 && (
        <>
          <SectionHeading title="Asset Value" sub="Road network replacement cost and current depreciated value" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
            {latestValue && (
              <>
                <StatCard label="Replacement Cost (CRC)" value={`${latestValue.crc.toFixed(0)}`} unit="UGX bn"
                  sub={`FY ${latestValue.fy}`} color="#00f5ff" />
                <StatCard label="Depreciated Value (CDRC)" value={`${latestValue.cdrc.toFixed(0)}`} unit="UGX bn"
                  sub={`FY ${latestValue.fy}`} color="#00ff88" />
                <StatCard label="Value Gap" value={`${latestValue.gap.toFixed(0)}`} unit="UGX bn"
                  sub="Maintenance backlog" color="#ef4444" />
              </>
            )}
          </div>
          <div style={{ marginBottom: 48 }}>
            <ChartCard title="Asset Value Trend" sub="CRC vs CDRC — UGX billion">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={assetValues} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="fy" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={52}
                    tickFormatter={(v: number) => `${v.toFixed(0)}bn`} />
                  <Tooltip {...TT}
                    formatter={(v: number, name: string) => [
                      `${v.toFixed(0)} UGX bn`,
                      name === 'crc' ? 'Replacement Cost' : name === 'cdrc' ? 'Depreciated Value' : 'Value Gap',
                    ]} />
                  <Line type="monotone" dataKey="crc" stroke="#00f5ff" strokeWidth={2} dot={false} animationDuration={600} />
                  <Line type="monotone" dataKey="cdrc" stroke="#00ff88" strokeWidth={2} dot={false} animationDuration={600} />
                  <Line type="monotone" dataKey="gap" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 3" dot={false} animationDuration={600} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 10 }}>
                {[
                  { color: '#00f5ff', label: 'Replacement Cost (CRC)' },
                  { color: '#00ff88', label: 'Depreciated Value (CDRC)' },
                  { color: '#ef4444', label: 'Value Gap' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(148,163,184,0.7)' }}>
                    <div style={{ width: 20, height: 2, background: l.color, borderRadius: 1 }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        </>
      )}

      {/* ── Pavement condition ── */}
      {conditionCycles.length > 0 && (
        <>
          <SectionHeading title="Pavement Condition" sub="VCI and IRI from road condition survey cycles" />
          <div style={{ marginBottom: 48 }}>
            <ChartCard title="Weighted Average VCI per Survey Cycle" sub="Higher = better condition">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={conditionCycles} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="cycle" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip {...TT}
                    formatter={(v: number, name: string) => [
                      `${v.toFixed(1)}${name === 'vci' ? '' : ' m/km'}`,
                      name === 'vci' ? 'VCI (0-100)' : 'Avg IRI',
                    ]} />
                  <Bar dataKey="vci" fill="#4d9fff" radius={[4, 4, 0, 0]} animationDuration={600} />
                </BarChart>
              </ResponsiveContainer>
              {latestCondition && (
                <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>
                  Latest cycle: {latestCondition.cycle} · VCI {latestCondition.vci.toFixed(1)} ·
                  IRI {latestCondition.iri.toFixed(2)} m/km · {latestCondition.coverage.toFixed(0)}% coverage
                </div>
              )}
            </ChartCard>
          </div>
        </>
      )}

      {/* ── Regional intelligence ── */}
      {regions.length > 0 && (
        <>
          <SectionHeading title="Regional Intelligence" sub="Traffic, condition and stress scores by maintenance region" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 14, marginBottom: 48,
          }}>
            {regions.map(r => {
              const stress = r.stressScore ?? 0;
              const stressColor = stress > 7 ? '#ef4444' : stress > 4 ? '#f59e0b' : '#22c55e';
              return (
                <div key={r.region} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, padding: '16px 18px',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9', marginBottom: 10 }}>
                    {r.region}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {r.averageObservedAdt !== undefined && (
                      <div>
                        <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Avg AADT</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#ffd23f' }}>
                          {Math.round(r.averageObservedAdt).toLocaleString()}
                        </div>
                      </div>
                    )}
                    {r.weightedAverageVci !== undefined && (
                      <div>
                        <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Avg VCI</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#4d9fff' }}>
                          {r.weightedAverageVci.toFixed(1)}
                        </div>
                      </div>
                    )}
                    {r.projects !== undefined && (
                      <div>
                        <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Projects</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#00ff88' }}>{r.projects}</div>
                      </div>
                    )}
                    {r.stressScore !== undefined && (
                      <div>
                        <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stress</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: stressColor }}>
                          {stress.toFixed(1)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Footer ── */}
      <div style={{
        marginTop: 24, paddingTop: 24,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 10, color: 'rgba(148,163,184,0.35)',
      }}>
        <span>Uganda National Roads Management Platform · Dept. of National Roads · MoWT</span>
        <span>Data: {lastUpdated ? new Date(lastUpdated).toLocaleDateString('en-UG') : '—'}</span>
      </div>
    </div>
  );
}
