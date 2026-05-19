import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const revalidate = 60; // revalidate cached response every 60 seconds

export async function GET() {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ suppliers: 0, products: 0, categories: 0, users: 0 });
  }

  const [suppliersRes, productsRes, categoriesRes, usersRes] = await Promise.all([
    supabase.from("suppliers").select("id", { count: "exact", head: true }),
    supabase.from("supplier_products").select("id", { count: "exact", head: true }),
    supabase
      .from("categories")
      .select("value", { count: "exact", head: false })
      .eq("type", "supplier"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  // Deduplicate category values the same way the categories API does
  const uniqueCategories = new Set(
    (categoriesRes.data ?? []).map((c: { value: string }) => c.value)
  ).size;

  return NextResponse.json({
    suppliers: suppliersRes.count ?? 0,
    products: productsRes.count ?? 0,
    categories: uniqueCategories || categoriesRes.count || 0,
    users: usersRes.count ?? 0,
  });
}
