import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

interface AuthCtxType {
  user: AuthUser | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthCtxType | null>(null);

function extractUser(u: User | null): AuthUser | null {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? '',
    username: u.user_metadata?.username ?? u.email?.split('@')[0] ?? 'Player',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(extractUser(data.session?.user ?? null));
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(extractUser(session?.user ?? null));
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string, username: string) {
    const trimmed = username.trim();
    if (!trimmed) return { error: 'Username is required.' };

    // Check username uniqueness
    const { data: existing } = await supabase
      .from('hc_players').select('username').eq('username', trimmed).maybeSingle();
    if (existing) return { error: 'Username already taken. Pick another.' };

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username: trimmed } },
    });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'Sign up failed — please try again.' };

    // Create player row linked to auth user
    await supabase.from('hc_players').upsert({
      username: trimmed,
      user_id: data.user.id,
      matches: 0, wins: 0, losses: 0, ties: 0,
      bat_runs: 0, bat_balls: 0, bat_outs: 0, bat_hs: 0,
      bowl_wkts: 0, bowl_runs: 0, bowl_balls: 0,
      catches: 0, runouts: 0, stumpings: 0,
    });

    return { error: null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthCtx.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
