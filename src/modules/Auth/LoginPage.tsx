import { useState } from 'react';
import { useAuth } from './AuthContext';

const FIELD: React.CSSProperties = {
  width: '100%', background: 'rgba(10,16,30,0.8)',
  border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8,
  color: '#e2e8f0', fontSize: 13, padding: '10px 14px',
  outline: 'none', boxSizing: 'border-box',
};

export function LoginPage() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const ok = await login(email, password);
    if (!ok) setError('Invalid credentials. Check email and password.');
    setLoading(false);
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{
        width: 420,
        background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16,
        padding: '40px 36px',
        boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
      }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🏗️</div>
          <div style={{ color:'#e2e8f0', fontSize:20, fontWeight:700 }}>Uganda National Roads</div>
          <div style={{ color:'#6366f1', fontSize:13, fontWeight:600 }}>Asset Management Platform</div>
          <div style={{ color:'rgba(148,163,184,0.5)', fontSize:11, marginTop:4 }}>
            Department of National Roads · Ministry of Works &amp; Transport · DNR
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:16 }}>
            <label style={{ color:'#94a3b8', fontSize:12, display:'block', marginBottom:6 }}>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={FIELD} placeholder="your.name@unra.go.ug" />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ color:'#94a3b8', fontSize:12, display:'block', marginBottom:6 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={FIELD} placeholder="••••••••" />
          </div>
          {error && (
            <div style={{ color:'#f87171', fontSize:12, marginBottom:14, padding:'8px 12px', background:'rgba(239,68,68,0.1)', borderRadius:6 }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            width:'100%', background: loading ? '#4b5563' : '#6366f1',
            border:'none', borderRadius:8, color:'#fff',
            fontSize:14, fontWeight:600, padding:'12px', cursor: loading ? 'default' : 'pointer',
            transition: 'background 0.2s',
          }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop:24, padding:'14px', background:'rgba(99,102,241,0.08)', borderRadius:8, border:'1px solid rgba(99,102,241,0.15)' }}>
          <div style={{ color:'rgba(148,163,184,0.7)', fontSize:10, fontWeight:700, marginBottom:8, letterSpacing:'0.05em' }}>DEMO CREDENTIALS</div>
          {[
            ['Admin',    'admin@unra.go.ug',   'admin2025'],
            ['Manager',  'pe@unra.go.ug',      'manager2025'],
            ['Engineer', 'eng@unra.go.ug',     'engineer2025'],
            ['Inspector','inspect@unra.go.ug', 'inspect2025'],
            ['Viewer',   'viewer@example.com', 'viewer2025'],
          ].map(([role, em, pw]) => (
            <div key={role} style={{ fontSize:10, color:'rgba(148,163,184,0.55)', marginBottom:3 }}>
              <span style={{ color:'#818cf8', fontWeight:700 }}>{role}:</span>{' '}
              <span style={{ cursor:'pointer', textDecoration:'underline' }}
                onClick={() => { setEmail(em); setPassword(pw); }}>{em}</span> / {pw}
            </div>
          ))}
          <div style={{ color:'rgba(148,163,184,0.35)', fontSize:9, marginTop:6 }}>
            Click an email to auto-fill credentials
          </div>
        </div>
      </div>
    </div>
  );
}
