import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, requireAdmin } from "@/lib/supabase-server";

/** GET /api/admin/audit-log — Returns last 200 audit log entries (admin only). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data, error } = await admin
    .from("audit_logs")
    .select(
      "id, action, target_type, target_id, detail, created_at, admin:admin_id(name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    // Table does not exist yet — return empty list gracefully
    if (error.code === "42P01") return NextResponse.json({ logs: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data || [] });
}
