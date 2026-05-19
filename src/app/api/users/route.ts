import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, requireAdmin } from "@/lib/supabase-server";

/** GET /api/users — List all registered users (admin only). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, email, name, username, avatar_url, role, whatsapp, company, created_at, banned")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: reps } = await admin.from("supplier_representatives").select("user_id, supplier_id");
  const repByUser = new Map((reps ?? []).map((r) => [r.user_id as string, r.supplier_id as string]));

  const merged = (profiles ?? []).map((p) => ({
    ...p,
    supplier_representatives: repByUser.has(p.id)
      ? { supplier_id: repByUser.get(p.id) as string }
      : null,
  }));

  return NextResponse.json(merged);
}
