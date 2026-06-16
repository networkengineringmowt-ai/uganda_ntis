/**
 * nbms.tsx — standalone entry for the Uganda National Bridge Management System.
 * Mounts ONLY the BMS section (Dashboard · Structure Map · Inventory & Condition
 * incl. the Digital Twin · Bridge Works) in the providers it needs, with its own
 * branded header. Deployed separately to networkengineringmowt-ai/uganda_nbms.
 *
 * Three access levels (matching the main NRMS platform):
 *   rms   → mobile-first field capture shell (data entry only)
 *   super → full BMS dashboards & reports (read-only)
 *   admin → everything
 */
import { StrictMode, Suspense, lazy, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/transitions.css';
import { BMSProvider } from './store/BMSContext';
import { AuthProvider, useAuth } from './modules/Auth/AuthContext';
import { LoginPage } from './modules/Auth/LoginPage';
import { BotHighlightContext } from './modules/AssetBot/types';

const BMSSection = lazy(() => import('./modules/BMS/BMSSection'));
const RMSFieldShell = lazy(() => import('./modules/RMS/RMSFieldShell'));

function Header() {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      padding: '8px 16px', background: 'rgba(2,5,8,0.9)',
      borderBottom: '1px solid rgba(77,159,255,0.15)',
    }}>
      <img src={`${import.meta.env.BASE_URL}mowt.jpg`} alt="MoWT"
        style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain',
          background: '#fff', padding: 2, border: '1px solid rgba(77,159,255,0.3)' }} />
      <div style={{ lineHeight: 1.25 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#4d9fff', letterSpacing: '0.04em' }}>
          Uganda National Bridge Management System
        </div>
        <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.6)' }}>
          Ministry of Works &amp; Transport · Department of National Roads · NBMS
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88',
          boxShadow: '0 0 6px #00ff88' }} />
        <span style={{ fontSize: 9.5, color: 'rgba(0,255,136,0.7)', fontWeight: 700 }}>System Online</span>
      </div>
    </header>
  );
}

function ModuleSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%',
        border: '2px solid rgba(75,99,130,0.4)', borderTopColor: '#4d9fff',
        animation: 'bms-spin 0.8s linear infinite' }} />
    </div>
  );
}

// ── Level gate — three logins, three interfaces ───────────────────────────────
function AppGate() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) return <LoginPage />;

  // bms → mobile-first field capture shell (bridge inspection data entry)
  if (user.role === 'bms') {
    return (
      <Suspense fallback={<ModuleSpinner />}>
        <RMSFieldShell />
      </Suspense>
    );
  }

  // super / admin → full BMS dashboards & reports
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#0a0f1e', overflow: 'hidden' }}>
      <Header />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Suspense fallback={<ModuleSpinner />}>
          <BMSSection />
        </Suspense>
      </div>
    </div>
  );
}

function NBMSApp() {
  const [highlightedLinks, setHighlightedLinks] = useState<string[]>([]);
  return (
    <AuthProvider>
      <BotHighlightContext.Provider value={{ highlightedLinks, setHighlightedLinks }}>
        <BMSProvider>
          <AppGate />
        </BMSProvider>
      </BotHighlightContext.Provider>
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NBMSApp />
  </StrictMode>,
);
