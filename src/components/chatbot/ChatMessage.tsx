"use client";

import type { ReactNode } from "react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

function renderWithBold(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest.length > 0) {
    const open = rest.indexOf("**");
    if (open === -1) {
      out.push(<span key={`${keyPrefix}-${i++}`}>{rest}</span>);
      break;
    }
    if (open > 0) {
      out.push(<span key={`${keyPrefix}-${i++}`}>{rest.slice(0, open)}</span>);
    }
    const close = rest.indexOf("**", open + 2);
    if (close === -1) {
      out.push(<span key={`${keyPrefix}-${i++}`}>{rest.slice(open)}</span>);
      break;
    }
    out.push(
      <strong key={`${keyPrefix}-${i++}`} className="font-semibold">
        {rest.slice(open + 2, close)}
      </strong>,
    );
    rest = rest.slice(close + 2);
  }
  return out;
}

export function BotAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-full bg-primary flex items-center justify-center shadow-md ring-2 ring-primary/25",
        size === "sm" ? "h-6 w-6" : "h-8 w-8",
      )}
    >
      <Bot
        className={cn(
          "text-primary-foreground",
          size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
        )}
      />
    </div>
  );
}

export function UserAvatar({
  url,
  name,
  size = "md",
}: {
  url?: string | null;
  name?: string | null;
  size?: "sm" | "md";
}) {
  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const dim = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const txt = size === "sm" ? "text-[9px]" : "text-[11px]";

  if (url) {
    return (
      <div
        className={cn(
          "shrink-0 rounded-full overflow-hidden shadow-md ring-2 ring-border/50",
          dim,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name ?? "User"} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "shrink-0 rounded-full bg-secondary border border-border/60 flex items-center justify-center shadow-md",
        dim,
      )}
    >
      <span className={cn("font-semibold text-secondary-foreground leading-none", txt)}>
        {initials}
      </span>
    </div>
  );
}

export function ChatMessage({
  role,
  children,
  className,
  userAvatarUrl,
  userName,
}: {
  role: "user" | "assistant";
  children: string;
  className?: string;
  userAvatarUrl?: string | null;
  userName?: string | null;
}) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex w-full gap-2 items-end",
        isUser ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      {isUser ? (
        <UserAvatar url={userAvatarUrl} name={userName} />
      ) : (
        <BotAvatar />
      )}

      <div
        className={cn(
          "max-w-[calc(100%-3rem)] w-fit rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted/90 text-foreground border border-border/50 rounded-bl-sm",
        )}
      >
        <div className="whitespace-pre-wrap break-words">{renderWithBold(children, role)}</div>
      </div>
    </div>
  );
}
