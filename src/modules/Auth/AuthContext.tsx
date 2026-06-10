import { createContext, useContext, useState, type ReactNode } from 'react';
import type { User } from './authTypes';

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  login: async () => false,
  logout: () => {},
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

const DEMO_USERS: Array<User & { password: string }> = [
  { id:'1', name:'Admin User',      email:'admin@unra.go.ug',    password:'admin2025',    role:'admin',    isActive:true },
  { id:'2', name:'Principal Eng.',  email:'pe@unra.go.ug',       password:'manager2025',  role:'manager',  isActive:true, department:'Maintenance' },
  { id:'3', name:'Road Engineer',   email:'eng@unra.go.ug',      password:'engineer2025', role:'engineer', isActive:true, region:'Northern', department:'Maintenance' },
  { id:'4', name:'Field Inspector', email:'inspect@unra.go.ug',  password:'inspect2025',  role:'inspector',isActive:true, region:'Eastern' },
  { id:'5', name:'Public Viewer',   email:'viewer@example.com',  password:'viewer2025',   role:'viewer',   isActive:true },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('dnr_user') ?? 'null'); }
    catch { return null; }
  });

  async function login(email: string, password: string): Promise<boolean> {
    const found = DEMO_USERS.find(u => u.email === email && u.password === password && u.isActive);
    if (found) {
      const { password: _pw, ...safeUser } = found;
      const withLogin = { ...safeUser, lastLogin: new Date().toISOString() };
      setUser(withLogin);
      localStorage.setItem('dnr_user', JSON.stringify(withLogin));
      return true;
    }
    return false;
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('dnr_user');
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
