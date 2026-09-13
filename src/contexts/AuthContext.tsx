import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { localApi } from '@/lib/localApi';

type LocalAuthUser = {
  id: string;
  email?: string;
  user_metadata?: { name?: string };
};

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  role_id?: string;
  avatar?: string;
  companies?: string[];
  stores?: string[];
}

interface AuthState {
  user: AuthUser | null;
  session: any | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: any }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const lastSessionRef = useRef<string | null>(null);

  useEffect(() => {
    // Check active sessions and subscribe to auth changes
    localApi.auth.getSession()
      .then(({ data: { session } }) => {
        lastSessionRef.current = session?.session_id || session?.access_token || null;
        setSession(session);
        if (session?.user) {
          fetchUserProfile(session.user);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Erro ao recuperar sessão local:', err);
        setLoading(false);
      });

    const { data: { subscription } } = localApi.auth.onAuthStateChange((_event, session) => {
      // Só atualiza se a sessão realmente mudou
      const newSessionId = session?.session_id || session?.access_token || null;
      if (newSessionId === lastSessionRef.current) {
        return; // Ignora se for a mesma sessão
      }

      lastSessionRef.current = newSessionId;
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (localApiUser: LocalAuthUser) => {
    setLoading(true);
    try {
      const { data, error } = await localApi
        .from('profiles')
        .select('*')
        .eq('id', localApiUser.id)
        .single();

      if (error) {
        // Fallback for new users or if profile hasn't been created yet
        setUser({
          id: localApiUser.id,
          name: localApiUser.user_metadata?.name || localApiUser.email?.split('@')[0] || 'User',
          email: localApiUser.email || '',
          role: 'user',
        });
      } else {
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          role_id: data.role_id,
          avatar: data.avatar,
          companies: data.companies,
          stores: data.stores,
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const { error } = await localApi.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const { error } = await localApi.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        }
      }
    });
    return { error };
  };

  const logout = async () => {
    await localApi.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isAuthenticated: !!user,
      login,
      signUp,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
