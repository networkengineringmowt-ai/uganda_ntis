/**
 * DataAuditPanel — cross-section data audit results.
 * Accessible from the Admin Tools nav by all users.
 * Runs audit on mount and shows a badge on issues.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useNetworkStats } from '../../shared/useNetworkStats';
import { runDataAudit, type AuditResult } from './DataAuditEngine';

const BASE = import.meta.env.BASE_URL;

const STATUS_COLOR: Record<string, string> = {
  ok:       '#22c55e',
  mismatch: '#f97316',
  missing:  '#ef4444',
  info:     '#94a3b8',
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  ok:       <CheckCircle2 size={13} style={{ color: '#22c55e' }} />,
  mismatch: <AlertTriangle size={13} style={{ color: '#f97316' }} />,
  missing:  <XCircle size={13} style={{ color: '#ef4444' }} />,
  info:     <ShieldCheck size={13} style={{ color: '#94a3b8' }} />,
};

export default function DataAuditPanel() {
  const networkStats = useNetworkStats();
  const [results, setResults] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  async function runAudit() {
    setLoading(true);
    try {
      const r = await runDataAudit(networkStats, BASE);
      setResults(r);
      setLastRun(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (networkStats.loaded) { runAudit(); } }, [networkStats.loaded]);

  const issues    = results.filter(r => r.status === 'mismatch' || r.status === 'missing');
  const okCount   = results.filter(r => r.status === 'ok').length;
  const infoCount = results.filter(r => r.status === 'info').length;

  return (
    <div style={{
      position: 'absolute', inset: 0, overflowY: 'auto',
      background: 'rgba(2,5,8,0.98)', fontFamily: "'Inter','Segoe UI',sans-serif",
      padding: '24px 20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11,
          background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldCheck size={20} style={{ color: '#00f5ff' }} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4' }}>Data Audit</div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>
            Cross-section KPI validation · Single source of truth checks
            {lastRun && ` · Last run ${lastRun.toLocaleTimeString('en-UG')}`}
          </div>
        </div>
        <button
          onClick={runAudit}
          disabled={loading}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.25)',
            color: '#00f5ff', cursor: loading ? 'default' : 'pointer',
          }}
        >
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Running…' : 'Re-run Audit'}
        </button>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: `${okCount} Passed`,    color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
          { label: `${issues.length} Issues`, color: issues.length > 0 ? '#f97316' : '#22c55e', bg: `rgba(${issues.length > 0 ? '249,115,22' : '34,197,94'},0.1)` },
          { label: `${infoCount} Info`,    color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
        ].map(c => (
          <div key={c.label} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            color: c.color, background: c.bg, border: `1px solid ${c.color}33`,
          }}>
            {c.label}
          </div>
        ))}
      </div>

      {/* Network stats summary */}
      <div style={{
        background: 'rgba(8,14,28,0.55)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, padding: '14px 16px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(0,245,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Network Stats — Single Source of Truth (network2026.geojson)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {[
            { label: 'Total km',     value: networkStats.totalKm.toLocaleString() },
            { label: 'Total links',  value: networkStats.totalLinks.toLocaleString() },
            { label: 'Paved km',     value: networkStats.pavedKm.toLocaleString() },
            { label: 'Unpaved km',   value: networkStats.unpavedKm.toLocaleString() },
            { label: 'Paved %',      value: `${networkStats.pavedPct}%` },
            { label: 'Bridges',      value: networkStats.totalBridges.toLocaleString() },
            { label: 'Data vintage', value: networkStats.dataVintage },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#e2eaf4', marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Results table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(148,163,184,0.4)', fontSize: 13 }}>
          Running audit…
        </div>
      ) : (
        <div style={{ background: 'rgba(8,14,28,0.55)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,245,255,0.05)', borderBottom: '1px solid rgba(0,245,255,0.1)' }}>
                {['Status', 'Tab', 'Field', 'Value', 'Expected', 'Notes'].map(h => (
                  <th key={h} style={{
                    padding: '9px 12px', textAlign: 'left', fontSize: 8, fontWeight: 900,
                    color: 'rgba(0,245,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: r.status === 'mismatch' ? 'rgba(249,115,22,0.04)' : r.status === 'missing' ? 'rgba(239,68,68,0.04)' : 'transparent',
                }}>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {STATUS_ICON[r.status]}
                      <span style={{ fontSize: 9, fontWeight: 700, color: STATUS_COLOR[r.status], textTransform: 'uppercase' }}>
                        {r.status}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: '#94a3b8' }}>{r.tab}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: '#e2eaf4', fontWeight: 600 }}>{r.field}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: STATUS_COLOR[r.status], fontFamily: 'monospace' }}>{String(r.value)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'rgba(148,163,184,0.7)', fontFamily: 'monospace' }}>{String(r.expected)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 10, color: 'rgba(148,163,184,0.5)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Badge count for nav — returns number of issues found */
export function getAuditIssueCount(results: AuditResult[]): number {
  return results.filter(r => r.status === 'mismatch' || r.status === 'missing').length;
}
