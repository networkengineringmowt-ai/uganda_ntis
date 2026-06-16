/**
 * AccessPending — shown to an authenticated user whose Identity-Manager access
 * is not yet `active`. `pending` = awaiting admin approval; `revoked` = blocked.
 * Polls directory status every 15s and offers a manual re-check + sign-out.
 */
import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

export function AccessPending() {
  const { user, logout, refreshAccess } = useAuth();
  const [checking, setChecking] = useState(false);
  const revoked = user?.access === 'revoked';

  useEffect(() => {
    if (revoked) return;
    const t = setInterval(() => { void refreshAccess(); }, 15_000);
    return () => clearInterval(t);
  }, [revoked, refreshAccess]);

  const accent = revoked ? '#ff2d78' : '#ffd23f';
  async function check() { setChecking(true); try { await refreshAccess(); } finally { setChecking(false); } }

  return (
    <div style={{ minHeight: '100vh', background: '#060a14', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif',
      backgroundImage: 'radial-gradient(rgba(148,163,184,0.04) 1px, transparent 1px)',
      backgroundSize: '28px 28px' }}>
      <div style={{ width: 430, maxWidth: '92vw', background: 'rgba(12,18,32,0.92)',
        backdropFilter: 'blur(24px)', border: `1px solid ${accent}33`, borderRadius: 18,
        padding: '36px 32px 28px', boxShadow: '0 12px 64px rgba(0,0,0,0.6)', textAlign: 'center' }}>
        <img src={`${import.meta.env.BASE_URL}mowt.jpg`} alt="MoWT"
          style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain', background: '#fff',
            padding: 3, border: `1px solid ${accent}55`, marginBottom: 14 }} />
        <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: 16,
          alignItems: 'center', justifyContent: 'center', margin: '4px auto 16px',
          background: `${accent}14`, border: `1px solid ${accent}30`, fontSize: 30 }}>
          {revoked ? '⛔' : '⏳'}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#e2eaf4', marginBottom: 8 }}>
          {revoked ? 'Access revoked' : 'Access request pending'}
        </div>
        <div style={{ fontSize: 12.5, color: 'rgba(148,163,184,0.7)', lineHeight: 1.55, marginBottom: 18 }}>
          {revoked ? (
            <>Your access to the national registry systems has been revoked by an
            administrator. Contact the GIS &amp; Asset Management team if you believe
            this is an error.</>
          ) : (
            <>Your details have been submitted to the administrator for approval and
            added to the directory as <b style={{ color: accent }}>pending</b>. You'll
            get in automatically once an admin accepts your account — this page checks
            every few seconds.</>
          )}
        </div>
        <div style={{ background: 'rgba(8,14,30,0.7)', border: '1px solid rgba(148,163,184,0.12)',
          borderRadius: 10, padding: '10px 14px', textAlign: 'left', fontSize: 11.5, marginBottom: 18 }}>
          <div style={{ color: '#e2eaf4', fontWeight: 700 }}>{user?.name}</div>
          <div style={{ color: 'rgba(148,163,184,0.7)' }}>{user?.email}</div>
          <div style={{ color: accent, fontSize: 10, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            requested level: {user?.role}
          </div>
        </div>
        {!revoked && (
          <button onClick={check} disabled={checking} style={{
            width: '100%', border: 'none', borderRadius: 10, color: '#0a0f1e', fontSize: 13, fontWeight: 800,
            padding: '12px', cursor: checking ? 'default' : 'pointer', marginBottom: 10,
            background: checking ? '#374151' : `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
            {checking ? 'Checking…' : 'Check approval status'}
          </button>
        )}
        <button onClick={logout} style={{
          width: '100%', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10,
          color: 'rgba(148,163,184,0.85)', fontSize: 12, fontWeight: 700, padding: '10px',
          background: 'transparent', cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
