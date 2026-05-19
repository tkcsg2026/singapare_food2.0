"use client";

import { useEffect, useState } from "react";
import { Instagram } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

function isHttpUrl(s: string | undefined): s is string {
  if (!s?.trim()) return false;
  try {
    const u = new URL(s.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** When configured URL is unset, build from a brand handle (no @). */
function defaultInstagramUrl(handle: string) {
  const h = handle.replace(/^@/, "").trim();
  if (!h) return undefined as string | undefined;
  return `https://www.instagram.com/${encodeURIComponent(h)}/`;
}

const iconBtn =
  "inline-flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground transition-colors duration-200";

export function FooterSocialLinks({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [instagramUrl, setInstagramUrl] = useState<string | undefined>(undefined);

  const brandHandle =
    process.env.NEXT_PUBLIC_SOCIAL_BRAND_HANDLE?.trim() || "thekitchenconnection";
  const fallbackInstagram =
    process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM?.trim() || defaultInstagramUrl(brandHandle);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings?key=social_instagram_url")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const v = typeof d?.value === "string" ? d.value.trim() : "";
        setInstagramUrl(v || fallbackInstagram);
      })
      .catch(() => setInstagramUrl(fallbackInstagram));
    return () => {
      cancelled = true;
    };
  }, [fallbackInstagram]);

  const ok = isHttpUrl(instagramUrl);

  return (
    <div className={cn("mt-5", className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary/90 mb-2.5">{t.footer.followUs}</p>
      <ul className="flex flex-wrap gap-2 items-center" role="list">
        <li>
          {ok ? (
            <a
              href={instagramUrl!.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(iconBtn, "hover:border-primary/40 hover:bg-primary/10 hover:text-primary")}
              aria-label="Instagram"
            >
              <Instagram className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </a>
          ) : (
            <span
              className={cn(iconBtn, "cursor-default opacity-45 grayscale")}
              title={t.footer.socialAddUrlHint}
              aria-label={`Instagram — ${t.footer.socialAddUrlHint}`}
            >
              <Instagram className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </span>
          )}
        </li>
      </ul>
    </div>
  );
}
