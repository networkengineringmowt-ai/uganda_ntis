import { useState } from 'react';
import { useAuth } from './AuthContext';

const ROLE_COLORS: Record<string, string> = {
  admin:     '#ef4444',
  manager:   '#f59e0b',
  engineer:  '#6366f1',
  inspector: '#22c55e',
  viewer:    '#64748b',
};

export function UserBadge() {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  if (!user) return null;

  const color = ROLE_COLORS[user.role] ?? '#94a3b8';

  return (
    <div style={{ position: 'relative', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
      <div style={{ textAlign:'right', cursor:'pointer' }} onClick={() => setShowMenu(m => !m)}>
        <div style={{ color:'#e2e8f0', fontSize:12, fontWeight:600, lineHeight:1.2 }}>{user.name}</div>
        <div style={{ fontSize:9, color, textTransform:'uppercase', fontWeight:700, letterSpacing:'0.05em' }}>
          {user.role}{user.region ? ` · ${user.region}` : ''}
        </div>
      </div>
      <div
        onClick={() => setShowMenu(m => !m)}
        style={{
          width:30, height:30, borderRadius:'50%', flexShrink:0,
          background: color, display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:13, fontWeight:800, color:'#fff', cursor:'pointer',
          boxShadow: `0 0 10px ${color}55`,
        }}>
        {user.name[0].toUpperCase()}
      </div>

      {showMenu && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:10000,
          background:'rgba(10,16,30,0.96)', backdropFilter:'blur(16px)',
          border:'1px solid rgba(255,255,255,0.1)', borderRadius:10,
          padding:'8px', minWidth:180,
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ padding:'6px 10px', borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:6 }}>
            <div style={{ color:'#e2e8f0', fontSize:12, fontWeight:600 }}>{user.name}</div>
            <div style={{ color:'#94a3b8', fontSize:10 }}>{user.email}</div>
            {user.department && <div style={{ color:'#64748b', fontSize:9 }}>{user.department}</div>}
          </div>
          <button onClick={() => { setShowMenu(false); logout(); }} style={{
            width:'100%', textAlign:'left', padding:'7px 10px', borderRadius:6,
            background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
            color:'#fca5a5', fontSize:12, cursor:'pointer',
          }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
