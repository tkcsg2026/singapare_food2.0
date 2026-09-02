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
import {
  COMMUNITY_CONTENT_MAX,
  COMMUNITY_TITLE_MAX,
  isCommunityCategory,
  normaliseTags,
} from "@/lib/community";

const REPLY_LIMIT = 200;

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track") === "1";

  // Admin client so a hidden thread stays readable by its author / an admin;
  // visibility is enforced explicitly below.
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: thread, error } = await supabase
    .from("community_threads")
    .select("*")
    .eq("id", id)
    .single();

  if (error && isCommunityUnavailableError(error)) return communityNotReady();
  if (error || !thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (thread.status !== "active") {
    const { userId, isAdmin } = await resolveCaller(req);
    const isOwner = thread.author_id && thread.author_id === userId;
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // Newest reply first — the thread page shows the most recent answers at the
  // top so readers do not have to scroll to the bottom of a long thread.
  const { data: replies } = await supabase
    .from("community_replies")
    .select("*")
    .eq("thread_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(REPLY_LIMIT);

  if (track) {
    // Best-effort counter; a failure must never break rendering the thread.
    try {
      await supabase.rpc("increment_community_thread_views", { thread: id });
    } catch {
      // RPC may not exist yet on an un-migrated database
    }
  }

  return NextResponse.json({ thread, replies: replies ?? [] });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { userId, isAdmin } = await resolveCaller(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing, error: readError } = await supabase
    .from("community_threads")
    .select("id, author_id, title")
    .eq("id", id)
    .single();
  if (readError && isCommunityUnavailableError(readError)) return communityNotReady();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = existing.author_id && existing.author_id === userId;
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (typeof body?.title !== "undefined") {
    const title = clampText(body.title, COMMUNITY_TITLE_MAX);
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    patch.title = title;
  }
  if (typeof body?.content !== "undefined") {
    const content = clampText(body.content, COMMUNITY_CONTENT_MAX);
    if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });
    patch.content = content;
  }
  if (typeof body?.category !== "undefined" && isCommunityCategory(body.category)) {
    patch.category = body.category;
  }
  if (typeof body?.tags !== "undefined") {
    patch.tags = normaliseTags(body.tags);
  }

  // Moderation fields are admin-only.
  if (isAdmin) {
    if (typeof body?.pinned === "boolean") patch.pinned = body.pinned;
    if (typeof body?.locked === "boolean") patch.locked = body.locked;
    if (["active", "hidden"].includes(body?.status)) patch.status = body.status;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields in request" }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("community_threads")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    if (isCommunityUnavailableError(error)) return communityNotReady();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (isAdmin && !isOwner) {
    await logAuditAction({
      adminId: userId,
      action: "moderate_community_thread",
      targetType: "community_thread",
      targetId: id,
      detail: String(data?.title ?? existing.title ?? ""),
    });
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
    .from("community_threads")
    .select("id, author_id, title")
    .eq("id", id)
    .single();
  if (readError && isCommunityUnavailableError(readError)) return communityNotReady();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = existing.author_id && existing.author_id === userId;
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Replies are removed by the thread_id foreign key's ON DELETE CASCADE.
  const { error } = await supabase.from("community_threads").delete().eq("id", id);
  if (error) {
    if (isCommunityUnavailableError(error)) return communityNotReady();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (isAdmin && !isOwner) {
    await logAuditAction({
      adminId: userId,
      action: "delete_community_thread",
      targetType: "community_thread",
      targetId: id,
      detail: String(existing.title ?? ""),
    });
  }

  return NextResponse.json({ success: true });
}
