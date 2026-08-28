import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
  requireAdmin,
  requireAuth,
} from "@/lib/supabase-server";
import {
  clampText,
  communityNotReady,
  escapeIlike,
  isCommunityUnavailableError,
} from "@/lib/community-server";
import {
  COMMUNITY_CONTENT_MAX,
  COMMUNITY_TITLE_MAX,
  isCommunityCategory,
  normaliseTags,
} from "@/lib/community";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const q = (searchParams.get("q") ?? "").trim();
  const sort = searchParams.get("sort") === "newest" ? "newest" : "activity";
  const includeHidden = searchParams.get("all") === "true";
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);

  // Hidden / removed threads are admin-only, so that path needs the
  // RLS-bypassing client behind an admin check.
  if (includeHidden) {
    const adminAuth = await requireAdmin(req);
    if (adminAuth instanceof NextResponse) return adminAuth;
  }
  const supabase = includeHidden ? createAdminSupabaseClient() : createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ threads: [], total: 0, hasMore: false });

  let query = supabase.from("community_threads").select("*", { count: "exact" });
  if (!includeHidden) query = query.eq("status", "active");
  if (isCommunityCategory(category)) query = query.eq("category", category);
  if (tag) query = query.contains("tags", [tag]);
  if (q) {
    const safe = escapeIlike(q);
    query = query.or(`title.ilike.%${safe}%,content.ilike.%${safe}%`);
  }

  // "activity" keeps pinned threads on top, then the thread with the newest
  // reply — the ordering this forum is designed around.
  const activityColumn = sort === "activity" ? "last_reply_at" : "created_at";
  query = query
    .order("pinned", { ascending: false })
    .order(activityColumn, { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    if (isCommunityUnavailableError(error)) return communityNotReady();
    return NextResponse.json({ threads: [], total: 0, hasMore: false });
  }

  const total = count ?? data?.length ?? 0;
  return NextResponse.json({
    threads: data ?? [],
    total,
    hasMore: offset + (data?.length ?? 0) < total,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));

  const title = clampText(body?.title, COMMUNITY_TITLE_MAX);
  const content = clampText(body?.content, COMMUNITY_CONTENT_MAX);
  const category = isCommunityCategory(body?.category) ? body.category : "general";
  const tags = normaliseTags(body?.tags);

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });

  // Author identity always comes from the verified token, never the body.
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, username, avatar_url")
    .eq("id", auth.userId)
    .single();

  const row = {
    title,
    content,
    category,
    tags,
    author_id: auth.userId,
    author_name: profile?.name || profile?.username || "Member",
    author_avatar: profile?.avatar_url || "",
    status: "active" as const,
  };

  const { data, error } = await supabase.from("community_threads").insert(row).select("*").single();
  if (error) {
    if (isCommunityUnavailableError(error)) return communityNotReady();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
