import { lazy, Suspense, useState } from 'react';
import { LayoutDashboard, Book } from 'lucide-react';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';

const CrossSectionAnalytics = lazy(() => import('./CrossSectionAnalytics'));
const PavementCatalogue = lazy(() => import('./PavementCatalogue'));
const AIVisionDashboard = lazy(() => import('./AIVisionDashboard'));
const DigitalTwin = lazy(() => import('./DigitalTwin'));

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%',
        border: '2px solid rgba(245,158,11,0.4)', borderTopColor: '#f59e0b',
        animation: 'pms-spin 0.8s linear infinite' }} />
    </div>
  );
}

const MAIN_TABS = [
  { id: 'dashboard', label: 'Analytics Dashboard', icon: <LayoutDashboard size={13}/> },
  { id: 'catalogue', label: 'Design Catalogue',    icon: <Book size={13}/> },
  { id: 'ai_vision', label: 'AI Defect Vision',    icon: <LayoutDashboard size={13}/> },
  { id: 'digital_twin', label: '3D Digital Twin',  icon: <Book size={13}/> },
];

export default function PMSSection() {
  const [mainTab, setMainTab] = useState('dashboard');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(2,5,8,0.97)',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <style>{`
        @keyframes pms-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Cross-section links hidden if standalone NPMS */}
      {!import.meta.env.VITE_STANDALONE && <CrossLinkChipBar sectionId="pms" />}

      {/* ── Main tab bar ── */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 14px',
        borderBottom: '1px solid rgba(245,158,11,0.15)',
        background: 'rgba(4,9,18,0.85)', flexShrink: 0,
      }}>
        {MAIN_TABS.map(t => {
          const isActive = t.id === mainTab;
          return (
            <button key={t.id} onClick={() => setMainTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px', fontSize: 11, fontWeight: isActive ? 800 : 500,
              background: 'none', border: 'none', cursor: 'pointer',
              color: isActive ? '#f59e0b' : 'rgba(148,163,184,0.70)',
              borderBottom: isActive ? '2px solid #f59e0b' : '2px solid transparent',
              transition: 'all 0.13s', flexShrink: 0,
            }}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Content area ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <Suspense fallback={<Spinner />}>
          {mainTab === 'dashboard' && <CrossSectionAnalytics />}
          {mainTab === 'catalogue' && <PavementCatalogue />}
          {mainTab === 'ai_vision' && <AIVisionDashboard />}
          {mainTab === 'digital_twin' && <DigitalTwin />}
        </Suspense>
      </div>
    </div>
  );
}
