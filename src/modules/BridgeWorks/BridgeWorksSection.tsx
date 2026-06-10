/**
 * BridgeWorksSection — MOWT "Bridges Development Projects" status (April 2026).
 * Source: app_data/bridge_works_2026.json (extracted from the MOWT Projects
 * Status Report). Reads live from Supabase `bridge_works` when available, else
 * the bundled JSON. Styled with Glassmorphism / Neumorphism / Liquid-Glass.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  HardHat, Building2, TrendingUp, Wallet, CircleDollarSign, Hammer,
  UserCog, Search, Layers,
} from 'lucide-react';
import { glass, neu, liquidGlass, neuProgressTrack, progressFill } from '../../shared/glass';
import { supabase } from '../../lib/supabase';

interface BridgeWork {
  id: string; lot: string; funder: string;
  contractor: string | null; supervisor: string | null;
  project_manager: string | null; project_engineer: string | null;
  contract_sum_ugx: number | null; amount_certified_ugx: number | null;
  amount_paid_ugx: number | null; outstanding_ugx: number | null;
  physical_progress_pct: number | null; status: string;
  compensation: string; report_period: string;
}

const C = { cyan: '#00f5ff', teal: '#00d4aa', blue: '#4d9fff', green: '#00ff88',
  yellow: '#ffd23f', orange: '#ff6b35', red: '#ff3366', purple: '#b967ff', gray: '#94a3b8' };

const bn = (n?: number | null) => (n == null ? '—' : `${(n / 1e9).toFixed(2)} Bn`);
function progColor(p: number | null): string {
  if (p == null) return C.gray;
  if (p >= 90) return C.green;
  if (p >= 70) return C.yellow;
  if (p >= 40) return C.orange;
  return C.red;
}

export default function BridgeWorksSection() {
  const [works, setWorks] = useState<BridgeWork[]>([]);
  const [src, setSrc] = useState<'supabase' | 'bundle' | 'loading'>('loading');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      // Prefer the live Supabase table; fall back to the bundled JSON.
      try {
        const { data, error } = await supabase.from('bridge_works').select('*').order('id');
        if (!error && data && data.length) {
          if (alive) { setWorks(data as BridgeWork[]); setSrc('supabase'); }
          return;
        }
      } catch { /* fall through */ }
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}data/bridge_works_2026.json`);
        const j = await r.json();
        if (alive) { setWorks(j); setSrc('bundle'); }
      } catch { if (alive) setSrc('bundle'); }
    })();
    return () => { alive = false; };
  }, []);

  const kpis = useMemo(() => {
    const sum = works.reduce((a, w) => a + (w.contract_sum_ugx || 0), 0);
    const paid = works.reduce((a, w) => a + (w.amount_paid_ugx || 0), 0);
    const withProg = works.filter(w => w.physical_progress_pct != null);
    const avg = withProg.length ? withProg.reduce((a, w) => a + (w.physical_progress_pct || 0), 0) / withProg.length : 0;
    return { count: works.length, sum, paid, avg };
  }, [works]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return works;
    return works.filter(w =>
      `${w.lot} ${w.contractor} ${w.funder} ${w.project_manager}`.toLowerCase().includes(s));
  }, [works, q]);

  return (
    <div style={{ padding: '22px 20px', minHeight: '100%',
      background: 'radial-gradient(1200px 600px at 80% -10%, rgba(0,212,170,0.10), transparent), linear-gradient(180deg, rgba(8,14,28,0.5), transparent)' }}>

      {/* ── Liquid-glass header ── */}
      <div style={{ ...liquidGlass(C.teal, 20), padding: '18px 22px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ ...glass(C.teal, 14), width: 46, height: 46, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: C.teal }}>
            <Hammer size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 900, color: '#eaf6ff', letterSpacing: '-0.01em' }}>
              Bridge Works — Development Projects
            </div>
            <div style={{ fontSize: 11.5, color: 'rgba(200,225,235,0.7)', marginTop: 2 }}>
              MOWT Projects Status Report · End of April 2026 · {kpis.count} active lots
            </div>
          </div>
          <span style={{ ...glass(src === 'supabase' ? C.green : C.gray, 999), padding: '5px 12px',
            fontSize: 10, fontWeight: 800, color: src === 'supabase' ? C.green : C.gray }}>
            {src === 'supabase' ? '● LIVE · SUPABASE' : src === 'bundle' ? '● BUNDLED DATA' : '… loading'}
          </span>
        </div>
      </div>

      {/* ── KPI cards (liquid glass) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 18 }}>
        {[
          { label: 'Active Projects', value: String(kpis.count), icon: <Layers size={18} />, c: C.cyan },
          { label: 'Total Contract Value', value: `UGX ${bn(kpis.sum)}`, icon: <CircleDollarSign size={18} />, c: C.teal },
          { label: 'Total Amount Paid', value: `UGX ${bn(kpis.paid)}`, icon: <Wallet size={18} />, c: C.blue },
          { label: 'Avg Physical Progress', value: `${kpis.avg.toFixed(1)}%`, icon: <TrendingUp size={18} />, c: progColor(kpis.avg) },
        ].map(k => (
          <div key={k.label} style={{ ...liquidGlass(k.c, 18), padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ ...neu(11), width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.c }}>
                {k.icon}
              </div>
              <div style={{ fontSize: 9.5, color: 'rgba(200,225,235,0.65)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>
                {k.label}
              </div>
            </div>
            <div style={{ fontSize: 23, fontWeight: 900, color: '#f0faff', letterSpacing: '-0.02em' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <div style={{ ...glass(C.gray, 12), display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', marginBottom: 16, maxWidth: 420 }}>
        <Search size={14} style={{ color: 'rgba(200,225,235,0.5)' }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search lot, contractor, funder, PM…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#eaf6ff', fontSize: 12 }} />
      </div>

      {/* ── Project cards (glass + neumorphic progress) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {filtered.map(w => {
          const pc = progColor(w.physical_progress_pct);
          return (
            <div key={w.id} style={{ ...glass(pc, 18), padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
              {/* title row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#eaf6ff', lineHeight: 1.35 }}>{w.lot}</div>
                <span style={{ ...glass(C.teal, 999), padding: '3px 9px', fontSize: 9, fontWeight: 800, color: C.teal, flexShrink: 0 }}>{w.funder}</span>
              </div>

              {/* contractor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'rgba(200,225,235,0.85)' }}>
                <Building2 size={13} style={{ color: C.blue }} /> {w.contractor || '—'}
              </div>

              {/* progress */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, marginBottom: 5 }}>
                  <span style={{ color: 'rgba(200,225,235,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Physical Progress</span>
                  <span style={{ color: pc, fontWeight: 900 }}>{w.physical_progress_pct != null ? `${w.physical_progress_pct}%` : 'N/A'}</span>
                </div>
                <div style={neuProgressTrack()}><div style={progressFill(w.physical_progress_pct || 0, pc)} /></div>
              </div>

              {/* financials grid (neumorphic) */}
              <div style={{ ...neu(12, false), padding: '11px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                {[
                  ['Contract Sum', bn(w.contract_sum_ugx), C.cyan],
                  ['Certified', bn(w.amount_certified_ugx), C.teal],
                  ['Paid', bn(w.amount_paid_ugx), C.green],
                  ['Outstanding', bn(w.outstanding_ugx), w.outstanding_ugx ? C.orange : C.gray],
                ].map(([l, v, col]) => (
                  <div key={l as string}>
                    <div style={{ fontSize: 8, color: 'rgba(200,225,235,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: col as string }}>UGX {v}</div>
                  </div>
                ))}
              </div>

              {/* team */}
              {(w.project_manager || w.project_engineer) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 9.5, color: 'rgba(200,225,235,0.7)' }}>
                  {w.project_manager && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><UserCog size={11} style={{ color: C.purple }} /> PM: {w.project_manager}</span>}
                  {w.project_engineer && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><HardHat size={11} style={{ color: C.yellow }} /> PE: {w.project_engineer}</span>}
                </div>
              )}

              {/* status excerpt */}
              {w.status && (
                <div style={{ fontSize: 10, color: 'rgba(200,225,235,0.6)', lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {w.status}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)', marginTop: 18, textAlign: 'center' }}>
        Source: MOWT Projects Status Report — §1.4 Bridges Development Projects (April 2026).
        {src === 'bundle' && ' Showing bundled snapshot; create the bridge_works table to serve live from Supabase.'}
      </div>
    </div>
  );
}
