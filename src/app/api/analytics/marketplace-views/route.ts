import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

/**
 * GET /api/analytics/marketplace-views?months=6
 * Returns monthly page-view counts for /marketplace/[slug] paths,
 * and per-item totals for the top items.
 * Derived from the existing page_views table — no extra DB table needed.
 */
export async function GET(req: NextRequest) {
  const months = parseInt(req.nextUrl.searchParams.get("months") ?? "6", 10);
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ monthly: [], topItems: [] });

  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const { data, error } = await admin
    .from("page_views")
    .select("path, visited_at")
    .like("path", "/marketplace/%")
    .gte("visited_at", since.toISOString());

  if (error || !data) return NextResponse.json({ monthly: [], topItems: [] });

  // Filter out the /marketplace listing page itself
  const itemViews = data.filter((r) => {
    const parts = r.path.replace(/\/$/, "").split("/");
    return parts.length >= 3 && parts[2];
  });

  // Monthly buckets
  const buckets: Record<string, number> = {};
  for (const row of itemViews) {
    const key = (row.visited_at as string).slice(0, 7);
    buckets[key] = (buckets[key] ?? 0) + 1;
  }
  const monthly: { month: string; views: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthly.push({ month: key, views: buckets[key] ?? 0 });
  }

  // Per-item totals (top 10)
  const itemBuckets: Record<string, number> = {};
  for (const row of itemViews) {
    const slug = row.path.replace(/\/$/, "").split("/")[2] ?? "";
    if (slug) itemBuckets[slug] = (itemBuckets[slug] ?? 0) + 1;
  }
  const topItems = Object.entries(itemBuckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([slug, views]) => ({ slug, views }));

  return NextResponse.json({ monthly, topItems });
}
