/**
 * PavementAgePanel — age-based reporting for the national network (FY25-26).
 * Source: network_links.json pavement_age (NDPIV FY25-26 master); where the
 * column is blank the age is derived predictively as CURRENT_YEAR minus the
 * most recent of last-intervention / rehabilitation / completion year.
 * Remaining life = design life (20y bituminous, 7y unsealed regravel cycle)
 * minus current age — the same forward-carry principle as the traffic models.
 */
import { useEffect, useMemo, useState } from 'react';
import { CURRENT_YEAR } from '../../shared/year';

interface Link {
  link_id: string | null; road_no: string | null; road_class: string | null;
  link_name: string | null; length_km: number | null; surface_type: string | null;
  maintenance_region: string | null; maintenance_station: string | null;
  completion_year: number | string | null; rehab_year: number | string | null;
  last_intervention: number | string | null; pavement_age: number | string | null;
}

const DESIGN_LIFE = { paved: 20, unpaved: 7 };
const BANDS = [
  { label: '0–5 yrs',   min: 0,  max: 5,        color: '#00ff88' },
  { label: '6–10 yrs',  min: 6,  max: 10,       color: '#00d4aa' },
  { label: '11–15 yrs', min: 11, max: 15,       color: '#ffd23f' },
  { label: '16–20 yrs', min: 16, max: 20,       color: '#ff6b35' },
  { label: '>20 yrs',   min: 21, max: Infinity, color: '#ff2d78' },
];

const yr = (v: number | string | null): number | null => {
  const n = typeof v === 'string' ? parseInt(v, 10) : v;
  return n != null && Number.isFinite(n) && n > 1900 && n <= CURRENT_YEAR ? n : null;
};
const isPaved = (s: string | null) =>
  !!s && /bitum|sealed|concrete|paved/i.test(s) && !/unsealed|unpaved/i.test(s);

function ageOf(l: Link): { age: number | null; derived: boolean } {
  const direct = typeof l.pavement_age === 'string' ? parseFloat(l.pavement_age) : l.pavement_age;
  if (direct != null && Number.isFinite(direct) && direct >= 0 && direct < 120) {
    return { age: Math.round(direct as number), derived: false };
  }
  const base = Math.max(yr(l.last_intervention) ?? 0, yr(l.rehab_year) ?? 0, yr(l.completion_year) ?? 0);
  return base ? { age: CURRENT_YEAR - base, derived: true } : { age: null, derived: false };
}

export default function PavementAgePanel() {
  const [links, setLinks] = useState<Link[]>([]);
  const [region, setRegion] = useState('all');
  const [surface, setSurface] = useState<'all' | 'paved' | 'unpaved'>('all');
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/network_links.json`)
      .then(r => r.json()).then(setLinks).catch(() => setLinks([]));
  }, []);

  const rows = useMemo(() => links.map(l => {
    const { age, derived } = ageOf(l);
    const paved = isPaved(l.surface_type);
    const life = paved ? DESIGN_LIFE.paved : DESIGN_LIFE.unpaved;
    return {
      ...l, age, derived, paved,
      km: l.length_km ?? 0,
      remaining: age != null ? Math.max(0, life - age) : null,
      overLife: age != null && age > life,
    };
  }), [links]);

  const regions = useMemo(() =>
    [...new Set(rows.map(r => r.maintenance_region).filter(Boolean))].sort() as string[], [rows]);

  const filtered = useMemo(() => rows.filter(r =>
    (region === 'all' || r.maintenance_region === region) &&
    (surface === 'all' || (surface === 'paved') === r.paved)), [rows, region, surface]);

  const aged = filtered.filter(r => r.age != null);

  const stats = useMemo(() => {
    const kmW = (sel: typeof aged) => {
      const wk = sel.reduce((a, r) => a + r.km, 0);
      return wk ? sel.reduce((a, r) => a + (r.age as number) * r.km, 0) / wk : null;
    };
    const overKm = aged.filter(r => r.overLife).reduce((a, r) => a + r.km, 0);
    const totKm = aged.reduce((a, r) => a + r.km, 0);
    return {
      avg: kmW(aged), avgPaved: kmW(aged.filter(r => r.paved)), avgUnpaved: kmW(aged.filter(r => !r.paved)),
      overKm, totKm, overPct: totKm ? 100 * overKm / totKm : 0,
      coverage: filtered.length ? 100 * aged.length / filtered.length : 0,
      derived: aged.filter(r => r.derived).length,
    };
  }, [aged, filtered]);

  const bands = useMemo(() => BANDS.map(b => {
    const sel = aged.filter(r => (r.age as number) >= b.min && (r.age as number) <= b.max);
    return { ...b, km: sel.reduce((a, r) => a + r.km, 0), links: sel.length };
  }), [aged]);
  const maxBandKm = Math.max(1, ...bands.map(b => b.km));

  const byRegion = useMemo(() => regions.map(rg => {
    const sel = aged.filter(r => r.maintenance_region === rg);
    const km = sel.reduce((a, r) => a + r.km, 0);
    const avg = km ? sel.reduce((a, r) => a + (r.age as number) * r.km, 0) / km : null;
    const over = sel.filter(r => r.overLife).reduce((a, r) => a + r.km, 0);
    return { region: rg, km, avg, overPct: km ? 100 * over / km : 0 };
  }).filter(r => r.km > 0).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)), [aged, regions]);

  const oldest = useMemo(() =>
    [...aged].sort((a, b) => sortDesc
      ? (b.age as number) - (a.age as number)
      : (a.age as number) - (b.age as number)),
    [aged, sortDesc]);

  const CARD: React.CSSProperties = {
    background: 'rgba(8,14,28,0.7)', border: '1px solid rgba(255,107,53,0.16)',
    borderRadius: 10, padding: '12px 14px',
  };
  const TH: React.CSSProperties = {
    textAlign: 'left', padding: '6px 10px', fontSize: 9.5, fontWeight: 800,
    color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid rgba(255,107,53,0.18)', position: 'sticky', top: 0,
    background: 'rgba(4,9,18,0.95)',
  };
  const TD: React.CSSProperties = {
    padding: '5px 10px', fontSize: 11, color: 'rgba(203,213,225,0.85)',
    borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap',
  };
  const SEL: React.CSSProperties = {
    background: 'rgba(10,16,30,0.9)', color: '#e2e8f0', border: '1px solid rgba(255,107,53,0.3)',
    borderRadius: 7, fontSize: 11, padding: '6px 9px',
  };

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#e2eaf4' }}>
            Pavement Age — {CURRENT_YEAR} reporting
          </div>
          <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.65)' }}>
            FY25-26 NDPIV master · ages carried forward to {CURRENT_YEAR}; blanks derived from last
            intervention/rehab/completion · design life {DESIGN_LIFE.paved}y bituminous / {DESIGN_LIFE.unpaved}y unsealed
          </div>
        </div>
        <select value={region} onChange={e => setRegion(e.target.value)} style={SEL}>
          <option value="all">All regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={surface} onChange={e => setSurface(e.target.value as 'all' | 'paved' | 'unpaved')} style={SEL}>
          <option value="all">All surfaces</option>
          <option value="paved">Bituminous (paved)</option>
          <option value="unpaved">Unsealed</option>
        </select>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        {([
          ['Network avg age', stats.avg != null ? `${stats.avg.toFixed(1)} yrs` : '—', '#ff6b35'],
          ['Bituminous avg', stats.avgPaved != null ? `${stats.avgPaved.toFixed(1)} yrs` : '—', '#00d4aa'],
          ['Unsealed avg', stats.avgUnpaved != null ? `${stats.avgUnpaved.toFixed(1)} yrs` : '—', '#ffd23f'],
          ['Beyond design life', `${stats.overPct.toFixed(1)}%`, '#ff2d78'],
          ['km beyond life', `${Math.round(stats.overKm).toLocaleString()} km`, '#ff2d78'],
          ['Age data coverage', `${stats.coverage.toFixed(0)}%`, '#4d9fff'],
        ] as Array<[string, string, string]>).map(([label, v, color]) => (
          <div key={label} style={CARD}>
            <div style={{ fontSize: 19, fontWeight: 900, color, lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.65)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(300px, 1.1fr)', gap: 12, marginBottom: 14 }}>
        {/* Age distribution */}
        <div style={CARD}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#e2eaf4', marginBottom: 10 }}>
            Age distribution (km{region !== 'all' ? ` · ${region}` : ''})
          </div>
          {bands.map(b => (
            <div key={b.label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                <span style={{ color: b.color, fontWeight: 700 }}>{b.label}</span>
                <span style={{ color: 'rgba(148,163,184,0.7)' }}>
                  {Math.round(b.km).toLocaleString()} km · {b.links} links
                </span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ width: `${100 * b.km / maxBandKm}%`, height: '100%', borderRadius: 5,
                  background: b.color, boxShadow: `0 0 8px ${b.color}66` }} />
              </div>
            </div>
          ))}
          <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.6)', marginTop: 8 }}>
            {stats.derived} link ages derived predictively from intervention history
          </div>
        </div>

        {/* By region */}
        <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '11px 12px 7px', fontSize: 11.5, fontWeight: 800, color: '#e2eaf4' }}>
            Km-weighted age by maintenance region
          </div>
          <div style={{ maxHeight: 235, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>Region</th><th style={TH}>Network km</th>
                <th style={TH}>Avg age</th><th style={TH}>Beyond design life</th>
              </tr></thead>
              <tbody>
                {byRegion.map(r => (
                  <tr key={r.region}>
                    <td style={{ ...TD, fontWeight: 700, color: '#9bd0ff' }}>{r.region}</td>
                    <td style={TD}>{Math.round(r.km).toLocaleString()}</td>
                    <td style={{ ...TD, fontWeight: 800,
                      color: (r.avg ?? 0) > 15 ? '#ff2d78' : (r.avg ?? 0) > 10 ? '#ffd23f' : '#00ff88' }}>
                      {r.avg != null ? `${r.avg.toFixed(1)} yrs` : '—'}
                    </td>
                    <td style={{ ...TD, color: r.overPct > 30 ? '#ff2d78' : TD.color }}>{r.overPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Oldest links */}
      <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '11px 12px 7px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#e2eaf4', flex: 1 }}>
            All links with age data · {aged.length} (sorted {sortDesc ? 'oldest' : 'youngest'} first)
          </div>
          <button onClick={() => setSortDesc(d => !d)} style={{
            padding: '5px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.3)', color: '#ff6b35' }}>
            Sort: {sortDesc ? 'oldest first' : 'youngest first'}
          </button>
        </div>
        <div style={{ maxHeight: 560, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={TH}>Link</th><th style={TH}>Name</th><th style={TH}>Class</th>
              <th style={TH}>Surface</th><th style={TH}>Region</th><th style={TH}>Km</th>
              <th style={TH}>Age ({CURRENT_YEAR})</th><th style={TH}>Remaining life</th><th style={TH}>Last intervention</th>
            </tr></thead>
            <tbody>
              {oldest.map(r => (
                <tr key={`${r.link_id}-${r.link_name}`}>
                  <td style={{ ...TD, fontWeight: 700, color: '#9bd0ff' }}>{r.link_id}</td>
                  <td style={{ ...TD, whiteSpace: 'normal', maxWidth: 260 }}>{r.link_name}</td>
                  <td style={TD}>{r.road_class}</td>
                  <td style={TD}>{r.surface_type}</td>
                  <td style={TD}>{r.maintenance_region}</td>
                  <td style={TD}>{r.km.toFixed(1)}</td>
                  <td style={{ ...TD, fontWeight: 800, color: r.overLife ? '#ff2d78' : '#ffd23f' }}>
                    {r.age} yrs{r.derived ? ' *' : ''}
                  </td>
                  <td style={{ ...TD, color: r.remaining === 0 ? '#ff2d78' : '#00d4aa' }}>
                    {r.remaining === 0 ? 'EXCEEDED' : `${r.remaining} yrs`}
                  </td>
                  <td style={TD}>{yr(r.last_intervention) ?? yr(r.rehab_year) ?? yr(r.completion_year) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '7px 12px', fontSize: 9, color: 'rgba(100,116,139,0.6)' }}>
          * age derived from intervention history · remaining life = design life − current age (floored at 0)
        </div>
      </div>
    </div>
  );
}
