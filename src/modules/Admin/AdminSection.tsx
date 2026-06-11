/**
 * AdminSection — Admin Tools unified 2-tab view.
 * Tabs: Platform Mind Map | Data Audit
 * Follows the exact BMS tab-bar pattern.
 */
import { lazy, Suspense, useState } from 'react';
import { Activity, Cpu, ShieldCheck } from 'lucide-react';
import type { ActiveView } from '../../types';

const ADMIN_Activity  = lazy(() => import('./ActivityLog'));
const ADMIN_MindMap   = lazy(() => import('../MindMap/MindMapSection'));
const ADMIN_DataAudit = lazy(() => import('../DataAudit/DataAuditPanel'));

function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid rgba(77,159,255,0.18)', borderTopColor: '#4d9fff',
        animation: 'admin-spin .8s linear infinite',
      }}/>
    </div>
  );
}

const MAIN_TABS = [
  { id: 'activity'  as const, label: 'Activity Log',      icon: <Activity size={13}/> },
  { id: 'mindmap'   as const, label: 'Platform Mind Map', icon: <Cpu size={13}/> },
  { id: 'dataaudit' as const, label: 'Data Audit',        icon: <ShieldCheck size={13}/> },
];
type TabId = typeof MAIN_TABS[number]['id'];

export default function AdminSection({
  onNavigate,
}: {
  onNavigate?: (v: ActiveView) => void;
}) {
  const [tab, setTab] = useState<TabId>('activity');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(2,5,8,0.97)',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <style>{`
        @keyframes admin-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* ── BMS-style main tab bar ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(77,159,255,0.15)',
        background: 'rgba(4,9,18,0.85)',
      }}>
        {MAIN_TABS.map(t => {
          const isActive = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px', fontSize: 11, fontWeight: isActive ? 800 : 500,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: isActive ? '#4d9fff' : 'rgba(148,163,184,0.70)',
              borderBottom: isActive ? '2px solid #4d9fff' : '2px solid transparent',
              transition: 'all 0.13s',
            }}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Content area ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <Suspense fallback={<Spinner />}>
          {tab === 'activity' && (
            <div style={{ position:'absolute', inset:0, overflowY:'auto' }}>
              <ADMIN_Activity />
            </div>
          )}
          {tab === 'mindmap'   && (
            <div style={{ position:'absolute', inset:0 }}>
              <ADMIN_MindMap />
            </div>
          )}
          {tab === 'dataaudit' && (
            <div style={{ position:'absolute', inset:0, overflowY:'auto' }}>
              <ADMIN_DataAudit />
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
}
