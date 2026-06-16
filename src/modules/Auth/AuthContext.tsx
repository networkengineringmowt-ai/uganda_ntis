import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from './authTypes';
import { LEVEL_PASSWORDS } from './allowedUsers';
import { logEvent } from './auditLog';
import { getStatus, requestAccess } from './directory';

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  /** Re-check this user's directory status (after an admin decision). */
  refreshAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  login: async () => false,
  logout: () => {},
  isAuthenticated: false,
  refreshAccess: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// The allowed-users roster lives in allowedUsers.ts (first.lastname@unra.go.ug
// emails, one hardcoded password per access level).

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('dnr_user') ?? 'null'); }
    catch { return null; }
  });

  async function login(email: string, password: string): Promise<boolean> {
    let id = email.trim().toLowerCase();
    
    if (!id.includes('@')) {
      id = `${id}@unra.go.ug`;
    }

    // Only accept @unra.go.ug emails
    if (!id.endsWith('@unra.go.ug')) {
      logEvent('login_failed', { attempted: id, reason: 'Invalid domain' });
      return false;
    }

    // Determine role based on password matching LEVEL_PASSWORDS
    const roleMatch = (Object.keys(LEVEL_PASSWORDS) as (keyof typeof LEVEL_PASSWORDS)[]).find(
      r => LEVEL_PASSWORDS[r] === password
    );

    if (roleMatch) {
      // Generate a formatted name from the email (e.g. first.last@... -> First Last)
      const nameParts = id.split('@')[0].split('.');
      const name = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

      // ── Identity Manager gate ──────────────────────────────────────────────
      // Legacy roster users → active. New @unra.go.ug users raise an access
      // request and wait for admin approval; revoked/rejected users are blocked.
      const status = await getStatus(id);
      let access: User['access'] = 'active';
      if (status === 'new') { await requestAccess({ email: id, name, role: roleMatch }); access = 'pending'; }
      else if (status === 'pending') access = 'pending';
      else if (status === 'revoked' || status === 'rejected') access = 'revoked';

      const withLogin: User = {
        name, email: id, role: roleMatch, id,
        isActive: true, lastLogin: new Date().toISOString(), access,
      };

      setUser(withLogin);
      localStorage.setItem('dnr_user', JSON.stringify(withLogin));
      logEvent('login', { level: roleMatch, access });
      return true;
    }

    logEvent('login_failed', { attempted: id, reason: 'Invalid access code' });
    return false;
  }

  function logout() {
    logEvent('logout');
    setUser(null);
    localStorage.removeItem('dnr_user');
  }

  /** Re-evaluate the signed-in user's access (poll after an admin decision). */
  async function refreshAccess() {
    if (!user) return;
    const status = await getStatus(user.email);
    const access: User['access'] =
      status === 'active' ? 'active'
      : (status === 'revoked' || status === 'rejected') ? 'revoked'
      : 'pending';
    if (access !== user.access) {
      const next = { ...user, access };
      setUser(next);
      localStorage.setItem('dnr_user', JSON.stringify(next));
    }
  }

  // Re-validate access on load so revocations take effect even on a stored session.
  useEffect(() => { void refreshAccess(); /* eslint-disable-next-line */ }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, refreshAccess }}>
      {children}
    </AuthContext.Provider>
  );
}
