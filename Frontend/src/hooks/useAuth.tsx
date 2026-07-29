import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User } from '../lib/types';
import toast from 'react-hot-toast';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) {
      localStorage.setItem('is_password_recovery', 'true');
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (_event === 'PASSWORD_RECOVERY') {
          localStorage.setItem('is_password_recovery', 'true');
        }

        setSession(session);
        if (session?.user) {
          setLoading(true);
          fetchUserProfile(session.user);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (supabaseUser: SupabaseUser) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();
        
      if (error) {
        console.error('Error fetching user profile:', error);
        if (error.code === 'PGRST116') {
          // Profile not found - usually means the database was reset but local session remains
          console.warn("Profile not found in database. Forcing logout to clear stale session.");
          await supabase.auth.signOut();
          setUser(null);
        } else {
          // Fallback for other errors
          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email || '',
            username: supabaseUser.email?.split('@')[0] || '',
            role: 'employee',
            created_at: supabaseUser.created_at,
          });
        }
      } else if (data) {
        if (data.is_active === false) {
          await supabase.auth.signOut();
          setUser(null);
          toast.error("Akun Anda telah dinonaktifkan oleh Admin. Silakan hubungi administrator.", { id: 'account-deactivated' });
        } else {
          setUser(data as User);
        }
      }

    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
