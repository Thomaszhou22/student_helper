import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";

export type UserProfile = {
  role: string;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** False when env vars are missing — auth UI should show setup message */
  supabaseReady: boolean;
  /** Loaded from `user_profiles` when logged in */
  profile: UserProfile | null;
  /** True when `profile.role === 'admin'` */
  isAdmin: boolean;
  /** True while fetching `user_profiles` for the current user */
  profileLoading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null; session: Session | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("supabaseReady:", supabaseReady);
    }
  }, [supabaseReady]);

  useEffect(() => {
    if (!supabaseReady) {
      setLoading(false);
      return;
    }

    const sb = getSupabase();

    let cancelled = false;
    sb.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!cancelled) {
          setSession(s);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null);
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabaseReady]);

  const user = session?.user ?? null;

  useEffect(() => {
    if (!supabaseReady || !user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const sb = getSupabase();
    let cancelled = false;
    void sb
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setProfileLoading(false);
        if (error || !data?.role) {
          setProfile(null);
          return;
        }
        setProfile({ role: data.role });
      });
    return () => {
      cancelled = true;
      setProfileLoading(false);
    };
  }, [supabaseReady, user]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabaseReady) {
        return { error: null };
      }
      const sb = getSupabase();
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return { error };
    },
    [supabaseReady],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!supabaseReady) {
        return { error: null, session: null };
      }
      const sb = getSupabase();
      const { data, error } = await sb.auth.signUp({ email, password });
      return { error, session: data.session };
    },
    [supabaseReady],
  );

  const signOut = useCallback(async () => {
    if (!supabaseReady) return;
    const sb = getSupabase();
    await sb.auth.signOut();
  }, [supabaseReady]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      supabaseReady,
      profile,
      isAdmin: profile?.role === "admin",
      profileLoading,
      signIn,
      signUp,
      signOut,
    }),
    [
      session,
      loading,
      supabaseReady,
      profile,
      profileLoading,
      signIn,
      signUp,
      signOut,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
