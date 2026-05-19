import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient, requireAdmin } from "@/lib/supabase-server";
import { sendReportNotification } from "@/lib/email";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const itemType = searchParams.get("item_type");
  const itemId = searchParams.get("item_id");
  const reporterId = searchParams.get("reporter_id");

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  // Logged-in user checking whether they already reported an item (MarketplaceItem)
  if (itemType && itemId && reporterId) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const server = createServerSupabaseClient();
    if (!token || !server) {
      return NextResponse.json([]);
    }
    const {
      data: { user },
    } = await server.auth.getUser(token);
    if (!user || user.id !== reporterId) {
      return NextResponse.json([]);
    }
    const { data, error } = await admin
      .from("reports")
      .select("id,status,created_at")
      .eq("item_type", itemType)
      .eq("item_id", itemId)
      .eq("reporter_id", reporterId);
    if (error) return NextResponse.json([]);
    return NextResponse.json(data ?? []);
  }

  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let query = admin.from("reports").select("*").order("created_at", { ascending: false });
  if (itemType) query = query.eq("item_type", itemType);
  if (itemId) query = query.eq("item_id", itemId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();
  const { data, error } = await supabase.from("reports").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await sendReportNotification({
      itemId: String(body.item_id || "unknown"),
      reason: body.reason || "",
    });
  } catch {}

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();
  const { id, status } = body;
  const { data, error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
