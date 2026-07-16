import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '@/types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN' && session?.user) {
          await fetchProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
    }
    setLoading(false);
  }

  async function signUp(
    email: string,
    password: string,
    fullName?: string
  ): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || '',
          },
        },
      });

      if (error) {
        return { error: getErrorMessage(error.message) };
      }

      return { error: null };
    } catch {
      return { error: 'Une erreur est survenue' };
    }
  }

  async function signIn(
    email: string,
    password: string
  ): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: getErrorMessage(error.message) };
      }

      return { error: null };
    } catch {
      return { error: 'Une erreur est survenue' };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }

  async function updateProfile(
    updates: Partial<Profile>
  ): Promise<{ error: string | null }> {
    if (!user) return { error: 'Non connecte' };

    const updateData: { full_name?: string | null; avatar_url?: string | null } = {};
    if (updates.full_name !== undefined) updateData.full_name = updates.full_name;
    if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (error) {
      return { error: error.message };
    }

    // Refresh profile
    await fetchProfile(user.id);
    return { error: null };
  }

  function getErrorMessage(error: string): string {
    if (error.includes('Invalid login credentials')) {
      return 'Email ou mot de passe incorrect';
    }
    if (error.includes('User already registered')) {
      return 'Cet email est deja utilise';
    }
    if (error.includes('Password should be at least')) {
      return 'Le mot de passe doit contenir au moins 6 caracteres';
    }
    if (error.includes('Invalid email')) {
      return 'Email invalide';
    }
    return error;
  }

  const value = {
    session,
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
