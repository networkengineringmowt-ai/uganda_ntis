/**
 * IdentityManager — admin-only "active directory" console.
 * Lists every user (legacy roster auto-accepted + dynamic requests), with the
 * access-approval workflow: approve / reject pending requests, revoke active
 * users, restore revoked ones. Backed by directory.ts (G: Drive via the
 * data-entry server, localStorage fallback).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, UserCheck, UserX, ShieldAlert, RotateCcw, Search } from 'lucide-react';
import { listDirectory, decide, type DirEntry } from '../Auth/directory';
import { useAuth } from '../Auth/AuthContext';
import { roleLabel } from '../Auth/authTypes';

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pending approval', color: '#ffd23f' },
  active:   { label: 'Active',           color: '#22c55e' },
  revoked:  { label: 'Revoked',          color: '#ff2d78' },
  rejected: { label: 'Rejected',         color: '#ef4444' },
};

export default function IdentityManager() {
  const { user } = useAuth();
  const me = user?.email ?? 'admin';
  const [rows, setRows] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'revoked'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await listDirectory()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(email: string, action: 'approve' | 'reject' | 'revoke' | 'restore', role?: string) {
    setBusy(email + action);
    try { await decide(email, action, me, role); await load(); } finally { setBusy(null); }
  }

  const counts = useMemo(() => {
    const c = { pending: 0, active: 0, revoked: 0, rejected: 0 };
    rows.forEach(r => { if (r.status in c) (c as Record<string, number>)[r.status]++; });
    return c;
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (filter !== 'all' && r.status !== filter && !(filter === 'revoked' && r.status === 'rejected')) return false;
    const n = q.trim().toLowerCase();
    return !n || `${r.email} ${r.name ?? ''} ${r.role ?? ''}`.toLowerCase().includes(n);
  }), [rows, filter, q]);

  const CARD: React.CSSProperties = { background: 'rgba(8,14,28,0.7)', border: '1px solid rgba(77,159,255,0.14)', borderRadius: 10, padding: '12px 14px' };
  const TH: React.CSSProperties = { textAlign: 'left', padding: '8px 11px', fontSize: 9.5, fontWeight: 800, color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(77,159,255,0.15)', position: 'sticky', top: 0, background: 'rgba(4,9,18,0.95)' };
  const TD: React.CSSProperties = { padding: '8px 11px', fontSize: 12, color: 'rgba(203,213,225,0.9)', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' };
  const btn = (bg: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${bg}55`, background: `${bg}1a`, color: bg });

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#e2eaf4' }}>Identity Manager — active directory</div>
          <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.65)' }}>
            Approve new access requests, revoke or restore users. Legacy roster users are auto-accepted.
            Stored in the G: Drive directory (directory/users.json) via the data-entry server.
          </div>
        </div>
        <button onClick={() => void load()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', cursor: 'pointer', background: 'rgba(77,159,255,0.12)', border: '1px solid rgba(77,159,255,0.3)', borderRadius: 7, color: '#4d9fff', fontSize: 11, fontWeight: 700 }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 10, marginBottom: 14 }}>
        {([['Pending', counts.pending, '#ffd23f'], ['Active', counts.active, '#22c55e'], ['Revoked', counts.revoked, '#ff2d78'], ['Rejected', counts.rejected, '#ef4444']] as Array<[string, number, string]>).map(([l, n, c]) => (
          <div key={l} style={CARD}>
            <div style={{ fontSize: 22, fontWeight: 900, color: c, lineHeight: 1 }}>{n}</div>
            <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.65)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        {(['all', 'pending', 'active', 'revoked'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '4px 11px', borderRadius: 999, fontSize: 10, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em', background: filter === f ? 'rgba(77,159,255,0.18)' : 'rgba(255,255,255,0.03)', border: `1px solid ${filter === f ? '#4d9fff' : 'rgba(255,255,255,0.1)'}`, color: filter === f ? '#4d9fff' : 'rgba(148,163,184,0.7)' }}>{f}</button>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', background: 'rgba(10,16,30,0.9)', border: '1px solid rgba(77,159,255,0.25)', borderRadius: 7, padding: '5px 10px' }}>
          <Search size={12} style={{ color: 'rgba(148,163,184,0.6)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search email / name…" style={{ background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 11.5, width: 180 }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>User</th><th style={TH}>Level</th><th style={TH}>Status</th><th style={TH}>Requested</th><th style={TH}>Decided by</th><th style={TH}>Actions</th></tr></thead>
            <tbody>
              {filtered.map(r => {
                const m = STATUS_META[r.status] ?? { label: r.status, color: '#94a3b8' };
                return (
                  <tr key={r.email}>
                    <td style={TD}>
                      <div style={{ fontWeight: 700, color: '#e2eaf4' }}>{r.name ?? r.email.split('@')[0]}</div>
                      <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>{r.email}</div>
                    </td>
                    <td style={TD}>{roleLabel(r.role)}</td>
                    <td style={TD}><span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 9.5, fontWeight: 800, background: `${m.color}1a`, border: `1px solid ${m.color}55`, color: m.color }}>{m.label}</span></td>
                    <td style={{ ...TD, color: 'rgba(148,163,184,0.6)', fontSize: 11 }}>{r.requestedAt ? r.requestedAt.replace('T', ' ').slice(0, 16) : '—'}</td>
                    <td style={{ ...TD, color: 'rgba(148,163,184,0.6)', fontSize: 11 }}>{r.decidedBy ?? '—'}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {r.status === 'pending' && (<>
                          <button disabled={!!busy} onClick={() => act(r.email, 'approve', r.role)} style={btn('#22c55e')}><UserCheck size={12} /> Approve</button>
                          <button disabled={!!busy} onClick={() => act(r.email, 'reject')} style={btn('#ef4444')}><UserX size={12} /> Reject</button>
                        </>)}
                        {r.status === 'active' && r.decidedBy !== 'roster (auto-accepted)' && (
                          <button disabled={!!busy} onClick={() => act(r.email, 'revoke')} style={btn('#ff2d78')}><ShieldAlert size={12} /> Revoke</button>
                        )}
                        {r.status === 'active' && r.decidedBy === 'roster (auto-accepted)' && (
                          <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.45)' }}>roster · auto-accepted</span>
                        )}
                        {(r.status === 'revoked' || r.status === 'rejected') && (
                          <button disabled={!!busy} onClick={() => act(r.email, 'restore', r.role)} style={btn('#4d9fff')}><RotateCcw size={12} /> Restore</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (<tr><td style={{ ...TD, padding: 18 }} colSpan={6}>No users match the current filter.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
