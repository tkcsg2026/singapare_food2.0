import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

/**
 * GET /api/analytics/supplier-monthly-report?month=YYYY-MM
 * Returns per-supplier monthly view + WhatsApp tap counts.
 */
export async function GET(req: NextRequest) {
  const month = (req.nextUrl.searchParams.get("month") ?? "").trim();
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ? month
    : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json([]);

  const from = new Date(`${validMonth}-01T00:00:00.000Z`);
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 1);

  const [supRes, viewRes, waRes] = await Promise.all([
    admin.from("suppliers").select("id, slug, name, name_ja"),
    admin
      .from("supplier_view_logs")
      .select("supplier_id")
      .gte("viewed_at", from.toISOString())
      .lt("viewed_at", to.toISOString()),
    admin
      .from("whatsapp_click_logs")
      .select("supplier_id")
      .gte("clicked_at", from.toISOString())
      .lt("clicked_at", to.toISOString()),
  ]);

  if (supRes.error || !supRes.data) return NextResponse.json([]);
  if (viewRes.error || waRes.error) return NextResponse.json([]);

  const counts = new Map<string, number>();
  for (const row of viewRes.data ?? []) {
    const sid = String(row.supplier_id ?? "");
    if (!sid) continue;
    counts.set(sid, (counts.get(sid) ?? 0) + 1);
  }

  const waCounts = new Map<string, number>();
  for (const row of waRes.data ?? []) {
    const sid = String(row.supplier_id ?? "");
    if (!sid) continue;
    waCounts.set(sid, (waCounts.get(sid) ?? 0) + 1);
  }

  const rows = supRes.data
    .map((s) => ({
      supplier_id: s.id,
      slug: s.slug,
      name: s.name,
      name_ja: s.name_ja,
      views: counts.get(s.id) ?? 0,
      whatsapp: waCounts.get(s.id) ?? 0,
    }))
    .sort((a, b) => (b.views - a.views) || (b.whatsapp - a.whatsapp));

  return NextResponse.json({ month: validMonth, rows });
}
