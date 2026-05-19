import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
  requireAdmin,
  logAuditAction,
} from "@/lib/supabase-server";
import { suppliers as mockSuppliers } from "@/data/mockData";

function normaliseMock(s: any) {
  return {
    ...s,
    name_ja: s.nameJa ?? s.name_ja ?? s.name,
    category_ja: s.categoryJa ?? s.category_ja ?? s.category,
    area_ja: s.areaJa ?? s.area_ja ?? s.area,
    description_ja: s.descriptionJa ?? s.description_ja ?? s.description,
    products: s.products ?? [],
  };
}

/** True when the request comes from an authenticated admin, so we can serve
 *  hidden suppliers in the dashboard preview/edit flow. */
async function callerIsAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const supabase = createServerSupabaseClient();
  if (!supabase) return false;
  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return false;
    const { data: profile } = await supabase
      .from("profiles").select("role, banned").eq("id", user.id).single();
    return Boolean(profile && profile.role === "admin" && !profile.banned);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: slugParam } = await params;
  const slug = decodeURIComponent(slugParam);
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    const mock = mockSuppliers.find((s) => s.slug === slug);
    if (!mock) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(normaliseMock(mock));
  }

  const { data: supplier, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !supplier || !supplier.id) {
    const mock = mockSuppliers.find((s) => s.slug === slug);
    if (!mock) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(normaliseMock(mock));
  }

  // Hidden suppliers are 404 to the public; admins can still preview/edit.
  if (supplier.hidden) {
    const adminAllowed = await callerIsAdmin(req);
    if (!adminAllowed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Increment view count and log a timestamped row for monthly stats
  const admin = createAdminSupabaseClient();
  if (admin) {
    await Promise.all([
      admin.from("suppliers").update({ views: (supplier.views ?? 0) + 1 }).eq("id", supplier.id),
      admin.from("supplier_view_logs").insert({ supplier_id: supplier.id }),
    ]);
  }

  const { data: products } = await (admin ?? supabase)
    .from("supplier_products")
    .select("*")
    .eq("supplier_id", supplier.id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  const normalisedProducts = (products || []).map((p: Record<string, unknown>) => ({
    id: p.id,
    supplier_id: p.supplier_id,
    name: p.name ?? "",
    name_en: p.name_en ?? "",
    image: p.image ?? "",
    moq: p.moq ?? "",
    country_of_origin: p.country_of_origin ?? "",
    country_of_origin_en: p.country_of_origin_en ?? "",
    weight: p.weight ?? "",
    quantity: p.quantity ?? "",
    price: p.price ?? "",
    description: p.description ?? "",
    size_w: p.size_w ?? "",
    size_d: p.size_d ?? "",
    size_h: p.size_h ?? "",
    size_unit: p.size_unit ?? "cm",
    storage_condition: p.storage_condition ?? "",
    temperature: p.temperature ?? "",
    video_url: p.video_url ?? "",
    video_playback_url: p.video_playback_url ?? p.video_transcoded_url ?? p.video_url ?? "",
    video_transcoded_url: p.video_transcoded_url ?? "",
    video_transcode_status: p.video_transcode_status ?? (p.video_url ? "not_needed" : "none"),
    video_transcode_error: p.video_transcode_error ?? "",
    video_transcode_requested_at: p.video_transcode_requested_at ?? null,
    video_transcoded_at: p.video_transcoded_at ?? null,
  }));

  return NextResponse.json({ ...supplier, products: normalisedProducts });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;

  const { slug: slugParam } = await params;
  const slug = decodeURIComponent(slugParam);
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();
  // 説明文を含む全フィールドを明示的に渡す（欠落で上書きされないようにする）
  const updatePayload: Record<string, unknown> = { ...body };
  if (typeof body.description !== "undefined") updatePayload.description = body.description;
  if (typeof body.description_ja !== "undefined") updatePayload.description_ja = body.description_ja;
  const { data, error } = await supabase
    .from("suppliers")
    .update(updatePayload)
    .eq("slug", slug)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;

  const { slug: slugParam } = await params;
  const slug = decodeURIComponent(slugParam);
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: row } = await supabase
    .from("suppliers")
    .select("id, name, name_ja, slug")
    .eq("slug", slug)
    .maybeSingle();

  const { error } = await supabase.from("suppliers").delete().eq("slug", slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (row?.id) {
    await logAuditAction({
      adminId: adminAuth.adminId,
      action: "delete_supplier",
      targetType: "supplier",
      targetId: row.id,
      detail: `${row.name_ja || row.name || slug}`,
    });
  }

  return NextResponse.json({ success: true });
}
