import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

/** Anon key client — respects RLS. Use for public reads. */
export function createServerSupabaseClient(): SupabaseClient | null {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  } catch {
    return null;
  }
}

/** Service-role key client — bypasses RLS. Use only in server-side admin routes. */
export function createAdminSupabaseClient(): SupabaseClient | null {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Prefer the dedicated service role key; fall back to anon key so basic reads still work.
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch {
    return null;
  }
}

/**
 * Reads the Bearer token from the Authorization header, verifies it with
 * Supabase, and confirms the caller has the "admin" role in profiles.
 *
 * Returns `{ adminId: string }` on success, or a NextResponse error that
 * should be returned immediately from the route handler.
 */
/**
 * Reads the Bearer token from the Authorization header, verifies it with
 * Supabase, and confirms the caller is a logged-in, non-banned user.
 *
 * Returns `{ userId: string; role: string }` on success, or a NextResponse
 * error that should be returned immediately from the route handler.
 */
export async function requireAuth(
  req: NextRequest,
): Promise<{ userId: string; role: string } | NextResponse> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, banned")
    .eq("id", user.id)
    .single();

  if (!profile || profile.banned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: user.id, role: profile.role ?? "user" };
}

export async function requireAdmin(
  req: NextRequest,
): Promise<{ adminId: string } | NextResponse> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, banned")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || profile.banned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { adminId: user.id };
}

/**
 * Appends a row to the audit_logs table.
 * Silently ignores errors so logging never blocks the main operation.
 */
export async function logAuditAction(opts: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  detail?: string;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  if (!admin) return;
  try {
    await admin.from("audit_logs").insert({
      admin_id: opts.adminId,
      action: opts.action,
      target_type: opts.targetType,
      target_id: opts.targetId,
      detail: opts.detail ?? null,
    });
  } catch {
    // Silently ignore — table may not exist yet or RLS blocks the insert
  }
}
