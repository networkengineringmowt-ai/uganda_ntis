import { lazy, Suspense, useState } from 'react';
import { ClipboardList, Camera, LogOut } from 'lucide-react';
import { useAuth } from '../Auth/AuthContext';
import { logEvent } from '../Auth/auditLog';

const DataCaptureHub = lazy(() => import('../DataEntry/DataCaptureHub'));
const PendingSubmissions = lazy(() =>
  import('../DataEntry/PendingSubmissions').then(m => ({ default: m.PendingSubmissions })));

type Tab = 'capture' | 'queue';

/**
 * RMS level interface — field data entry ONLY, mobile-first.
 * No dashboards, no sidebar: a top app bar, the capture forms, and a
 * thumb-reachable bottom tab bar. On desktop it centres at phone width+.
 */
export default function RMSFieldShell() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('capture');

  return (
    <div style={{
      height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
      background: '#0a0f1e', overflow: 'hidden',
    }}>
      {/* Top app bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: 'rgba(8,14,28,0.92)', borderBottom: '1px solid rgba(0,245,255,0.12)',
        flexShrink: 0,
      }}>
        <img src={`${import.meta.env.BASE_URL}mowt.jpg`} alt="MoWT"
          style={{ width: 30, height: 30, borderRadius: 8, background: '#fff', padding: 2, objectFit: 'contain' }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#00f5ff', letterSpacing: '0.08em' }}>
            UGROADS · FIELD CAPTURE
          </div>
          <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name} · RMS data entry{user?.region ? ` · ${user.region}` : ''}
          </div>
        </div>
        <button onClick={logout} title="Sign out" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, color: '#fca5a5', fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}>
          <LogOut size={13} /> Sign out
        </button>
      </div>

      {/* Content — centred column, comfortable on phones and desktop alike */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
          <Suspense fallback={
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid #1e293b', borderTopColor: '#00f5ff', animation: 'spin 1s linear infinite' }} />
            </div>
          }>
            {tab === 'capture' && <DataCaptureHub />}
            {tab === 'queue'   && <PendingSubmissions />}
          </Suspense>
        </div>
      </div>

      {/* Bottom tab bar — large touch targets */}
      <div style={{
        display: 'flex', flexShrink: 0,
        background: 'rgba(8,14,28,0.96)', borderTop: '1px solid rgba(0,245,255,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {([
          { id: 'capture', label: 'Capture',        icon: <Camera size={19} /> },
          { id: 'queue',   label: 'My Submissions', icon: <ClipboardList size={19} /> },
        ] as Array<{ id: Tab; label: string; icon: React.ReactNode }>).map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id}
              onClick={() => { setTab(t.id); logEvent('view', { view: `field-${t.id}` }); }} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '10px 4px 12px', minHeight: 56, cursor: 'pointer',
              background: active ? 'rgba(0,245,255,0.08)' : 'transparent',
              border: 'none', borderTop: active ? '2px solid #00f5ff' : '2px solid transparent',
              color: active ? '#00f5ff' : 'rgba(148,163,184,0.7)',
              fontSize: 10.5, fontWeight: active ? 800 : 600,
            }}>
              {t.icon}{t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
