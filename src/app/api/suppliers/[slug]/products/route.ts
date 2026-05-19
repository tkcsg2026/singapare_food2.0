import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient, requireAdmin } from "@/lib/supabase-server";
import { getVideoTranscodeStateForUrl } from "@/lib/video";

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabaseClient>>;

const OPTIONAL_PRODUCT_COLUMNS = [
  "country_of_origin_en",
  "price",
  "description",
  "video_playback_url",
  "video_transcoded_url",
  "video_transcode_status",
  "video_transcode_error",
  "video_transcode_requested_at",
  "video_transcoded_at",
  // sort_order may be missing on older schemas — strip & retry rather than
  // 500-ing on insert so reordering is best-effort.
  "sort_order",
] as const;

function stripUnsupportedColumns(payload: Record<string, unknown>, errorMessage: string) {
  const unsupported = OPTIONAL_PRODUCT_COLUMNS.filter((col) => errorMessage.includes(col));
  if (unsupported.length === 0) return null;
  const next = { ...payload };
  for (const col of unsupported) delete next[col];
  return next;
}

async function insertWithSchemaFallback(admin: AdminClient, payload: Record<string, unknown>) {
  let currentPayload = { ...payload };
  const maxAttempts = OPTIONAL_PRODUCT_COLUMNS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await admin
      .from("supplier_products")
      .insert(currentPayload)
      .select()
      .single();
    if (!result.error) return result;

    const stripped = stripUnsupportedColumns(currentPayload, result.error.message);
    if (!stripped) return result;
    currentPayload = stripped;
  }

  return await admin
    .from("supplier_products")
    .insert(currentPayload)
    .select()
    .single();
}

async function updateWithSchemaFallback(
  admin: AdminClient,
  supplierId: string,
  id: string,
  payload: Record<string, unknown>,
) {
  let currentPayload = { ...payload };
  const maxAttempts = OPTIONAL_PRODUCT_COLUMNS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await admin
      .from("supplier_products")
      .update(currentPayload)
      .eq("id", id)
      .eq("supplier_id", supplierId)
      .select()
      .single();
    if (!result.error) return result;

    const stripped = stripUnsupportedColumns(currentPayload, result.error.message);
    if (!stripped) return result;
    currentPayload = stripped;
  }

  return await admin
    .from("supplier_products")
    .update(currentPayload)
    .eq("id", id)
    .eq("supplier_id", supplierId)
    .select()
    .single();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: slugParam } = await params;
  const slug = decodeURIComponent(slugParam);
  const supabase = createServerSupabaseClient();
  const admin = createAdminSupabaseClient();
  const client = admin ?? supabase;
  if (!client) return NextResponse.json([]);

  const { data: supplier } = await client
    .from("suppliers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!supplier) return NextResponse.json([]);

  // Order by sort_order so admin reorder (up/down) is reflected on the public site,
  // and so products don't appear in random order after each update. Fall back to id
  // for stability when sort_order ties.
  const { data: products } = await client
    .from("supplier_products")
    .select("*")
    .eq("supplier_id", supplier.id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  const normalisedProducts = (products || []).map((p: Record<string, unknown>) => ({
    ...p,
    video_playback_url: (p.video_playback_url as string) || (p.video_transcoded_url as string) || (p.video_url as string) || "",
    video_transcoded_url: (p.video_transcoded_url as string) || "",
    video_transcode_status: (p.video_transcode_status as string) || ((p.video_url as string) ? "not_needed" : "none"),
    video_transcode_error: (p.video_transcode_error as string) || "",
    video_transcode_requested_at: (p.video_transcode_requested_at as string) || null,
    video_transcoded_at: (p.video_transcoded_at as string) || null,
  }));

  return NextResponse.json(normalisedProducts);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;

  const { slug: slugParam } = await params;
  const slug = decodeURIComponent(slugParam);
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: supplier } = await admin
    .from("suppliers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const body = await req.json();
  const str = (v: unknown) => (v != null ? String(v).trim() : "");
  const videoUrl = str(body.video_url);

  // Append new products at the end of the supplier's product list. Without this
  // the column default (0) makes every new row tie with the existing first row,
  // so the public list order would shuffle each time a product is added.
  let nextSortOrder = 0;
  const { data: maxRow } = await admin
    .from("supplier_products")
    .select("sort_order")
    .eq("supplier_id", supplier.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxRow && typeof maxRow.sort_order === "number") {
    nextSortOrder = maxRow.sort_order + 1;
  }

  const payload: Record<string, unknown> = {
    supplier_id: supplier.id,
    name:              str(body.name),
    name_en:           str(body.name_en),
    image:             str(body.image),
    moq:               str(body.moq),
    country_of_origin: str(body.country_of_origin),
    country_of_origin_en: str(body.country_of_origin_en),
    weight:            str(body.weight),
    quantity:          str(body.quantity),
    size_w:            str(body.size_w),
    size_d:            str(body.size_d),
    size_h:            str(body.size_h),
    size_unit:         str(body.size_unit) || "cm",
    storage_condition: str(body.storage_condition),
    temperature:       str(body.temperature),
    video_url:         videoUrl,
    price:             str(body.price),
    description:       str(body.description),
    sort_order:        nextSortOrder,
  };
  const videoTranscode = getVideoTranscodeStateForUrl(videoUrl);
  payload.video_playback_url = videoTranscode.video_playback_url;
  payload.video_transcoded_url = videoTranscode.video_transcoded_url;
  payload.video_transcode_status = videoTranscode.video_transcode_status;
  payload.video_transcode_error = videoTranscode.video_transcode_error;
  payload.video_transcode_requested_at = videoTranscode.video_transcode_requested_at;
  payload.video_transcoded_at = videoTranscode.video_transcoded_at;

  const { data, error } = await insertWithSchemaFallback(admin, payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;

  const { slug: slugParam } = await params;
  const slug = decodeURIComponent(slugParam);
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: supplier } = await admin
    .from("suppliers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const body = await req.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: "Product id required" }, { status: 400 });

  const str = (v: unknown) => (v != null ? String(v).trim() : "");
  const videoUrl = str(body.video_url);
  const payload: Record<string, unknown> = {
    name:              str(body.name),
    name_en:           str(body.name_en),
    image:             str(body.image),
    moq:               str(body.moq),
    country_of_origin: str(body.country_of_origin),
    country_of_origin_en: str(body.country_of_origin_en),
    weight:            str(body.weight),
    quantity:          str(body.quantity),
    size_w:            str(body.size_w),
    size_d:            str(body.size_d),
    size_h:            str(body.size_h),
    size_unit:         str(body.size_unit) || "cm",
    storage_condition: str(body.storage_condition),
    temperature:       str(body.temperature),
    video_url:         videoUrl,
    price:             str(body.price),
    description:       str(body.description),
  };
  const videoTranscode = getVideoTranscodeStateForUrl(videoUrl);
  payload.video_playback_url = videoTranscode.video_playback_url;
  payload.video_transcoded_url = videoTranscode.video_transcoded_url;
  payload.video_transcode_status = videoTranscode.video_transcode_status;
  payload.video_transcode_error = videoTranscode.video_transcode_error;
  payload.video_transcode_requested_at = videoTranscode.video_transcode_requested_at;
  payload.video_transcoded_at = videoTranscode.video_transcoded_at;

  const { data, error } = await updateWithSchemaFallback(admin, supplier.id, id, payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

/**
 * Reorder products by swapping the sort_order of two rows belonging to the
 * same supplier. Used by the admin "move up / move down" buttons.
 *
 * Body: { id: string, direction: "up" | "down" }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;

  const { slug: slugParam } = await params;
  const slug = decodeURIComponent(slugParam);
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: supplier } = await admin
    .from("suppliers")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const direction = body?.direction === "down" ? "down" : "up";
  if (!id) return NextResponse.json({ error: "Product id required" }, { status: 400 });

  // Pull the current ordered list so we can find the neighbour to swap with —
  // this keeps the operation correct even when sort_order ties exist (rows
  // imported before the column existed all default to 0).
  const { data: rows, error: listErr } = await admin
    .from("supplier_products")
    .select("id, sort_order")
    .eq("supplier_id", supplier.id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const list = rows ?? [];
  const idx = list.findIndex((r) => String(r.id) === id);
  if (idx < 0) return NextResponse.json({ error: "Product not in this supplier" }, { status: 404 });
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) {
    return NextResponse.json({ ok: true, noop: true });
  }

  // Renumber every row sequentially first so any pre-existing 0-tied rows get
  // unique values, then swap the two affected rows in the new sequence.
  const reordered = list.map((r) => ({ ...r }));
  const a = reordered[idx];
  reordered[idx] = reordered[swapIdx];
  reordered[swapIdx] = a;

  const updates = reordered.map((r, i) =>
    admin
      .from("supplier_products")
      .update({ sort_order: i })
      .eq("id", r.id)
      .eq("supplier_id", supplier.id),
  );
  const results = await Promise.all(updates);
  const firstErr = results.find((r) => r.error)?.error;
  if (firstErr) {
    return NextResponse.json({ error: firstErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Product id required" }, { status: 400 });

  const { error } = await admin.from("supplier_products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
