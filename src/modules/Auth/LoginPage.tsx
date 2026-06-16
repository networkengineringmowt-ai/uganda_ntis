import { useState } from 'react';
import { useAuth } from './AuthContext';

// ── Per-app branding ──────────────────────────────────────────────────────────
type AppBranding = { short: string; subtitle: string; accent: string; accentGlow: string };
const APP_BRANDS: Record<string, AppBranding> = {
  nbms: { short: 'BMS',  subtitle: 'NATIONAL BRIDGE MANAGEMENT SYSTEM',   accent: '#4d9fff', accentGlow: 'rgba(77,159,255,0.35)' },
  ntis: { short: 'TIS',  subtitle: 'NATIONAL TRAFFIC INFORMATION SYSTEM', accent: '#4d9fff', accentGlow: 'rgba(77,159,255,0.35)' },
  npms: { short: 'PMS',  subtitle: 'NATIONAL PAVEMENT MANAGEMENT SYSTEM', accent: '#4d9fff', accentGlow: 'rgba(77,159,255,0.35)' },
  nrms: { short: 'NRMS', subtitle: 'NATIONAL ROADS MANAGEMENT SYSTEM',    accent: '#4d9fff', accentGlow: 'rgba(77,159,255,0.35)' },
};
function getBranding(): AppBranding {
  const id = (import.meta.env.VITE_APP_ID as string | undefined) ?? 'nrms';
  return APP_BRANDS[id] ?? APP_BRANDS.nrms;
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────
function ShieldIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const INPUT_WRAP: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  background: 'rgba(8,14,30,0.7)',
  border: '1px solid rgba(148,163,184,0.12)', borderRadius: 10,
  padding: '0 14px', marginBottom: 14,
};
const INPUT: React.CSSProperties = {
  flex: 1, background: 'transparent', border: 'none',
  color: '#e2e8f0', fontSize: 13, padding: '12px 0',
  outline: 'none', fontFamily: 'Inter, sans-serif',
};

export function LoginPage() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const brand = getBranding();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    // All accounts are @unra.go.ug — auto-append the domain if the user typed
    // only their username, and reject any other domain.
    const raw = email.trim().toLowerCase();
    const normalized = raw.includes('@') ? raw : `${raw}@unra.go.ug`;
    if (!normalized.endsWith('@unra.go.ug')) {
      setError('Email must end in @unra.go.ug');
      setLoading(false);
      return;
    }
    const ok = await login(normalized, password);
    if (!ok) setError('Invalid credentials. Check email and access code.');
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#060a14', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif',
      backgroundImage:
        'radial-gradient(rgba(148,163,184,0.04) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
    }}>
      <div style={{
        width: 400, maxWidth: '92vw',
        background: 'rgba(12,18,32,0.92)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(148,163,184,0.08)', borderRadius: 18,
        padding: '36px 32px 28px',
        boxShadow: '0 12px 64px rgba(0,0,0,0.6)',
      }}>
        {/* ── App badge ──────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <img
            src={`${import.meta.env.BASE_URL}mowt.jpg`}
            alt="Ministry of Works and Transport"
            style={{
              width: 34, height: 34, borderRadius: 8, objectFit: 'contain',
              background: '#fff', padding: 2,
              border: `1px solid ${brand.accent}40`,
              boxShadow: `0 0 12px ${brand.accentGlow}`,
            }}
          />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#e2eaf4', letterSpacing: '0.02em' }}>
              MoWT {brand.short}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.45)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              {brand.subtitle}
            </div>
          </div>
        </div>

        {/* ── Shield + heading ────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 16,
            background: `${brand.accent}12`, border: `1px solid ${brand.accent}25`,
            marginBottom: 14,
          }}>
            <ShieldIcon color={brand.accent} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#e2eaf4', marginBottom: 6 }}>
            Secure Gateway
          </div>
          <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)', lineHeight: 1.5 }}>
            Please authenticate to access the national<br />registry systems.
          </div>
        </div>

        {/* ── Form ────────────────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          <div style={INPUT_WRAP}>
            <UserIcon />
            <input
              type="text" value={email} onChange={e => setEmail(e.target.value)} required
              autoCapitalize="none" autoCorrect="off"
              style={INPUT} placeholder="first.lastname@unra.go.ug"
            />
          </div>
          <div style={INPUT_WRAP}>
            <LockIcon />
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={INPUT} placeholder="Enter access code"
            />
          </div>

          {error && (
            <div style={{
              color: '#f87171', fontSize: 11.5, marginBottom: 12, padding: '8px 12px',
              background: 'rgba(239,68,68,0.08)', borderRadius: 8,
              border: '1px solid rgba(239,68,68,0.15)',
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', border: 'none', borderRadius: 10,
            color: '#fff', fontSize: 13.5, fontWeight: 700, padding: '13px',
            cursor: loading ? 'default' : 'pointer',
            background: loading
              ? '#374151'
              : `linear-gradient(135deg, ${brand.accent}, ${brand.accent}cc)`,
            boxShadow: loading ? 'none' : `0 4px 20px ${brand.accentGlow}`,
            transition: 'all 0.25s ease',
            letterSpacing: '0.04em',
          }}>
            {loading ? 'Authenticating…' : 'Authenticate'}
          </button>
        </form>

        {/* ── Footer ──────────────────────────────────────── */}
        <div style={{
          marginTop: 22, textAlign: 'center',
          fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
          color: 'rgba(148,163,184,0.3)', textTransform: 'uppercase',
        }}>
          Authorized access only. Activity is monitored.
        </div>
      </div>
    </div>
  );
}
