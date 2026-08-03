/**
 * NetworkSection â Network Overview unified 4-tab view.
 * Tabs:
 *   1. Platform Dashboard  â high-level KPI overview
 *   2. Road Network Map    â full-screen GeoJSON map + timeline
 *   3. Network Story       â scrollytelling 1986-to-now narrative
 *
 * Follows the exact BMS tab-bar pattern:
 *   borderBottom '1px solid rgba(77,159,255,0.15)'
 *   active:   color '#4d9fff', borderBottom '2px solid #4d9fff', fontWeight 800
 *   inactive: color 'rgba(148,163,184,0.70)', borderBottom '2px solid transparent'
 */
import { lazy, Suspense, useState } from 'react';
import { LayoutDashboard, Map, BookOpen } from 'lucide-react';
import type { ActiveView } from '../../types';
import SectionDashboard from '../Dashboard/SectionDashboard';

const NET_PlatformDashboard   = lazy(() => import('../PlatformDashboard/PlatformDashboard'));
const NET_RoadNetworkView     = lazy(() => import('../RoadNetwork/RoadNetworkView'));
const NET_NetworkStory        = lazy(() => import('../NetworkStory/NetworkStory'));

function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid rgba(77,159,255,0.18)', borderTopColor: '#4d9fff',
        animation: 'net-spin .8s linear infinite',
      }}/>
    </div>
  );
}

const MAIN_TABS = [
  { id: 'dashboard'    as const, label: 'Platform Dashboard', icon: <LayoutDashboard size={13}/> },
  { id: 'roadnetwork'  as const, label: 'Road Network Map',   icon: <Map size={13}/> },
  { id: 'networkstory' as const, label: 'Network Story',      icon: <BookOpen size={13}/> },
];

type TabId = typeof MAIN_TABS[number]['id'];

export default function NetworkSection() {
  const [tab, setTab] = useState<TabId>('dashboard');

  // Road Network Map and Network Story need full-height no-overflow treatment
  const isFullHeight = tab === 'roadnetwork' || tab === 'networkstory';

  const contentStyle: React.CSSProperties = isFullHeight
    ? { flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }
    : { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(2,5,8,0.97)',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <style>{`
        @keyframes net-spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>

      {/* ââ BMS-style main tab bar âââââââââââââââââââââââââââââââââââââââââââ */}
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

      {/* ââ Content area ââââââââââââââââââââââââââââââââââââââââââââââââââââ */}
      <div style={contentStyle}>
        <Suspense fallback={<Spinner />}>

          {/* Tab 1: Platform Dashboard â scrollable */}
          {tab === 'dashboard' && <NET_PlatformDashboard />}

          {/* Tab 2: Road Network Map â full-height, position absolute */}
          {tab === 'roadnetwork' && (
            <div style={{ position: 'absolute', inset: 0 }}>
              <NET_RoadNetworkView />
            </div>
          )}

          {/* Tab 3: Network Story â full-height, self-scrolling */}
          {tab === 'networkstory' && (
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              <NET_NetworkStory />
            </div>
          )}


        </Suspense>
      </div>
    </div>
  );
}
