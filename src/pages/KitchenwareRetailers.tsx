"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ShoppingBag, Sparkles } from "lucide-react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/contexts/LanguageContext";
import { KITCHENWARE_RETAILERS } from "@/data/kitchenwareRetailers";
import { KITCHENWARE_SHOWCASE } from "@/data/kitchenwareShowcase";

function RetailerLogo({ domain, label }: { domain: string; label: string }) {
  const [ok, setOk] = useState(true);
  const src = `https://logo.clearbit.com/${domain}`;
  if (!ok) {
    const initials = label
      .replace(/[^a-zA-Z0-9&]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    return (
      <div
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/12 text-xs font-black text-primary border border-primary/20"
        aria-hidden
      >
        {initials || "•"}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-12 w-12 flex-shrink-0 rounded-xl border border-white/40 bg-white object-contain p-1 shadow-md"
      onError={() => setOk(false)}
    />
  );
}

export default function KitchenwareRetailers() {
  const { t, lang } = useTranslation();
  const k = t.kitchenware;

  return (
    <Layout>
      {/* Hero — retail-inspired band */}
      <section className="relative overflow-hidden border-b border-border">
        <img
          src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1600&q=80"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/35" />
        <div className="relative container py-12 md:py-16 text-white">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/85 hover:text-white mb-6 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            {k.backHome}
          </Link>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm border border-white/20">
              <Sparkles className="h-3.5 w-3.5" />
              {k.badge}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight max-w-2xl drop-shadow-sm">
            {k.pageTitle}
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/90 max-w-2xl leading-relaxed">{k.pageSubtitle}</p>
        </div>
      </section>

      <div className="container py-10 md:py-14 space-y-14">
        <p className="text-xs md:text-sm text-muted-foreground border-l-4 border-primary/40 pl-4 py-1 max-w-3xl leading-relaxed">
          {k.disclaimer}
        </p>

        <section>
          <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2 mb-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            {k.retailersTitle}
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-2xl">{k.retailersSub}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {KITCHENWARE_RETAILERS.map((r) => (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/30 hover:-translate-y-0.5"
              >
                <div className="relative h-36 overflow-hidden">
                  <img
                    src={r.cardImage}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                    <RetailerLogo domain={r.logoDomain} label={r.name} />
                    <ExternalLink className="h-4 w-4 text-white/90 shrink-0" />
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-sm leading-snug group-hover:text-primary transition-colors">
                    {lang === "ja" ? r.nameJa : r.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed flex-1 line-clamp-3">
                    {lang === "ja" ? r.blurbJa : r.blurb}
                  </p>
                  <span className="mt-4 text-xs font-bold text-primary inline-flex items-center gap-1">
                    {k.visitStore} <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-primary/25 bg-muted/40 p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-black tracking-tight mb-2">{k.showcaseTitle}</h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-3xl">{k.showcaseSub}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {KITCHENWARE_SHOWCASE.map((item) => (
              <a
                key={item.id}
                href={item.shopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-xl border border-border bg-background overflow-hidden hover:border-primary/35 hover:shadow-md transition-all"
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-2.5">
                  <p className="text-[11px] font-bold leading-tight line-clamp-2 group-hover:text-primary">
                    {lang === "ja" ? item.titleJa : item.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                    {lang === "ja" ? item.captionJa : item.caption}
                  </p>
                  <p className="text-[10px] font-semibold text-primary mt-2 truncate">{item.shopLabel}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
