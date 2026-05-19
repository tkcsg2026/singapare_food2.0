import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

/** POST /api/analytics/pageview  — record one page hit */
export async function POST(req: NextRequest) {
  const { path = "/" } = await req.json().catch(() => ({}));
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ ok: false, reason: "no-db" });

  await admin.from("page_views").insert({ path });
  return NextResponse.json({ ok: true });
}

/** GET /api/analytics/pageview?months=6  — aggregate monthly totals */
export async function GET(req: NextRequest) {
  const months = parseInt(req.nextUrl.searchParams.get("months") ?? "6", 10);
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json([]);

  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const { data, error } = await admin
    .from("page_views")
    .select("visited_at")
    .gte("visited_at", since.toISOString());

  if (error || !data) return NextResponse.json([]);

  // Bucket by "YYYY-MM"
  const buckets: Record<string, number> = {};
  for (const row of data) {
    const key = (row.visited_at as string).slice(0, 7);
    buckets[key] = (buckets[key] ?? 0) + 1;
  }

  // Fill every month in range so chart has no gaps
  const result: { month: string; visits: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.push({ month: key, visits: buckets[key] ?? 0 });
  }

  return NextResponse.json(result);
}
