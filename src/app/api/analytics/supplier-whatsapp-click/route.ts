import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/analytics/supplier-whatsapp-click
 * Body: { supplierId?: string, supplierSlug?: string }
 * Records one WhatsApp tap for that supplier profile.
 */
export async function POST(req: NextRequest) {
  let body: { supplierId?: string; supplierSlug?: string };
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  try {
    if (contentType.includes("application/json") || contentType.includes("text/plain")) {
      const text = await req.text();
      body = JSON.parse(text);
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await req.formData();
      body = {
        supplierId: typeof form.get("supplierId") === "string" ? (form.get("supplierId") as string) : undefined,
        supplierSlug: typeof form.get("supplierSlug") === "string" ? (form.get("supplierSlug") as string) : undefined,
      };
    } else {
      const text = await req.text();
      try {
        body = JSON.parse(text);
      } catch {
        const params = new URLSearchParams(text);
        const supplierId = params.get("supplierId");
        const supplierSlug = params.get("supplierSlug");
        if (!supplierId && !supplierSlug) throw new Error("Invalid request body");
        body = {
          supplierId: supplierId ?? undefined,
          supplierSlug: supplierSlug ?? undefined,
        };
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const supplierIdInput = typeof body.supplierId === "string" ? body.supplierId.trim() : "";
  const supplierSlug = typeof body.supplierSlug === "string" ? body.supplierSlug.trim() : "";
  const hasUuid = supplierIdInput && UUID_RE.test(supplierIdInput);
  if (!hasUuid && !supplierSlug) return NextResponse.json({ error: "Missing supplier identity" }, { status: 400 });

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  let supplierQuery = admin.from("suppliers").select("id").limit(1);
  supplierQuery = hasUuid ? supplierQuery.eq("id", supplierIdInput) : supplierQuery.eq("slug", supplierSlug);
  const { data: row, error: selErr } = await supplierQuery.maybeSingle();

  if (selErr || !row) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }
  const supplierId = String(row.id);

  const { error: logErr } = await admin.from("whatsapp_click_logs").insert({ supplier_id: supplierId });
  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

  // suppliers.whatsapp_clicks is incremented by DB trigger `whatsapp_click_logs_bump_whatsapp`
  // (SECURITY DEFINER). Count + UPDATE here required the service role: RLS only allows admins
  // to SELECT whatsapp_click_logs and UPDATE suppliers, so anon key could not refresh the counter.

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/analytics/supplier-whatsapp-click?months=6&supplierId=<uuid>
 * Monthly WhatsApp tap counts (site-wide or one supplier).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const months = parseInt(searchParams.get("months") ?? "6", 10);
  const supplierId = searchParams.get("supplierId");
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json([]);

  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  let query = admin
    .from("whatsapp_click_logs")
    .select("clicked_at")
    .gte("clicked_at", since.toISOString());

  if (supplierId && UUID_RE.test(supplierId)) query = query.eq("supplier_id", supplierId);

  const { data, error } = await query;
  if (error || !data) return NextResponse.json([]);

  const buckets: Record<string, number> = {};
  for (const row of data) {
    const key = (row.clicked_at as string).slice(0, 7);
    buckets[key] = (buckets[key] ?? 0) + 1;
  }

  const result: { month: string; clicks: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.push({ month: key, clicks: buckets[key] ?? 0 });
  }

  return NextResponse.json(result);
}
