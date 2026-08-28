"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Edit2, Eye, Lock, MessageSquare, Pin, Tag as TagIcon, Trash2, User,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useLoginPrompt } from "@/components/LoginPromptModal";
import { getSupabase } from "@/lib/supabase";
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_CONTENT_MAX,
  COMMUNITY_REPLY_MAX,
  COMMUNITY_TITLE_MAX,
  formatRelativeTime,
  normaliseTags,
  parseTagInput,
} from "@/lib/community";
import type { CommunityReplyRow, CommunityThreadRow } from "@/types/database";

/** Attaches the caller's Bearer token so the API can verify who is posting. */
async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const sb = getSupabase();
  const session = sb ? (await sb.auth.getSession()).data.session : null;
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

function AuthorAvatar({ src, name }: { src?: string | null; name: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-9 w-9 rounded-full object-cover border border-border flex-shrink-0"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
      <User className="h-4 w-4 text-primary" />
    </div>
  );
}

export default function CommunityThread() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const { t, lang } = useTranslation();
  const c = t.community;
  const { user, profile, loading: authLoading } = useAuth();
  const { requireLogin, loginPromptModal } = useLoginPrompt();
  const isAdmin = profile?.role === "admin";

  const [thread, setThread] = useState<CommunityThreadRow | null>(null);
  const [replies, setReplies] = useState<CommunityReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("general");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyText, setEditReplyText] = useState("");

  const load = useCallback(
    async (track: boolean) => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/community/threads/${encodeURIComponent(id)}${track ? "?track=1" : ""}`,
          { cache: "no-store", headers: await authHeaders() },
        );
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          if (payload?.code === "COMMUNITY_NOT_READY") setNotReady(true);
          setThread(null);
          setReplies([]);
          return;
        }
        setNotReady(false);
        setThread(payload?.thread ?? null);
        setReplies(Array.isArray(payload?.replies) ? payload.replies : []);
      } catch {
        setThread(null);
        setReplies([]);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  // Wait for auth to settle so the token is attached on the first load — that
  // is what lets an author open their own hidden thread.
  useEffect(() => {
    if (authLoading) return;
    load(true);
  }, [authLoading, load]);

  const isOwner = Boolean(user && thread?.author_id && thread.author_id === user.id);
  const canEditThread = isOwner || isAdmin;
  const canReply = Boolean(user) && !thread?.locked;

  const categoryLabel = useMemo(
    () => (thread ? c.categories[thread.category] ?? thread.category : ""),
    [thread, c.categories],
  );

  const startEdit = () => {
    if (!thread) return;
    setEditTitle(thread.title);
    setEditCategory(thread.category);
    setEditContent(thread.content);
    setEditTags((thread.tags ?? []).join(", "));
    setEditError(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!thread) return;
    if (!editTitle.trim() || !editContent.trim()) {
      setEditError(c.form.errorRequired);
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/community/threads/${encodeURIComponent(thread.id)}`, {
        method: "PUT",
        headers: await authHeaders(),
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          category: editCategory,
          tags: normaliseTags(parseTagInput(editTags)),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setEditError((err?.error as string) || c.form.errorFailed);
        return;
      }
      setEditing(false);
      await load(false);
    } catch {
      setEditError(c.form.errorFailed);
    } finally {
      setEditSaving(false);
    }
  };

  const submitReply = async () => {
    if (!thread) return;
    if (!user) {
      requireLogin();
      return;
    }
    if (!replyText.trim()) return;
    setReplyPosting(true);
    setReplyError(null);
    try {
      const res = await fetch(
        `/api/community/threads/${encodeURIComponent(thread.id)}/replies`,
        {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({ content: replyText }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setReplyError(
          err?.code === "COMMUNITY_NOT_READY" ? c.dbBanner : (err?.error as string) || c.thread.replyFailed,
        );
        return;
      }
      setReplyText("");
      await load(false);
    } catch {
      setReplyError(c.thread.replyFailed);
    } finally {
      setReplyPosting(false);
    }
  };

  const deleteThread = async () => {
    if (!thread) return;
    if (!window.confirm(c.thread.deleteConfirm)) return;
    try {
      const res = await fetch(`/api/community/threads/${encodeURIComponent(thread.id)}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      if (!res.ok) {
        window.alert(c.thread.deleteFailed);
        return;
      }
      window.location.href = "/community";
    } catch {
      window.alert(c.thread.deleteFailed);
    }
  };

  const deleteReply = async (replyId: string) => {
    if (!window.confirm(c.thread.deleteReplyConfirm)) return;
    try {
      const res = await fetch(`/api/community/replies/${encodeURIComponent(replyId)}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      if (!res.ok) {
        window.alert(c.thread.deleteFailed);
        return;
      }
      await load(false);
    } catch {
      window.alert(c.thread.deleteFailed);
    }
  };

  const saveReplyEdit = async (replyId: string) => {
    if (!editReplyText.trim()) return;
    try {
      const res = await fetch(`/api/community/replies/${encodeURIComponent(replyId)}`, {
        method: "PUT",
        headers: await authHeaders(),
        body: JSON.stringify({ content: editReplyText }),
      });
      if (!res.ok) {
        window.alert(c.form.errorFailed);
        return;
      }
      setEditingReplyId(null);
      setEditReplyText("");
      await load(false);
    } catch {
      window.alert(c.form.errorFailed);
    }
  };

  /** Admin moderation toggles (pin / lock / hide). */
  const moderate = async (patch: Record<string, unknown>) => {
    if (!thread) return;
    try {
      const res = await fetch(`/api/community/threads/${encodeURIComponent(thread.id)}`, {
        method: "PUT",
        headers: await authHeaders(),
        body: JSON.stringify(patch),
      });
      if (res.ok) await load(false);
    } catch {
      // Non-fatal — the thread simply stays as it was
    }
  };

  if (loading || authLoading) {
    return (
      <Layout>
        <div className="container py-16 text-center text-muted-foreground">{t.common.loading}</div>
      </Layout>
    );
  }

  if (!thread) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">{notReady ? c.dbBanner : c.thread.notFound}</p>
          <Link href="/community" className="text-primary hover:underline mt-4 inline-block">
            {c.thread.backToList}
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-4xl py-8 min-w-0">
        <Link
          href="/community"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> {c.thread.backToList}
        </Link>

        {thread.status !== "active" && (
          <div className="mb-6 px-4 py-3 border border-amber-200 bg-amber-50 text-amber-800 text-sm font-medium rounded-xl">
            {c.hidden}
          </div>
        )}

        {/* ── Thread ─────────────────────────────────────────────────────── */}
        <article className="rounded-2xl border border-border bg-card p-5 sm:p-7">
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">{c.form.fieldTitle}</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  maxLength={COMMUNITY_TITLE_MAX}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="min-h-[44px] rounded-xl bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">{c.form.fieldCategory}</Label>
                <select
                  id="edit-category"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full min-h-[44px] px-4 rounded-xl border bg-background text-sm"
                >
                  {COMMUNITY_CATEGORIES.map((key) => (
                    <option key={key} value={key}>
                      {c.categories[key] ?? key}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tags">{c.form.fieldTags}</Label>
                <Input
                  id="edit-tags"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder={c.form.fieldTagsPlaceholder}
                  className="min-h-[44px] rounded-xl bg-background"
                />
                <p className="text-[11px] text-muted-foreground">{c.form.fieldTagsHint}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-content">{c.form.fieldContent}</Label>
                <Textarea
                  id="edit-content"
                  value={editContent}
                  maxLength={COMMUNITY_CONTENT_MAX}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  className="rounded-xl bg-background resize-y min-h-[180px]"
                />
              </div>
              {editError && <p className="text-sm text-destructive font-medium">{editError}</p>}
              <div className="flex gap-3">
                <Button
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="rounded-xl font-bold min-h-[44px]"
                >
                  {editSaving ? c.form.saving : c.form.saveChanges}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditing(false)}
                  className="rounded-xl font-semibold min-h-[44px]"
                >
                  {c.form.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
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

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight break-words-safe">
                {thread.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 mt-3 pb-4 border-b border-border">
                <AuthorAvatar src={thread.author_avatar} name={thread.author_name} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{thread.author_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(thread.created_at, lang)}
                    {thread.updated_at && thread.updated_at !== thread.created_at
                      ? ` · ${c.thread.edited}`
                      : ""}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {thread.reply_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {thread.view_count}
                  </span>
                </div>
              </div>

              <p className="text-sm sm:text-[15px] text-foreground/90 leading-relaxed whitespace-pre-wrap break-words mt-4">
                {thread.content}
              </p>

              {thread.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {thread.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/community?tag=${encodeURIComponent(tag)}`}
                      className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border hover:text-foreground transition-colors"
                    >
                      <TagIcon className="h-2.5 w-2.5" />
                      {tag}
                    </Link>
                  ))}
                </div>
              )}

              {(canEditThread || isAdmin) && (
                <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-border">
                  {canEditThread && (
                    <button
                      type="button"
                      onClick={startEdit}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      {c.thread.edit}
                    </button>
                  )}
                  {canEditThread && (
                    <button
                      type="button"
                      onClick={deleteThread}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {c.thread.delete}
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => moderate({ pinned: !thread.pinned })}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pin className="h-3.5 w-3.5" />
                        {thread.pinned ? c.admin.unpin : c.admin.pin}
                      </button>
                      <button
                        type="button"
                        onClick={() => moderate({ locked: !thread.locked })}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        {thread.locked ? c.admin.unlock : c.admin.lock}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          moderate({ status: thread.status === "active" ? "hidden" : "active" })
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {thread.status === "active" ? c.admin.hide : c.admin.unhide}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </article>

        {/* ── Replies ────────────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="text-lg font-black tracking-tight mb-4">
            {c.thread.repliesTitle}
            <span className="ml-2 text-sm font-semibold text-muted-foreground">
              {thread.reply_count}
            </span>
          </h2>

          {replies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-10 text-center text-sm text-muted-foreground">
              {c.thread.noReplies}
            </div>
          ) : (
            <div className="space-y-3">
              {replies.map((reply) => {
                const replyOwner = Boolean(user && reply.author_id && reply.author_id === user.id);
                const canManage = replyOwner || isAdmin;
                return (
                  <div key={reply.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <AuthorAvatar src={reply.author_avatar} name={reply.author_name} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{reply.author_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatRelativeTime(reply.created_at, lang)}
                          {reply.updated_at && reply.updated_at !== reply.created_at
                            ? ` · ${c.thread.edited}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    {editingReplyId === reply.id ? (
                      <div className="mt-3 space-y-3">
                        <Textarea
                          value={editReplyText}
                          maxLength={COMMUNITY_REPLY_MAX}
                          onChange={(e) => setEditReplyText(e.target.value)}
                          rows={4}
                          className="rounded-xl bg-background resize-y"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveReplyEdit(reply.id)}
                            className="rounded-xl font-bold"
                          >
                            {c.form.saveChanges}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingReplyId(null);
                              setEditReplyText("");
                            }}
                            className="rounded-xl font-semibold"
                          >
                            {c.form.cancel}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words mt-3">
                        {reply.content}
                      </p>
                    )}

                    {canManage && editingReplyId !== reply.id && (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {replyOwner && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingReplyId(reply.id);
                              setEditReplyText(reply.content);
                            }}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            <Edit2 className="h-3 w-3" />
                            {c.thread.edit}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteReply(reply.id)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          {c.thread.delete}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Reply box ───────────────────────────────────────────────── */}
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            {thread.locked ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 flex-shrink-0" />
                {c.thread.lockedNote}
              </p>
            ) : !user ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">{c.thread.loginToReply}</p>
                <Button
                  onClick={() => requireLogin()}
                  className="rounded-xl font-bold min-h-[44px]"
                >
                  {t.nav.login}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Label htmlFor="reply-box" className="font-bold">
                  {c.thread.replyTitle}
                </Label>
                <Textarea
                  id="reply-box"
                  value={replyText}
                  maxLength={COMMUNITY_REPLY_MAX}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={c.thread.replyPlaceholder}
                  rows={5}
                  className="rounded-xl bg-background resize-y min-h-[120px]"
                />
                {replyError && <p className="text-sm text-destructive font-medium">{replyError}</p>}
                <Button
                  onClick={submitReply}
                  disabled={!canReply || replyPosting || !replyText.trim()}
                  className="rounded-xl font-bold min-h-[44px]"
                >
                  {replyPosting ? c.thread.replySubmitting : c.thread.replySubmit}
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>

      {loginPromptModal}
    </Layout>
  );
}
