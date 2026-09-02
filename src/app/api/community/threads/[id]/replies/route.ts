import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, requireAuth } from "@/lib/supabase-server";
import {
  clampText,
  communityNotReady,
  isCommunityUnavailableError,
} from "@/lib/community-server";
import { COMMUNITY_REPLY_MAX } from "@/lib/community";

const REPLY_LIMIT = 200;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json([]);

  // Newest reply first, matching the order the thread page renders them in.
  const { data, error } = await supabase
    .from("community_replies")
    .select("*")
    .eq("thread_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(REPLY_LIMIT);

  if (error) {
    if (isCommunityUnavailableError(error)) return communityNotReady();
    return NextResponse.json([]);
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const content = clampText(body?.content, COMMUNITY_REPLY_MAX);
  if (!content) return NextResponse.json({ error: "Reply is required" }, { status: 400 });

  const { data: thread, error: threadError } = await supabase
    .from("community_threads")
    .select("id, locked, status")
    .eq("id", id)
    .single();
  if (threadError && isCommunityUnavailableError(threadError)) return communityNotReady();
  if (!thread || thread.status !== "active") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (thread.locked) {
    return NextResponse.json({ error: "This thread is locked", code: "THREAD_LOCKED" }, { status: 403 });
  }

  // Author identity always comes from the verified token, never the body.
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, username, avatar_url")
    .eq("id", auth.userId)
    .single();

  const row = {
    thread_id: id,
    content,
    author_id: auth.userId,
    author_name: profile?.name || profile?.username || "Member",
    author_avatar: profile?.avatar_url || "",
    status: "active" as const,
  };

  const { data, error } = await supabase.from("community_replies").insert(row).select("*").single();
  if (error) {
    if (isCommunityUnavailableError(error)) return communityNotReady();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
