import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
  requireAdmin,
  requireAuth,
  logAuditAction,
} from "@/lib/supabase-server";
import { marketplaceItems as mockItems } from "@/data/mockData";
import { sendMarketplaceRejectionEmail } from "@/lib/email";

function normaliseMock(item: any) {
  return {
    ...item,
    years_used: item.yearsUsed ?? item.years_used ?? 0,
    seller_id: item.sellerId ?? item.seller_id ?? null,
    seller_name: item.sellerName ?? item.seller_name ?? "",
    seller_whatsapp: item.sellerWhatsapp ?? item.seller_whatsapp ?? "",
    created_at: item.createdAt ?? item.created_at ?? new Date().toISOString(),
    area_en: item.area_en ?? item.areaEn,
    condition_en: item.condition_en ?? item.conditionEn,
    delivery_en: item.delivery_en ?? item.deliveryEn,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = new URL(_req.url);
  const byId = searchParams.get("byId") === "true";
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    const mock = byId ? mockItems.find((i) => i.id === slug) : mockItems.find((i) => i.slug === slug);
    if (!mock) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(normaliseMock(mock));
  }

  let query = supabase.from("marketplace_items").select("*");
  query = byId ? query.eq("id", slug) : query.eq("slug", slug);
  const { data, error } = await query.single();
  if (error || !data) {
    const mock = byId ? mockItems.find((i) => i.id === slug) : mockItems.find((i) => i.slug === slug);
    if (!mock) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(normaliseMock(mock));
  }
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();

  // Fetch seller info before updating, needed for rejection email
  let sellerItem: any = null;
  if (body.status === "rejected") {
    const { data } = await supabase
      .from("marketplace_items")
      .select("seller_id, seller_name, title")
      .eq("slug", slug)
      .single();
    sellerItem = data;
  }

  const { data, error } = await supabase
    .from("marketplace_items")
    .update(body)
    .eq("slug", slug)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send rejection email to seller
  if (body.status === "rejected" && sellerItem?.seller_id) {
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(sellerItem.seller_id);
      if (userData?.user?.email) {
        await sendMarketplaceRejectionEmail({
          userEmail: userData.user.email,
          userName: sellerItem.seller_name || userData.user.email,
          itemTitle: sellerItem.title || slug,
          rejectReason: body.reject_reason || "",
        });
      }
    } catch {}
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const byId = searchParams.get("byId") === "true";
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const col = byId ? "id" : "slug";
  const { data: row, error: fetchErr } = await supabase
    .from("marketplace_items")
    .select("id, slug, title, seller_id")
    .eq(col, slug)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const adminAuth = await requireAdmin(req);
  const isAdmin = !(adminAuth instanceof NextResponse);

  if (isAdmin) {
    const { error } = await supabase.from("marketplace_items").delete().eq("id", row.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAuditAction({
      adminId: adminAuth.adminId,
      action: "delete_marketplace_item",
      targetType: "marketplace_item",
      targetId: row.id,
      detail: `${row.title || "(no title)"} · ${row.slug}`,
    });
    return NextResponse.json({ success: true });
  }

  const userAuth = await requireAuth(req);
  if (userAuth instanceof NextResponse) return userAuth;
  if (row.seller_id !== userAuth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("marketplace_items").delete().eq("id", row.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
