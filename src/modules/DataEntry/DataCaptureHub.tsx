/**
 * DataCaptureHub — the login-gated "capture screen" reached from every platform's
 * big Capture button. Lists the data-entry forms; each writes straight to the
 * Supabase Unified DB so the rest of the platform updates from a single submission.
 *
 * Currently wired live: Road Condition Survey → road_link_condition.
 * Other capture types are listed with their target table (wire-up pending).
 */
import { useState } from 'react';
import { Activity, ShieldAlert, Gavel, HardHat, ClipboardList, Lock } from 'lucide-react';
import { useAuth } from '../Auth/AuthContext';
import { LoginPage } from '../Auth/LoginPage';
import { UserBadge } from '../Auth/UserBadge';
import { hasPermission } from '../Auth/authTypes';
import { ConditionSurveyForm } from './ConditionSurveyForm';

type CaptureId = 'condition' | 'encroachment' | 'gazette' | 'inspection' | 'reserve-permit';

const CAPTURES: { id: CaptureId; title: string; table: string; desc: string; icon: React.ReactNode; live: boolean }[] = [
  { id: 'condition',      title: 'Road Condition Survey', table: 'road_link_condition',         desc: 'IRI · rutting · cracking · PCI · VCI per link', icon: <Activity size={18} />,      live: true  },
  { id: 'encroachment',   title: 'Encroachment Report',   table: 'road_reserve_encroachments',  desc: 'Right-of-way encroachment incidents',           icon: <ShieldAlert size={18} />,   live: false },
  { id: 'gazette',        title: 'Gazette / Legal Status', table: 'road_reserve_gazette',        desc: 'Gazettement & survey status updates',           icon: <Gavel size={18} />,         live: false },
  { id: 'inspection',     title: 'Bridge Inspection',      table: 'inspections',                 desc: 'NBI-style structure condition ratings',         icon: <HardHat size={18} />,       live: false },
  { id: 'reserve-permit', title: 'Road Reserve Permit',    table: 'road_reserve_applications',   desc: 'MOWT Form 2 — temporary use application',        icon: <ClipboardList size={18} />, live: false },
];

const C = { teal: '#00d4aa', cyan: '#00f5ff', gray: '#94a3b8' };

export default function DataCaptureHub() {
  const { isAuthenticated, user } = useAuth();
  const initial = (() => { try { return sessionStorage.getItem('capture_target') as CaptureId | null; } catch { return null; } })();
  const [active, setActive] = useState<CaptureId | null>(initial && ['condition'].includes(initial) ? initial : null);

  // Gate: must be logged in to reach any capture screen.
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100%' }}>
        <div style={{ textAlign: 'center', padding: '18px 0 0', color: 'rgba(148,163,184,0.8)', fontSize: 12 }}>
          <Lock size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          Data capture requires sign-in
        </div>
        <LoginPage />
      </div>
    );
  }

  const canSubmit = hasPermission(user, 'canSubmitSurvey');

  return (
    <div style={{ padding: '22px 20px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4' }}>Data Capture</div>
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', marginTop: 2 }}>
            Field data entry · writes to the live Supabase Unified DB · updates the whole platform
          </div>
        </div>
        <UserBadge />
      </div>

      {!canSubmit && (
        <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 8, fontSize: 12,
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
          Your role (<strong>{user?.role}</strong>) is read-only. Submitting surveys requires the inspector role or higher.
        </div>
      )}

      {/* Capture-type cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginBottom: 20 }}>
        {CAPTURES.map(c => {
          const on = active === c.id;
          return (
            <button key={c.id} disabled={!c.live} onClick={() => c.live && setActive(c.id)} style={{
              display: 'flex', alignItems: 'flex-start', gap: 11, padding: '14px 15px', textAlign: 'left',
              cursor: c.live ? 'pointer' : 'not-allowed', opacity: c.live ? 1 : 0.5,
              background: on ? `rgba(0,212,170,0.14)` : 'rgba(15,23,42,0.7)',
              border: `1px solid ${on ? C.teal : 'rgba(255,255,255,0.1)'}`, borderRadius: 12,
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, color: C.teal,
                background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#e2eaf4', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {c.title}
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 999,
                    color: c.live ? C.teal : C.gray, background: c.live ? 'rgba(0,212,170,0.15)' : 'rgba(148,163,184,0.12)',
                    border: `1px solid ${c.live ? 'rgba(0,212,170,0.4)' : 'rgba(148,163,184,0.25)'}` }}>
                    {c.live ? 'LIVE' : 'SOON'}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.7)', marginTop: 2 }}>{c.desc}</div>
                <div style={{ fontSize: 8.5, color: 'rgba(148,163,184,0.45)', marginTop: 4, fontFamily: 'monospace' }}>→ {c.table}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active capture form */}
      {active === 'condition' && (
        <div style={{ background: 'rgba(8,14,28,0.6)', border: `1px solid rgba(0,212,170,0.25)`, borderRadius: 14, maxWidth: 640 }}>
          <ConditionSurveyForm onClose={() => setActive(null)} />
        </div>
      )}
      {!active && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(148,163,184,0.5)', fontSize: 12 }}>
          Select a capture type above to begin.
        </div>
      )}
    </div>
  );
}
