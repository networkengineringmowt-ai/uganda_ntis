import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { hasPermission, type Permission } from './authTypes';

interface Props {
  permission?: keyof Permission;
  fallback?: ReactNode;
  children: ReactNode;
}

export function ProtectedRoute({ permission, fallback, children }: Props) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <>{fallback ?? (
      <div style={{ color:'#94a3b8', padding:20, textAlign:'center' }}>
        Please log in to access this section.
      </div>
    )}</>;
  }
  if (permission && !hasPermission(user, permission)) {
    return (
      <div style={{ color:'#f87171', padding:'32px 20px', textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🔒</div>
        <div style={{ fontWeight:700, fontSize:14, color:'#fca5a5' }}>Access Restricted</div>
        <div style={{ fontSize:12, color:'#94a3b8', marginTop:6 }}>
          Your role (<strong style={{ color:'#818cf8' }}>{user?.role}</strong>) does not have permission: <code>{permission}</code>.
        </div>
        <div style={{ fontSize:11, color:'rgba(148,163,184,0.5)', marginTop:4 }}>
          Contact your system administrator to request access.
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
