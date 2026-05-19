"use client";
import Link from "next/link";
import { MapPin, Crown, Star, Heart, ShieldCheck, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { WhatsAppButton } from "./WhatsAppButton";
import { useTranslation } from "@/contexts/LanguageContext";
import { getPlanConfig } from "@/lib/plans";
import type { SupplierTagDisplayMaps } from "@/lib/category-display";
import { toggleFavorite, getFavoriteIds, syncFromStorage } from "@/lib/favorites";
import { useLoginPrompt } from "./LoginPromptModal";

interface SupplierCardProps {
  supplier: {
    id: string;
    slug: string;
    name?: string;
    name_ja?: string;
    nameJa?: string;
    logo: string;
    category?: string;
    category_ja?: string;
    categoryJa?: string;
    category_2?: string;
    category_2_ja?: string;
    category_3?: string;
    category_3_ja?: string;
    tags: string[];
    area?: string;
    area_ja?: string;
    areaJa?: string;
    description?: string;
    description_ja?: string;
    descriptionJa?: string;
    whatsapp: string;
    whatsapp_contact_name?: string;
    plan?: string | null;
  };
  variant?: "grid" | "list";
  rank?: number;
  /** Resolved EN/JA labels for admin tag categories (type=tag). Required for correct English/Japanese tag text on cards. */
  tagDisplayMaps?: SupplierTagDisplayMaps;
  /** @deprecated use tagDisplayMaps */
  tagLabelMap?: Record<string, string>;
}

function PlanBadge({ plan, lang }: { plan?: string | null; lang: string }) {
  const cfg = getPlanConfig(plan);
  if (cfg.tier === "basic") return null;
  const label = (lang === "ja" ? cfg.badgeLabelJa ?? cfg.labelJa : cfg.badgeLabelEn ?? cfg.labelEn);

  if (cfg.tier === "premium") {
    return (
      <Link
        href="/plans"
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] hover:opacity-90 transition-all duration-300 hover:scale-[1.03] ${cfg.badgeClass}`}
      >
        <ShieldCheck className="h-3 w-3 text-amber-600 dark:text-amber-300" />
        <span className="tracking-wide">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href="/plans"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] hover:opacity-80 transition-all duration-300 hover:scale-[1.03] ${cfg.badgeClass}`}
    >
      <Star className="h-2.5 w-2.5" />
      {label}
    </Link>
  );
}

function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => getFavoriteIds());

  useEffect(() => {
    const onUpdated = () => setFavorites(getFavoriteIds());
    const onStorage = () => { syncFromStorage(); setFavorites(getFavoriteIds()); };
    window.addEventListener("favorites-updated", onUpdated);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("favorites-updated", onUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { favorites, toggle: toggleFavorite };
}

export function SupplierCard({ supplier, variant = "grid", rank, tagDisplayMaps, tagLabelMap }: SupplierCardProps) {
  const { t, lang } = useTranslation();
  const cfg = getPlanConfig(supplier.plan);
  const { favorites, toggle } = useFavorites();
  const isFav = favorites.includes(String(supplier.id));
  const { requireLogin, loginPromptModal, isLoggedIn } = useLoginPrompt();

  const nameEn = supplier.name || supplier.name_ja || supplier.nameJa || "";
  const nameJa = supplier.name_ja || supplier.nameJa || supplier.name || "";
  const displayName = lang === "ja" ? nameJa : nameEn;
  const contactName = supplier.whatsapp_contact_name?.trim();

  const tagMap = (t.suppliers as { tagMap?: Record<string, string> }).tagMap ?? {};
  const translateTag = (tag: string) => {
    if (tagDisplayMaps) {
      const m = lang === "ja" ? tagDisplayMaps.toJa : tagDisplayMaps.toEn;
      if (m[tag]) return m[tag];
    }
    if (tagLabelMap?.[tag]) return tagLabelMap[tag];
    return tagMap[tag] ?? tag;
  };

  const areaLabel =
    lang === "ja"
      ? (supplier.area_ja || supplier.areaJa || "")
      : ((t.suppliers as { areas?: Record<string, string> }).areas?.[supplier.area ?? ""] ?? supplier.area ?? "");
  const description =
    lang === "ja"
      ? (supplier.description_ja || supplier.descriptionJa || "")
      : (supplier.description || supplier.description_ja || "");

  const isList = variant === "list";
  const imageSizeClass = isList ? "w-12 h-12" : cfg.cardImageSize;
  const logoRing = !isList && cfg.logoRingClass ? cfg.logoRingClass : "";
  const wrapperClass = `${cfg.borderClass} ${cfg.cardWrapperClass}`;

  const cardContent = (
    <div className={`p-2.5 sm:p-3 flex flex-col h-full min-h-0 ${isList ? "flex-row items-center gap-4" : ""}`}>
      <div className={`flex items-start gap-2.5 sm:gap-3 ${isList ? "flex-1 min-w-0 flex-row" : "mb-2 flex-shrink-0"}`}>
        <Link href={`/suppliers/${supplier.slug}`} className={`overflow-hidden flex-shrink-0 bg-muted block rounded-lg ${imageSizeClass} ${logoRing}`} tabIndex={-1} aria-hidden="true">
          <img
            src={supplier.logo}
            alt={displayName}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1 mb-0.5">
            <Link href={`/suppliers/${supplier.slug}`} className="hover:underline min-w-0 flex-1">
              <h3 className={`leading-snug line-clamp-2 ${isList ? "text-sm font-medium" : cfg.titleClass}`} title={displayName}>{displayName}</h3>
            </Link>
            <PlanBadge plan={supplier.plan} lang={lang} />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="break-words line-clamp-2" title={areaLabel + (contactName ? ` · ${t.supplierCard.contactLabel}${contactName}` : "")}>{areaLabel}{contactName ? ` · ${t.supplierCard.contactLabel}${contactName}` : ""}</span>
          </div>
        </div>
      </div>
      {!isList && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed flex-shrink-0" title={description}>{description}</p>
      )}
      {(() => {
        // Aggressive normalisation so legacy spellings ("Japanese Support" vs
        // "Japanese support" vs "japanese-ok" vs "japanese support") fingerprint
        // identically and collapse to a single chip.
        const normalize = (s: string) =>
          (s || "").trim().toLowerCase().replace(/[\s\-_./]+/g, "");
        // Build a Set of every fingerprint a raw value can map to (display label,
        // raw, EN/JA aliases via tagDisplayMaps, locale tagMap fallback). Two raws
        // that share *any* fingerprint are treated as the same logical tag.
        const fingerprintsFor = (raw: string, label: string): string[] => {
          const out = new Set<string>();
          const push = (v?: string) => { const n = normalize(v || ""); if (n) out.add(n); };
          push(label);
          push(raw);
          if (tagDisplayMaps) { push(tagDisplayMaps.toEn[raw]); push(tagDisplayMaps.toJa[raw]); }
          if (tagMap[raw]) push(tagMap[raw]);
          return Array.from(out);
        };
        const seen = new Set<string>();
        const uniqueTags: { raw: string; label: string }[] = [];
        for (const raw of supplier.tags ?? []) {
          const label = translateTag(raw);
          const fps = fingerprintsFor(raw, label);
          if (fps.length === 0) continue;
          if (fps.some((fp) => seen.has(fp))) continue;
          fps.forEach((fp) => seen.add(fp));
          uniqueTags.push({ raw, label });
        }
        return (
          <div
            className={`flex flex-wrap gap-1.5 flex-shrink-0 min-w-0`}
            title={uniqueTags.map((u) => u.label).join(", ")}
          >
            {uniqueTags.map(({ raw, label }) => (
              <span key={raw} className="tag-badge tag-badge-fixed" title={label}>
                {label}
              </span>
            ))}
          </div>
        );
      })()}
      <div className={`flex gap-2 flex-shrink-0 flex-nowrap items-center ${isList ? "" : "mt-auto"}`}>
        <Link href={`/suppliers/${supplier.slug}`} className={isList ? "" : "flex-1 min-w-0"}>
          <button className={`btn-3d rounded-xl border transition-all duration-200 h-9 min-h-9 flex items-center justify-center ${isList ? "h-8 px-3" : "w-full min-w-[100px]"} ${cfg.ctaClass}`}>
            <span className="truncate">{t.supplierCard.viewDetail}</span>
          </button>
        </Link>
        {cfg.showWhatsApp && (
          isLoggedIn ? (
            <WhatsAppButton
              phone={supplier.whatsapp}
              message={lang === "ja" ? `${displayName}${t.supplierCard.inquire}` : `I'd like to inquire about ${displayName}.`}
              size="sm"
              className="!h-9 !min-h-9 flex-shrink-0 [&>span]:truncate"
              trackSupplierId={String(supplier.id)}
              trackSupplierSlug={supplier.slug}
            />
          ) : (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); requireLogin(); }}
              className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold text-whatsapp-foreground whatsapp-gradient border-0 hover:opacity-95 transition-all duration-200 !h-9 !min-h-9 px-3 text-sm flex-shrink-0"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">WhatsApp</span>
            </button>
          )
        )}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); toggle(String(supplier.id)); }}
          title={isFav ? (lang === "ja" ? "お気に入りから削除" : "Remove from favorites") : (lang === "ja" ? "お気に入りに追加" : "Add to favorites")}
          aria-label={isFav ? (lang === "ja" ? "お気に入りから削除" : "Remove from favorites") : (lang === "ja" ? "お気に入りに追加" : "Add to favorites")}
          className={`btn-3d h-9 min-h-9 w-9 min-w-9 flex items-center justify-center rounded-xl border transition-all flex-shrink-0 hover:scale-100 hover:translate-y-0 ${
            isFav ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15" : "border-border text-muted-foreground hover:text-primary hover:border-primary/30"
          }`}
        >
          <Heart className={`h-4 w-4 shrink-0 ${isFav ? "fill-primary" : ""}`} />
        </button>
      </div>
    </div>
  );

  const cardBg = !isList && cfg.cardBgClass ? cfg.cardBgClass : "bg-card";

  return (
    <div className={`group ${cardBg} rounded-xl overflow-hidden shadow-card card-hover card-lift border relative flex flex-col h-full min-h-0 min-w-0 transition-shadow duration-300 hover:shadow-[0_12px_28px_rgba(0,0,0,0.12),0_0_0_1px_hsl(var(--primary)/0.1)] ${wrapperClass} ${isList ? "flex-row items-center" : ""}`}>
      {cfg.accentBarClass && !isList && (
        <div className={cfg.accentBarClass} />
      )}
      {cfg.featuredLabelEn && !isList && (
        <Link
          href="/plans"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-bold shadow-sm z-10 transition-colors"
        >
          {lang === "ja" ? cfg.featuredLabelJa : cfg.featuredLabelEn}
        </Link>
      )}
      {rank != null && (
        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-sm z-10">
          {rank}
        </div>
      )}
      {cardContent}
      {loginPromptModal}
    </div>
  );
}
