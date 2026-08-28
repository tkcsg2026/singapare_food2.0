import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSupabaseClient,
  logAuditAction,
  requireAdmin,
  requireAuth,
} from "@/lib/supabase-server";
import {
  clampText,
  communityNotReady,
  isCommunityUnavailableError,
} from "@/lib/community-server";
import { COMMUNITY_REPLY_MAX } from "@/lib/community";

/** Resolves the caller once: `{ userId, isAdmin }`, or nulls for anonymous. */
async function resolveCaller(req: NextRequest): Promise<{ userId: string | null; isAdmin: boolean }> {
  const adminAuth = await requireAdmin(req);
  if (!(adminAuth instanceof NextResponse)) {
    return { userId: adminAuth.adminId, isAdmin: true };
  }
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return { userId: null, isAdmin: false };
  return { userId: auth.userId, isAdmin: false };
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { userId, isAdmin } = await resolveCaller(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing, error: readError } = await supabase
    .from("community_replies")
    .select("id, author_id")
    .eq("id", id)
    .single();
  if (readError && isCommunityUnavailableError(readError)) return communityNotReady();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = existing.author_id && existing.author_id === userId;
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const content = clampText(body?.content, COMMUNITY_REPLY_MAX);
  if (!content) return NextResponse.json({ error: "Reply is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("community_replies")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    if (isCommunityUnavailableError(error)) return communityNotReady();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { userId, isAdmin } = await resolveCaller(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing, error: readError } = await supabase
    .from("community_replies")
    .select("id, author_id, thread_id")
    .eq("id", id)
    .single();
  if (readError && isCommunityUnavailableError(readError)) return communityNotReady();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = existing.author_id && existing.author_id === userId;
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Hard delete; the AFTER DELETE trigger recomputes the thread's reply_count.
  const { error } = await supabase.from("community_replies").delete().eq("id", id);
  if (error) {
    if (isCommunityUnavailableError(error)) return communityNotReady();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (isAdmin && !isOwner) {
    await logAuditAction({
      adminId: userId,
      action: "delete_community_reply",
      targetType: "community_reply",
      targetId: id,
      detail: String(existing.thread_id ?? ""),
    });
  }

  return NextResponse.json({ success: true });
}
