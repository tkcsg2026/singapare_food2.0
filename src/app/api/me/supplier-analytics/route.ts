import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, requireAuth } from "@/lib/supabase-server";

/**
 * GET /api/me/supplier-analytics?months=6
 * Returns view + WhatsApp tap stats for the logged-in user when linked as a supplier representative.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const months = Math.min(24, Math.max(1, parseInt(req.nextUrl.searchParams.get("months") ?? "6", 10)));

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: link } = await admin
    .from("supplier_representatives")
    .select("supplier_id")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!link?.supplier_id) {
    return NextResponse.json({ linked: false });
  }

  const { data: supplier, error: sErr } = await admin
    .from("suppliers")
    .select("id, slug, name, name_ja, views, whatsapp_clicks")
    .eq("id", link.supplier_id)
    .single();

  if (sErr || !supplier) {
    return NextResponse.json({ linked: false });
  }

  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const sid = link.supplier_id;

  const [viewRes, waRes] = await Promise.all([
    admin.from("supplier_view_logs").select("viewed_at").eq("supplier_id", sid).gte("viewed_at", sinceIso),
    admin.from("whatsapp_click_logs").select("clicked_at").eq("supplier_id", sid).gte("clicked_at", sinceIso),
  ]);

  const bucketsView: Record<string, number> = {};
  for (const row of viewRes.data ?? []) {
    const key = (row.viewed_at as string).slice(0, 7);
    bucketsView[key] = (bucketsView[key] ?? 0) + 1;
  }
  const bucketsWa: Record<string, number> = {};
  for (const row of waRes.data ?? []) {
    const key = (row.clicked_at as string).slice(0, 7);
    bucketsWa[key] = (bucketsWa[key] ?? 0) + 1;
  }

  const monthlyViews: { month: string; views: number }[] = [];
  const monthlyWhatsapp: { month: string; clicks: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyViews.push({ month: key, views: bucketsView[key] ?? 0 });
    monthlyWhatsapp.push({ month: key, clicks: bucketsWa[key] ?? 0 });
  }

  return NextResponse.json({
    linked: true,
    supplier,
    monthlyViews,
    monthlyWhatsapp,
  });
}
