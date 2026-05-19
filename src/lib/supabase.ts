import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function isValidSupabaseUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Returns the Supabase client for browser use. Uses createBrowserClient from
 * @supabase/ssr for cookie-based sessions, so server-set auth (e.g. password
 * reset via /api/auth/confirm-reset) is visible to the client.
 */
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || !isValidSupabaseUrl(url)) return null;
    _client = createBrowserClient(url.trim(), key.trim());
    return _client;
  } catch {
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}

// Convenience export – may be null before env vars are set
export const supabase = getSupabase();
