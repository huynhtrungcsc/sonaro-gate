import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, getStoredSession, type AuthUser, type AuthSession, type AppRole } from '@/lib/postgrest';

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdminOrSuper: boolean;
  isOperatorOrHigher: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const stored = getStoredSession();
    if (stored) {
      setSession(stored);
      setUser(stored.user);
      setRoles(stored.roles);
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error, session: newSession } = await authApi.signIn(email, password);
    if (error) return { error };
    if (newSession) {
      setSession(newSession);
      setUser(newSession.user);
      setRoles(newSession.roles);
    }
    return { error: null };
  };

  const signUp = async (_email: string, _password: string, _fullName: string) => {
    // Self-hosted: registration is done via admin panel or CLI
    return { error: new Error('Registration is not available. Contact your administrator.') };
  };

  const signOut = async () => {
    authApi.signOut();
    setSession(null);
    setUser(null);
    setRoles([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdminOrSuper = hasRole('super_admin') || hasRole('admin');
  const isOperatorOrHigher = isAdminOrSuper || hasRole('operator');

  return (
    <AuthContext.Provider value={{
      user,
      session,
      roles,
      loading,
      signIn,
      signUp,
      signOut,
      hasRole,
      isAdminOrSuper,
      isOperatorOrHigher,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
