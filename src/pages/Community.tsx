"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, MessageSquare, MessagesSquare, Pin, Plus, RefreshCw,
  Search, Tag as TagIcon, Lock, Eye, X,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useLoginPrompt } from "@/components/LoginPromptModal";
import { getSupabase } from "@/lib/supabase";
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_CONTENT_MAX,
  COMMUNITY_MAX_TAGS,
  COMMUNITY_SUGGESTED_TAGS,
  COMMUNITY_TITLE_MAX,
  formatRelativeTime,
  normaliseTags,
  parseTagInput,
} from "@/lib/community";
import type { CommunityThreadRow } from "@/types/database";

const HERO_IMAGE = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&q=80";
const PAGE_SIZE = 20;
const EXCERPT_CHARS = 180;

type SortOption = "activity" | "newest";

/** Attaches the caller's Bearer token so the API can verify who is posting. */
async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const sb = getSupabase();
  const session = sb ? (await sb.auth.getSession()).data.session : null;
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_CHARS ? `${flat.slice(0, EXCERPT_CHARS)}…` : flat;
}

// ── Thread row ────────────────────────────────────────────────────────────────
function ThreadRow({ thread }: { thread: CommunityThreadRow }) {
  const { t, lang } = useTranslation();
  const c = t.community;
  const categoryLabel = c.categories[thread.category] ?? thread.category;

  return (
    <Link
      href={`/community/${thread.id}`}
      className="group block rounded-2xl border border-border bg-card p-4 sm:p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
        <div className="hidden sm:flex flex-col items-center justify-center w-14 flex-shrink-0 rounded-xl border border-border bg-muted/40 py-2">
          <span className="text-lg font-black leading-none text-primary">{thread.reply_count}</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            {thread.reply_count === 1 ? "reply" : "replies"}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {thread.pinned && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/25">
                <Pin className="h-2.5 w-2.5" />
                {c.pinned}
              </span>
            )}
            {thread.locked && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                <Lock className="h-2.5 w-2.5" />
                {c.locked}
              </span>
            )}
            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/15">
              {categoryLabel}
            </span>
          </div>

          <h3 className="font-bold text-[15px] sm:text-base leading-snug break-words-safe group-hover:text-primary transition-colors">
            {thread.title}
          </h3>

          {thread.content && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed break-words-safe">
              {excerpt(thread.content)}
            </p>
          )}

          {thread.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {thread.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
                >
                  <TagIcon className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">{thread.author_name}</span>
            <span className="flex items-center gap-1 sm:hidden">
              <MessageSquare className="h-3 w-3" />
              {thread.reply_count}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {thread.view_count}
            </span>
            <span>{formatRelativeTime(thread.last_reply_at || thread.created_at, lang)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── New thread form ───────────────────────────────────────────────────────────
function NewThreadForm({
  onSuccess,
  onClose,
}: {
  onSuccess: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = t.community;

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !posting;

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.some((existing) => existing.toLowerCase() === tag.toLowerCase())
        ? prev.filter((existing) => existing.toLowerCase() !== tag.toLowerCase())
        : normaliseTags([...prev, tag]),
    );
  };

  const commitTagInput = () => {
    const parsed = parseTagInput(tagInput);
    if (parsed.length === 0) return;
    setTags((prev) => normaliseTags([...prev, ...parsed]));
    setTagInput("");
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError(c.form.errorRequired);
      return;
    }
    setPosting(true);
    setError(null);
    try {
      // Fold any tag still sitting in the input into the payload
      const finalTags = normaliseTags([...tags, ...parseTagInput(tagInput)]);
      const res = await fetch("/api/community/threads", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ title, content, category, tags: finalTags }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(
          err?.code === "COMMUNITY_NOT_READY"
            ? c.dbBanner
            : (err?.error as string) || c.form.errorFailed,
        );
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError(c.form.errorFailed);
    } finally {
      setPosting(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
      <CardHeader className="border-b border-border bg-muted/30 pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl font-black tracking-tight">{c.form.title}</CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label={c.form.cancel}
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-5 sm:p-7 space-y-5 pt-6">
        <div className="space-y-2">
          <Label htmlFor="thread-title">{c.form.fieldTitle}</Label>
          <Input
            id="thread-title"
            value={title}
            maxLength={COMMUNITY_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={c.form.fieldTitlePlaceholder}
            className="min-h-[44px] rounded-xl bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="thread-category">{c.form.fieldCategory}</Label>
          <select
            id="thread-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full min-h-[44px] px-4 rounded-xl border bg-background text-sm"
          >
            {COMMUNITY_CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {c.categories[key] ?? key}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">{c.categoryHints[category] ?? ""}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="thread-tags">{c.form.fieldTags}</Label>
          <Input
            id="thread-tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onBlur={commitTagInput}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commitTagInput();
              }
            }}
            placeholder={c.form.fieldTagsPlaceholder}
            className="min-h-[44px] rounded-xl bg-background"
          />
          <p className="text-[11px] text-muted-foreground">{c.form.fieldTagsHint}</p>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium"
                >
                  {tag}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          <div className="pt-1">
            <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">{c.suggestedTags}</p>
            <div className="flex flex-wrap gap-1.5">
              {COMMUNITY_SUGGESTED_TAGS.map((tag) => {
                const active = tags.some((existing) => existing.toLowerCase() === tag.toLowerCase());
                const full = tags.length >= COMMUNITY_MAX_TAGS && !active;
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={full}
                    onClick={() => toggleTag(tag)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors disabled:opacity-40 ${
                      active
                        ? "bg-primary/10 text-primary border-primary/20 font-medium"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="thread-content">{c.form.fieldContent}</Label>
          <Textarea
            id="thread-content"
            value={content}
            maxLength={COMMUNITY_CONTENT_MAX}
            onChange={(e) => setContent(e.target.value)}
            placeholder={c.form.fieldContentPlaceholder}
            rows={8}
            className="rounded-xl bg-background resize-y min-h-[180px]"
          />
        </div>

        <p className="text-[11px] text-muted-foreground border-l-4 border-primary/30 pl-3 leading-relaxed">
          {c.guidelines}
        </p>

        {error && <div className="text-sm text-destructive font-medium">{error}</div>}

        <div className="flex gap-3">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 rounded-xl min-h-[44px] font-bold"
          >
            {posting ? c.form.submitting : c.form.submit}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl min-h-[44px] font-semibold"
          >
            {c.form.cancel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Community() {
  const { t } = useTranslation();
  const c = t.community;
  const { user } = useAuth();
  const { requireLogin, loginPromptModal } = useLoginPrompt();

  const [threads, setThreads] = useState<CommunityThreadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  /** false = API reports the tables are missing; true = OK; null = not checked */
  const [dbReady, setDbReady] = useState<boolean | null>(null);

  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<SortOption>("activity");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  // Deep links like /community?tag=Cafe (used by the tag chips on a thread
  // page). Read from location rather than useSearchParams so this client page
  // needs no Suspense boundary.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const initialTag = search.get("tag");
    const initialCategory = search.get("category");
    const initialQuery = search.get("q");
    if (initialTag) setTag(initialTag);
    if (initialCategory && (COMMUNITY_CATEGORIES as readonly string[]).includes(initialCategory)) {
      setCategory(initialCategory);
    }
    if (initialQuery) {
      setQueryInput(initialQuery);
      setQuery(initialQuery);
    }
  }, []);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  // Resetting the page in the same update keeps it to one request.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setQuery(queryInput.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(id);
  }, [queryInput]);

  // Every filter restarts pagination from the first page, so the page reset and
  // the filter change land in one render (and therefore one fetch).
  const applyCategory = (value: string) => {
    setCategory(value);
    setPage(0);
  };
  const applyTag = (value: string) => {
    setTag(value);
    setPage(0);
  };
  const applySort = (value: SortOption) => {
    setSort(value);
    setPage(0);
  };

  const fetchThreads = useCallback(
    async (targetPage: number, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(targetPage * PAGE_SIZE),
          sort,
        });
        if (category) params.set("category", category);
        if (tag) params.set("tag", tag);
        if (query) params.set("q", query);

        const res = await fetch(`/api/community/threads?${params.toString()}`, { cache: "no-store" });
        const payload = await res.json().catch(() => null);

        if (!res.ok) {
          if (payload?.code === "COMMUNITY_NOT_READY") {
            setDbReady(false);
            setThreads([]);
            setTotal(0);
            setHasMore(false);
          }
          return;
        }
        setDbReady(true);
        const rows: CommunityThreadRow[] = Array.isArray(payload?.threads) ? payload.threads : [];
        setThreads((prev) => (append ? [...prev, ...rows] : rows));
        setTotal(Number(payload?.total ?? rows.length));
        setHasMore(Boolean(payload?.hasMore));
      } catch {
        if (!append) {
          setThreads([]);
          setTotal(0);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [category, tag, sort, query],
  );

  useEffect(() => {
    fetchThreads(page, page > 0);
  }, [fetchThreads, page]);

  useEffect(() => {
    if (!postSuccess) return;
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setPostSuccess(false);
      toastTimerRef.current = null;
    }, 6000);
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [postSuccess]);

  // Close the form if the session ends while it is open
  useEffect(() => {
    if (!user && showForm) setShowForm(false);
  }, [user, showForm]);

  const openForm = () => {
    if (!user) {
      requireLogin();
      return;
    }
    setShowForm(true);
  };

  const activeTags = useMemo(() => {
    const seen = new Map<string, number>();
    for (const thread of threads) {
      for (const entry of thread.tags ?? []) {
        seen.set(entry, (seen.get(entry) ?? 0) + 1);
      }
    }
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([value]) => value);
  }, [threads]);

  const hasFilters = Boolean(category || tag || query);

  return (
    <Layout>
      {postSuccess && (
        <div className="fixed top-4 left-1/2 z-50 w-[min(92vw,760px)] -translate-x-1/2">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-medium shadow-lg">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>{c.form.successMsg}</span>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
        <div className="relative container max-w-6xl py-10 md:py-14 text-white min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/85 hover:text-white mb-6 font-medium"
          >
            <ArrowLeft className="h-4 w-4 flex-shrink-0" />
            <span className="min-w-0">{t.contact.backHome}</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm border border-white/20 mb-3">
            <MessagesSquare className="h-3.5 w-3.5" />
            {c.badge}
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight max-w-3xl drop-shadow-sm">
            {c.pageTitle}
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/90 max-w-2xl leading-relaxed">
            {c.pageSubtitle}
          </p>
        </div>
      </section>

      {/* Post bar */}
      <div className="border-b border-border bg-muted/30">
        <div className="container max-w-6xl py-4 flex flex-wrap items-center gap-3">
          <Button onClick={openForm} className="rounded-xl gap-2 font-bold min-h-[44px]">
            <Plus className="h-4 w-4" />
            {c.newThread}
          </Button>
          {!user && (
            <p className="text-sm text-muted-foreground leading-relaxed">{c.loginToPost}</p>
          )}
        </div>
      </div>

      {/* Category tabs — same underline pattern as Jobs / Shop / Takeover */}
      <div className="border-b border-border">
        <div className="container max-w-6xl min-w-0">
          <div
            role="tablist"
            aria-orientation="horizontal"
            className="flex w-full min-w-0 items-stretch gap-1 sm:gap-2 pb-1.5 scrollbar-x"
          >
            <button
              type="button"
              role="tab"
              aria-selected={category === ""}
              onClick={() => applyCategory("")}
              className={`flex-shrink-0 px-3 sm:px-4 py-2.5 text-sm font-bold border-b-2 transition-colors whitespace-nowrap -mb-px min-h-[44px] ${
                category === ""
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.allCategories}
            </button>
            {COMMUNITY_CATEGORIES.map((key) => {
              const active = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={c.categoryHints[key] ?? ""}
                  onClick={() => applyCategory(key)}
                  className={`flex-shrink-0 px-3 sm:px-4 py-2.5 text-sm font-bold border-b-2 transition-colors whitespace-nowrap -mb-px min-h-[44px] ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.categories[key] ?? key}
                </button>
              );
            })}
          </div>
          {category && (
            <p className="text-[11px] text-muted-foreground pb-3">{c.categoryHints[category] ?? ""}</p>
          )}
        </div>
      </div>

      {/* Form modal */}
      <Dialog open={showForm} onOpenChange={(open) => !open && setShowForm(false)}>
        <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-0 rounded-2xl [&>button:last-child]:hidden">
          <DialogTitle className="sr-only">{c.form.title}</DialogTitle>
          <DialogDescription className="sr-only">{c.form.fieldContentPlaceholder}</DialogDescription>
          <NewThreadForm
            onSuccess={() => {
              setPostSuccess(true);
              setPage(0);
              fetchThreads(0, false);
            }}
            onClose={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Threads */}
      <section className="container max-w-6xl py-8 md:py-12 min-w-0 w-full">
        {dbReady === false && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            <p className="font-semibold leading-snug">{c.dbBanner}</p>
          </div>
        )}

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder={c.searchPlaceholder}
              className="w-full h-12 pl-10 pr-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ui-filter-control"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => applySort(e.target.value as SortOption)}
            aria-label={c.sortLabel}
            className="h-12 px-4 rounded-xl border bg-background text-sm ui-filter-control"
          >
            <option value="activity">{c.sortActivity}</option>
            <option value="newest">{c.sortNewest}</option>
          </select>
          <button
            type="button"
            onClick={() => fetchThreads(page, false)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 h-12 px-4 rounded-xl border bg-background text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? t.common.loading : t.common.search}
          </button>
        </div>

        {/* Tag filters */}
        {(activeTags.length > 0 || tag) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1">
              {c.filterByTag}:
            </span>
            {tag && !activeTags.includes(tag) && (
              <button
                type="button"
                onClick={() => applyTag("")}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium"
              >
                {tag}
                <X className="h-3 w-3" />
              </button>
            )}
            {activeTags.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => applyTag(tag === entry ? "" : entry)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  tag === entry
                    ? "bg-primary/10 text-primary border-primary/20 font-medium"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {entry}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-sm text-muted-foreground font-medium">{c.threadCount(total)}</p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setCategory("");
                setTag("");
                setQueryInput("");
                setQuery("");
                setPage(0);
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              {c.clearFilters}
            </button>
          )}
        </div>

        {loading && threads.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse space-y-3">
                <div className="h-3 bg-muted rounded w-24" />
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-2.5 bg-muted rounded w-full" />
                <div className="h-2.5 bg-muted rounded w-4/5" />
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-16 text-center">
            <MessagesSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground font-medium">
              {hasFilters ? c.noResults : c.noThreads}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {threads.map((thread) => (
                <ThreadRow key={thread.id} thread={thread} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                  className="rounded-xl font-semibold min-h-[44px]"
                >
                  {loading ? t.common.loading : c.loadMore}
                </Button>
              </div>
            )}
          </>
        )}

        <p className="mt-8 text-[11px] text-muted-foreground border-l-4 border-primary/30 pl-3 leading-relaxed">
          {c.guidelines}
        </p>
      </section>

      {loginPromptModal}
    </Layout>
  );
}
