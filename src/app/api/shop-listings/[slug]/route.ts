import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSupabaseClient,
  requireAdmin,
  requireAuth,
  logAuditAction,
} from "@/lib/supabase-server";
import { sendMarketplaceRejectionEmail } from "@/lib/email";

const EDITABLE_FIELDS = [
  "title",
  "listing_type",
  "location",
  "building",
  "monthly_rent",
  "floor_size",
  "asking_price",
  "lease_remaining",
  "suitable_for",
  "key_features",
  "reason",
  "description",
  "image",
  "images",
  "seller_name",
  "seller_whatsapp",
  "status",
  "reject_reason",
] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const byId = searchParams.get("byId") === "true";

  // Admin client so pending/rejected rows are readable; visibility is gated below.
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let query = supabase.from("shop_listings").select("*");
  query = byId ? query.eq("id", slug) : query.eq("slug", slug);
  const { data, error } = await query.single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (data.status !== "approved") {
    // Only the owner or an admin may view a non-approved listing
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isOwner = data.seller_id && data.seller_id === auth.userId;
    if (!isOwner && auth.role !== "admin") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) update[field] = body[field];
  }
  if (typeof update.status === "string" && !["pending", "approved", "rejected"].includes(update.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields in request" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("shop_listings")
    .update(update)
    .eq("slug", slug)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the poster when their listing is rejected (mirrors marketplace flow)
  if (update.status === "rejected" && data?.seller_id) {
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(data.seller_id);
      if (userData?.user?.email) {
        await sendMarketplaceRejectionEmail({
          userEmail: userData.user.email,
          userName: data.seller_name || "User",
          itemTitle: data.title,
          rejectReason: (update.reject_reason as string) || "",
        });
      }
    } catch {
      // Email failure must not block the moderation action
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: row } = await supabase
    .from("shop_listings")
    .select("id, seller_id, title")
    .eq("slug", slug)
    .single();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Admin path: delete anything + audit log
  const admin = await requireAdmin(req);
  if (!(admin instanceof NextResponse)) {
    const { error } = await supabase.from("shop_listings").delete().eq("slug", slug);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAuditAction({
      adminId: admin.adminId,
      action: "delete_shop_listing",
      targetType: "shop_listing",
      targetId: row.id,
      detail: row.title,
    });
    return NextResponse.json({ success: true });
  }

  // Owner path
  const userAuth = await requireAuth(req);
  if (userAuth instanceof NextResponse) return userAuth;
  if (!row.seller_id || row.seller_id !== userAuth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await supabase.from("shop_listings").delete().eq("slug", slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
