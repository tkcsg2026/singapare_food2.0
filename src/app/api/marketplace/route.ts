import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
  isUnknownColumnError,
} from "@/lib/supabase-server";
import { marketplaceItems as mockItems } from "@/data/mockData";
import { sendNewListingNotification } from "@/lib/email";

/** "selling" = offered for sale, "wanted" = looking to buy */
const POST_TYPES = ["selling", "wanted"] as const;

function normaliseMock(item: any) {
  return {
    ...item,
    post_type: item.post_type ?? "selling",
    years_used: item.yearsUsed ?? item.years_used ?? 0,
    seller_id: item.sellerId ?? item.seller_id ?? null,
    seller_name: item.sellerName ?? item.seller_name ?? "",
    seller_whatsapp: item.sellerWhatsapp ?? item.seller_whatsapp ?? "",
    created_at: item.createdAt ?? item.created_at ?? new Date().toISOString(),
    area_en: item.area_en ?? item.areaEn,
    condition_en: item.condition_en ?? item.conditionEn,
  };
}

function parseLimit(raw: string | null, max = 100): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(max, Math.floor(n));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const all = searchParams.get("all") === "true";
  const status = searchParams.get("status") || "approved";
  const sort = searchParams.get("sort") || "newest";
  const seller_id = searchParams.get("seller_id");
  const rawPostType = searchParams.get("post_type");
  const postType =
    rawPostType && (POST_TYPES as readonly string[]).includes(rawPostType) ? rawPostType : null;
  const limit = parseLimit(searchParams.get("limit"));
  // When true, never fall back to mock data – return real DB results only.
  // Used by the admin approval queue so mock pending items don't pollute it.
  const noFallback = searchParams.get("noFallback") === "true";

  // Use admin client when fetching by seller_id so RLS doesn't hide pending items from the owner
  const useAdmin = all || status === "pending" || !!seller_id;
  const supabase = useAdmin ? createAdminSupabaseClient() : createServerSupabaseClient();

  if (!supabase) {
    // DB not configured – honour noFallback
    if (noFallback) return NextResponse.json([]);
    let data = mockItems.map(normaliseMock);
    if (seller_id) data = data.filter((i) => i.seller_id === seller_id);
    else if (!all) data = data.filter((i) => i.status === status);
    if (category) data = data.filter((i) => i.category === category);
    if (postType) data = data.filter((i) => i.post_type === postType);
    if (sort === "price-asc") data.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") data.sort((a, b) => b.price - a.price);
    if (limit) data = data.slice(0, limit);
    return NextResponse.json(data);
  }

  let query = supabase.from("marketplace_items").select("*");
  if (seller_id) {
    query = query.eq("seller_id", seller_id);
  } else if (!all) {
    query = query.eq("status", status);
  }
  if (category) query = query.eq("category", category);
  if (postType) query = query.eq("post_type", postType);
  if (sort === "price-asc") query = query.order("price", { ascending: true });
  else if (sort === "price-desc") query = query.order("price", { ascending: false });
  else query = query.order("created_at", { ascending: false });
  if (limit && !seller_id && !all) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    // On DB error, honour noFallback – return empty so the queue shows nothing
    // instead of potentially confusing mock items.
    if (noFallback) return NextResponse.json([]);
    let fallback = mockItems.map(normaliseMock);
    if (seller_id) fallback = fallback.filter((i) => i.seller_id === seller_id);
    else if (!all) fallback = fallback.filter((i) => i.status === status);
    if (category) fallback = fallback.filter((i) => i.category === category);
    if (postType) fallback = fallback.filter((i) => i.post_type === postType);
    if (sort === "price-asc") fallback.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") fallback.sort((a, b) => b.price - a.price);
    return NextResponse.json(fallback);
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();
  if (!body.status) body.status = "pending";
  // Normalise before insert so an unknown value can't trip the CHECK constraint;
  // omitting it keeps the column default ("selling") for older clients.
  if (!(POST_TYPES as readonly string[]).includes(body.post_type)) body.post_type = "selling";

  let { data, error } = await supabase.from("marketplace_items").insert(body).select().single();
  if (error && isUnknownColumnError(error, "post_type")) {
    // The post_type migration has not been applied yet — post the item without
    // it rather than failing, so selling keeps working on an older database.
    const { post_type: _postType, ...legacyBody } = body;
    ({ data, error } = await supabase.from("marketplace_items").insert(legacyBody).select().single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify admin of new pending listing
  try {
    await sendNewListingNotification({
      title: body.title || "Unknown",
      sellerName: body.seller_name || "Unknown",
      price: body.price || 0,
    });
  } catch {}

  return NextResponse.json(data);
}
