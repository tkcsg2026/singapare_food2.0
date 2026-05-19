import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, requireAdmin } from "@/lib/supabase-server";

/**
 * GET /api/admin/suppliers
 * Full supplier list for admin analytics (service role; includes all rows and view counts).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await admin
    .from("suppliers")
    .select("*")
    .order("views", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
