import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient, requireAuth } from "@/lib/supabase-server";
import { sendNewShopListingNotification } from "@/lib/email";

const LISTING_TYPES = ["rent", "takeover", "both"] as const;

/** Postgres 42P01 = relation does not exist; PGRST205 = table not in PostgREST schema cache */
function isTableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /does not exist|schema cache/i.test(error.message || "");
}

function parseLimit(raw: string | null, max = 100): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(max, Math.floor(n));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const listingType = searchParams.get("listing_type");
  const all = searchParams.get("all") === "true";
  const status = searchParams.get("status") || "approved";
  const seller_id = searchParams.get("seller_id");
  const limit = parseLimit(searchParams.get("limit"));

  // Non-approved rows are only served to the owner (seller_id path) or an admin
  // (all / status=pending paths); those paths need the RLS-bypassing admin client.
  const useAdmin = all || status === "pending" || !!seller_id;
  if (useAdmin) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const isAdmin = auth.role === "admin";
    if (seller_id) {
      if (!isAdmin && seller_id !== auth.userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  const supabase = useAdmin ? createAdminSupabaseClient() : createServerSupabaseClient();
  if (!supabase) return NextResponse.json([]);

  let query = supabase.from("shop_listings").select("*");
  if (seller_id) {
    query = query.eq("seller_id", seller_id);
  } else if (!all) {
    query = query.eq("status", status);
  }
  if (listingType && (LISTING_TYPES as readonly string[]).includes(listingType)) {
    query = query.eq("listing_type", listingType);
  }
  query = query.order("created_at", { ascending: false });
  if (limit && !seller_id && !all) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    // No mock fallback for shop listings; an empty board is the safe default
    // (covers both real errors and the table not being migrated yet).
    return NextResponse.json([]);
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!body?.slug || typeof body.slug !== "string") {
    return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  }
  if (!LISTING_TYPES.includes(body?.listing_type)) {
    return NextResponse.json({ error: "Invalid listing type" }, { status: 400 });
  }
  if (!body?.description || typeof body.description !== "string") {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }

  // Whitelist columns so arbitrary fields can't be injected
  const row = {
    slug: body.slug,
    title: body.title,
    listing_type: body.listing_type,
    location: body.location || "",
    building: body.building || "",
    monthly_rent: body.monthly_rent || "",
    floor_size: body.floor_size || "",
    asking_price: body.asking_price || "",
    lease_remaining: body.lease_remaining || "",
    suitable_for: body.suitable_for || "",
    key_features: Array.isArray(body.key_features)
      ? body.key_features.filter((f: unknown) => typeof f === "string" && f.trim()).slice(0, 20)
      : [],
    reason: body.reason || "",
    description: body.description,
    image: body.image || "",
    images: Array.isArray(body.images)
      ? body.images.filter((u: unknown) => typeof u === "string" && u).slice(0, 5)
      : [],
    // Ownership comes from the verified token, never from the request body
    seller_id: auth.userId,
    seller_name: body.seller_name || "",
    seller_whatsapp: body.seller_whatsapp || "",
    status: "pending",
  };

  const { data, error } = await supabase.from("shop_listings").insert(row).select().single();
  if (error) {
    if (isTableMissing(error)) {
      return NextResponse.json(
        { error: "Shop listings are not set up yet", code: "SHOP_LISTINGS_NOT_READY" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify admin of new pending listing
  try {
    await sendNewShopListingNotification({
      title: row.title,
      sellerName: row.seller_name || "Unknown",
      listingType: row.listing_type,
    });
  } catch {
    // Email failure must not block the listing submission
  }

  return NextResponse.json(data);
}
