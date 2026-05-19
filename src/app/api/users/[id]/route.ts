import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSupabaseClient,
  requireAdmin,
  logAuditAction,
} from "@/lib/supabase-server";
import { sendAdminActionEmail } from "@/lib/email";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** GET /api/users/[id] — Fetch a single user (admin only). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, email, name, username, avatar_url, role, whatsapp, company, created_at, banned")
    .eq("id", id)
    .single();

  if (error || !profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: rep } = await admin
    .from("supplier_representatives")
    .select("supplier_id")
    .eq("user_id", id)
    .maybeSingle();

  return NextResponse.json({
    ...profile,
    supplier_representatives: rep?.supplier_id ? { supplier_id: rep.supplier_id } : null,
  });
}

/** PUT /api/users/[id] — Update a user (admin only). */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = await req.json();

  if (body.linkedSupplierId !== undefined) {
    const v = body.linkedSupplierId;
    if (v === null || v === "") {
      await admin.from("supplier_representatives").delete().eq("user_id", id);
    } else if (typeof v === "string" && UUID_RE.test(v.trim())) {
      const sid = v.trim();
      const { data: sup } = await admin.from("suppliers").select("id").eq("id", sid).maybeSingle();
      if (!sup) return NextResponse.json({ error: "Invalid supplier" }, { status: 400 });
      const { error: repErr } = await admin
        .from("supplier_representatives")
        .upsert({ user_id: id, supplier_id: sid }, { onConflict: "user_id" });
      if (repErr) return NextResponse.json({ error: repErr.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "Invalid linkedSupplierId" }, { status: 400 });
    }
  }

  const allowed = ["name", "username", "email", "whatsapp", "company", "role", "banned", "avatar_url"];
  const payload: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) payload[k] = body[k];
  }

  if (typeof body.email === "string" && body.email.trim()) {
    await admin.auth.admin.updateUserById(id, { email: body.email.trim() });
  }

  if (Object.keys(payload).length > 0) {
    const { error: upErr } = await admin.from("profiles").update(payload).eq("id", id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, email, name, username, avatar_url, role, whatsapp, company, created_at, banned")
    .eq("id", id)
    .single();

  if (error || !profile) return NextResponse.json({ error: error?.message ?? "User not found" }, { status: 500 });

  const { data: repRow } = await admin
    .from("supplier_representatives")
    .select("supplier_id")
    .eq("user_id", id)
    .maybeSingle();

  const data = {
    ...profile,
    supplier_representatives: repRow?.supplier_id ? { supplier_id: repRow.supplier_id } : null,
  };

  // Determine audit action label
  let action = "update_user";
  if (payload.banned === true)  action = "ban_user";
  if (payload.banned === false) action = "unban_user";

  const extra = body.linkedSupplierId !== undefined ? ", linkedSupplierId" : "";
  const changedFields = Object.keys(payload).join(", ") + extra;
  const nameEmail = (data as any).name
    ? `${(data as any).name}${(data as any).email ? ` (${(data as any).email})` : ""}`
    : id;
  await logAuditAction({
    adminId: auth.adminId,
    action,
    targetType: "user",
    targetId: id,
    detail: action === "ban_user" || action === "unban_user"
      ? nameEmail
      : `${nameEmail} — fields: ${changedFields || "(link only)"}`,
  });

  if ((action === "ban_user" || action === "unban_user") && (data as any).email) {
    await sendAdminActionEmail({
      action: action === "ban_user" ? "ban" : "unban",
      userName: (data as any).name || "User",
      userEmail: (data as any).email,
    });
  }

  return NextResponse.json(data);
}

/** DELETE /api/users/[id] — Permanently delete a user (admin only). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  // Fetch name/email before deletion for the audit record
  const { data: target } = await admin
    .from("profiles")
    .select("name, email")
    .eq("id", id)
    .single();

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAuditAction({
    adminId: auth.adminId,
    action: "delete_user",
    targetType: "user",
    targetId: id,
    detail: target ? `${target.name} (${target.email})` : id,
  });

  if (target?.email) {
    await sendAdminActionEmail({
      action: "delete",
      userName: target.name || "User",
      userEmail: target.email,
    });
  }

  return NextResponse.json({ success: true });
}
