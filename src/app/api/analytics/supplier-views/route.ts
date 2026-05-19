import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

/**
 * GET /api/analytics/supplier-views?months=6&supplierId=<uuid>
 * Returns monthly view counts for one supplier (or site-wide if no supplierId).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const months = parseInt(searchParams.get("months") ?? "6", 10);
  const supplierId = searchParams.get("supplierId");
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json([]);

  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  let query = admin
    .from("supplier_view_logs")
    .select("viewed_at")
    .gte("viewed_at", since.toISOString());

  if (supplierId) query = query.eq("supplier_id", supplierId);

  const { data, error } = await query;
  if (error || !data) return NextResponse.json([]);

  const buckets: Record<string, number> = {};
  for (const row of data) {
    const key = (row.viewed_at as string).slice(0, 7);
    buckets[key] = (buckets[key] ?? 0) + 1;
  }

  const result: { month: string; views: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.push({ month: key, views: buckets[key] ?? 0 });
  }

  return NextResponse.json(result);
}
