"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChatMessage, BotAvatar, UserAvatar } from "./ChatMessage";
import { StarterPrompts } from "./StarterPrompts";
import type { ChatbotApiResponse } from "@/types/chatbot";

const SESSION_KEY = "fb-portal-chatbot-session";

type Msg = { id: string; role: "user" | "assistant"; content: string };

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `s-${Date.now()}`;
  }
}

export function ChatbotWidget() {
  const { t, lang } = useTranslation();
  const { profile } = useAuth();
  const c = t.chatbot;
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  const autoResizeInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 120);
    el.style.height = `${Math.max(next, 44)}px`;
  }, []);

  useEffect(() => {
    autoResizeInput();
  }, [input, autoResizeInput]);

  const sendText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loading) return;

      const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setLoading(true);

      let authHeader: Record<string, string> = {};
      try {
        const sb = getSupabase();
        if (sb) {
          const { data } = await sb.auth.getSession();
          const token = data.session?.access_token;
          if (token) authHeader = { Authorization: `Bearer ${token}` };
        }
      } catch {
        /* ignore */
      }

      try {
        const res = await fetch("/api/chatbot", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({
            message: text,
            sessionId: getOrCreateSessionId(),
            language: lang,
          }),
        });
        const data = (await res.json()) as ChatbotApiResponse & { error?: string };
        if (!res.ok) throw new Error(data.error || "request failed");
        const assistantMsg: Msg = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.answer,
        };
        setMessages((m) => [...m, assistantMsg]);
      } catch {
        setMessages((m) => [
          ...m,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: c.error,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, lang, c.error],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendText(input);
  };

  return (
    <>
      <div
        className={cn(
          "fixed z-[56] flex flex-col items-start gap-2 pointer-events-none",
          "left-[max(0.75rem,env(safe-area-inset-left))]",
          "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        {/* ── Chat panel ─────────────────────────────────────────────────────── */}
        <div
          id={panelId}
          role="dialog"
          aria-label={c.title}
          aria-hidden={!open}
          className={cn(
            "pointer-events-auto",
            "w-[calc(100vw-1.5rem)] sm:w-[36rem]",
            "origin-bottom-left transition-all duration-200 ease-out motion-reduce:transition-none",
            open
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-2 pointer-events-none h-0 overflow-hidden",
          )}
        >
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl shadow-black/20 max-h-[min(90dvh,52rem)]">

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary/8 to-primary/4 px-4 py-3 shrink-0">
              <BotAvatar />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold tracking-tight text-foreground">{c.title}</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-sm" />
                  <p className="text-xs text-muted-foreground leading-none">{c.subtitle}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
                aria-label={c.closeAssistant}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 min-h-[16rem] max-h-[min(62dvh,36rem)] basis-0 px-4 py-4">
              <div className="space-y-4 pr-1">
                {messages.length === 0 && !loading && (
                  <div className="flex items-end gap-2">
                    <BotAvatar />
                    <div className="max-w-[calc(100%-3rem)] w-fit rounded-2xl rounded-bl-sm bg-muted/90 border border-border/50 px-4 py-2.5 text-sm leading-relaxed text-muted-foreground shadow-sm">
                      {c.subtitle}
                    </div>
                  </div>
                )}

                {messages.map((m) => (
                  <ChatMessage
                    key={m.id}
                    role={m.role}
                    userAvatarUrl={profile?.avatar_url}
                    userName={profile?.name}
                  >
                    {m.content}
                  </ChatMessage>
                ))}

                {/* Typing indicator */}
                {loading && (
                  <div className="flex items-end gap-2">
                    <BotAvatar />
                    <div className="flex gap-1.5 items-center bg-muted/90 border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:160ms]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:320ms]" />
                    </div>
                  </div>
                )}

                <div ref={endRef} />
              </div>
            </ScrollArea>

            {/* Starter prompts + input */}
            <div className="border-t border-border px-3 pt-2.5 pb-3 space-y-2.5 bg-card shrink-0">
              <StarterPrompts
                prompts={messages.length === 0 && !loading ? c.starters : []}
                onSelect={(p) => void sendText(p)}
                disabled={loading}
              />

              <form onSubmit={onSubmit} className="flex gap-2 items-end">
                <UserAvatar
                  url={profile?.avatar_url}
                  name={profile?.name}
                  size="sm"
                />
                <label htmlFor="chatbot-input" className="sr-only">
                  {c.placeholder}
                </label>
                <textarea
                  ref={inputRef}
                  id="chatbot-input"
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendText(input);
                    }
                  }}
                  placeholder={c.placeholder}
                  disabled={loading}
                  className={cn(
                    "flex-1 min-h-[44px] max-h-[120px] resize-none overflow-y-auto rounded-xl border border-input bg-background px-3 py-2.5 text-sm",
                    "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                    "disabled:opacity-60",
                  )}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl"
                  disabled={loading || !input.trim()}
                  aria-label={c.send}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* ── Toggle button ───────────────────────────────────────────────────── */}
        <Button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "pointer-events-auto h-14 w-14 rounded-full shadow-lg",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "transition-transform duration-200 active:scale-95",
          )}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? c.closeAssistant : c.openAssistant}
        >
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </Button>
      </div>
    </>
  );
}
