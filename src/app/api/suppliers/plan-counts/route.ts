import { createServerSupabaseClient } from "@/lib/supabase-server";
import { jsonWithPublicCache } from "@/lib/api-cache";
import { suppliers as mockSuppliers } from "@/data/mockData";
import { countSuppliersByPlan } from "@/lib/plans";

/** Exact tier counts for the whole `suppliers` table (not limited by list pagination). */
export async function GET() {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return jsonWithPublicCache(countSuppliersByPlan(mockSuppliers));
  }

  const { count: total, error: errTotal } = await supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true })
    .neq("hidden", true);
  const { count: premium, error: errP } = await supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true })
    .neq("hidden", true)
    .eq("plan", "premium");
  const { count: standard, error: errS } = await supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true })
    .neq("hidden", true)
    .eq("plan", "standard");

  if (errTotal || errP || errS || total == null) {
    return jsonWithPublicCache(countSuppliersByPlan(mockSuppliers));
  }

  const basic = Math.max(0, total - (premium ?? 0) - (standard ?? 0));
  return jsonWithPublicCache({
    premium: premium ?? 0,
    standard: standard ?? 0,
    basic,
  });
}
