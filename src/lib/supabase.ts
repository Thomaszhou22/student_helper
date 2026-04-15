import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Read Vite env string safely: trim, reject empty and literal "undefined"/"null". */
function readEnvString(raw: unknown): string {
  if (raw == null || typeof raw !== "string") return "";
  const s = raw.trim();
  if (s === "" || s === "undefined" || s === "null") return "";
  return s;
}

function getSupabaseUrlRaw(): string {
  return readEnvString(import.meta.env.VITE_SUPABASE_URL);
}

function getSupabaseAnonKeyRaw(): string {
  return readEnvString(import.meta.env.VITE_SUPABASE_ANON_KEY);
}

function isValidSupabaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Returns true when Vite env has both Supabase public keys (non-empty, sensible).
 * Auth features stay disabled until these are set (see AuthProvider).
 */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrlRaw();
  const key = getSupabaseAnonKeyRaw();
  if (!url || !key) return false;
  if (!isValidSupabaseUrl(url)) return false;
  return true;
}

let client: SupabaseClient | null = null;

/** Shared browser client; session persisted by Supabase (localStorage). */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  const url = getSupabaseUrlRaw();
  const key = getSupabaseAnonKeyRaw();
  if (!client) {
    if (import.meta.env.DEV) {
      console.log("Supabase initialized");
    }
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

if (import.meta.env.DEV) {
  const rawUrl = import.meta.env.VITE_SUPABASE_URL;
  const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  console.log("SUPABASE ENV", {
    url: rawUrl,
    key: rawKey ? "present" : "missing",
  });
}
