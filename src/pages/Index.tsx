"use client";
import Link from "next/link";
import Image from "next/image";
import { Search, ArrowRight, ShoppingBag, TrendingUp, Sparkles, Newspaper, Globe, ExternalLink, ChevronLeft, ChevronRight, Briefcase, Play } from "lucide-react";
import s1 from "@/assets/s1.jpg";
import s2 from "@/assets/s2.jpg";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import { SupplierCard } from "@/components/SupplierCard";
import { MarketplaceCard } from "@/components/MarketplaceCard";
import { useFetch } from "@/hooks/useSupabaseData";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "@/contexts/LanguageContext";
import { AnimatedGridItem } from "@/components/AnimatedGridItem";
import { takeHomeSuppliers } from "@/lib/plans";
import type { PlanCounts } from "@/lib/plans";
import { buildSupplierTagDisplayMaps, getCategoryDisplayName } from "@/lib/category-display";
import type { SupplierRow, MarketplaceItemRow, CategoryRow, NewsArticleRow, JobNoticeRow } from "@/types/database";

function SupplierSkeleton() {
  return (
    <div className="bg-card border p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-14 h-14 rounded-xl bg-muted flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-1.5 mb-3">
        <div className="h-2.5 bg-muted rounded w-full" />
        <div className="h-2.5 bg-muted rounded w-4/5" />
      </div>
      <div className="flex gap-1.5 mb-4">
        <div className="h-5 bg-muted rounded-full w-16" />
        <div className="h-5 bg-muted rounded-full w-12" />
      </div>
      <div className="h-9 bg-muted rounded-xl" />
    </div>
  );
}

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const { t, lang } = useTranslation();
  // Supabase auth redirects land on the home page when /reset-password is not
  // in the allowed Redirect URLs list. Use a full-page redirect so Supabase
  // can process the token fresh on /reset-password (avoids session loss with
  // client-side navigation).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (
      hash &&
      (hash.includes("type=recovery") ||
        hash.includes("access_token") ||
        hash.includes("error="))
    ) {
      window.location.replace("/reset-password" + hash);
    }
  }, []);

  const { data: suppliers, loading: suppliersLoading } = useFetch<SupplierRow[]>("/api/suppliers");
  const { data: planCountsData } = useFetch<PlanCounts>("/api/suppliers/plan-counts");
  const planCounts: PlanCounts = planCountsData ?? { premium: 0, standard: 0, basic: 0 };
  const { data: marketplaceItems } = useFetch<MarketplaceItemRow[]>("/api/marketplace");
  const { data: categories } = useFetch<CategoryRow[]>("/api/categories?type=supplier");
  const { data: tagCategories } = useFetch<CategoryRow[]>("/api/categories?type=tag");
  const { data: newsArticles } = useFetch<NewsArticleRow[]>("/api/news");
  const { data: jobNotices } = useFetch<JobNoticeRow[]>("/api/job-notices?limit=50");
  const { data: promoVideoSetting } = useFetch<{ value?: string }>("/api/settings?key=promo_video_url");
  const promoVideoUrl: string = (promoVideoSetting as any)?.value?.trim() || "";

  const tagDisplayMaps = useMemo(() => buildSupplierTagDisplayMaps(tagCategories || []), [tagCategories]);
  const popularSuppliers = useMemo(() => takeHomeSuppliers(suppliers || []), [suppliers]);
  const recentItems = (marketplaceItems || []).slice(0, 6);
  const latestNews = useMemo(
    () =>
      [...(newsArticles || [])]
        .sort((a, b) => {
          const da = (a as { published_at?: string }).published_at || a.created_at;
          const db = (b as { published_at?: string }).published_at || b.created_at;
          return new Date(db).getTime() - new Date(da).getTime();
        })
        .slice(0, 5),
    [newsArticles]
  );
  const latestJobNotices = useMemo(
    () =>
      [...(jobNotices || [])]
        .filter((n) => (n.post_type ?? "job") === "job")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3),
    [jobNotices]
  );

  const { data: linksData } = useFetch<any[]>("/api/links");
  const featuredLinks = linksData || [];
  const [failedLinkImages, setFailedLinkImages] = useState<Record<string, boolean>>({});
  const isMobile = useIsMobile();
  const VISIBLE = isMobile ? 1 : 3;
  const [linksIndex, setLinksIndex] = useState(0);
  const maxLinksIndex = Math.max(0, featuredLinks.length - VISIBLE);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLinksIndex((i) => Math.min(i, Math.max(0, featuredLinks.length - VISIBLE)));
  }, [VISIBLE, featuredLinks.length]);

  const startAutoTimer = useCallback(() => {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    autoTimerRef.current = setInterval(() => {
      setLinksIndex((i) => (i >= maxLinksIndex ? 0 : i + 1));
    }, 2000);
  }, [maxLinksIndex]);

  useEffect(() => {
    startAutoTimer();
    return () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); };
  }, [startAutoTimer]);

  const goLeft = () => {
    setLinksIndex((i) => Math.max(0, i - 1));
    startAutoTimer();
  };
  const goRight = () => {
    setLinksIndex((i) => Math.min(maxLinksIndex, i + 1));
    startAutoTimer();
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedCategory) params.set("category", selectedCategory);
    window.location.href = `/suppliers?${params.toString()}`;
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[480px] md:min-h-[520px] flex items-center overflow-hidden w-full">
        <div className="absolute inset-0">
          <img src="/hero-bg.jpg" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/25" />
        </div>
        <div className="container relative z-10 pt-6 sm:pt-8 md:pt-10 pb-10 sm:pb-14 md:pb-20 w-full min-w-0">
          <div className="max-w-2xl min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium mb-6 animate-hero-soft">
              <Sparkles className="h-3.5 w-3.5 animate-float-subtle shrink-0" style={{ animationDuration: "5s" }} />
              {t.home.badge}
            </div>
            <h1
              className="text-3xl md:text-5xl font-bold text-white leading-[1.15] tracking-tight animate-hero-soft break-words-safe"
              style={{ animationDelay: "90ms" }}
            >
              {t.home.heroTitle1}<br />
              <span className="text-primary">{t.home.heroTitle2}</span><br />
              {t.home.heroTitle3}
            </h1>
            <p
              className="mt-4 text-white/85 text-base md:text-lg animate-hero-soft max-w-lg break-words-safe"
              style={{ animationDelay: "160ms" }}
            >
              {t.home.heroSub}
            </p>
            {/* メインメニュー: カテゴリーで探す・人気サプライヤー・Buy & Sell を横並び（スマホでも3列） */}
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3 animate-hero-soft min-w-0" style={{ animationDelay: "220ms" }}>
              <Link
                href="/suppliers"
                className="group/hero-btn inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 sm:px-5 sm:py-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-[10px] sm:text-sm border border-white/30 transition-all duration-300 ease-out backdrop-blur-sm min-w-0 break-words-safe text-center hover:scale-[1.02] active:scale-[0.98]"
              >
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 transition-transform duration-300 group-hover/hero-btn:scale-110" />
                <span className="text-center leading-tight">{t.home.card1Title}</span>
              </Link>
              <Link
                href="/suppliers"
                className="group/hero-btn2 inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 sm:px-5 sm:py-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-[10px] sm:text-sm border border-white/30 transition-all duration-300 ease-out backdrop-blur-sm min-w-0 break-words-safe text-center hover:scale-[1.02] active:scale-[0.98]"
              >
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 transition-transform duration-300 group-hover/hero-btn2:scale-110" />
                <span className="text-center leading-tight">{t.home.popularSuppliers}</span>
              </Link>
              <Link
                href="/marketplace"
                className="group/hero-btn3 inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 sm:px-5 sm:py-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-[10px] sm:text-sm border border-white/30 transition-all duration-300 ease-out backdrop-blur-sm min-w-0 break-words-safe text-center hover:scale-[1.02] active:scale-[0.98]"
              >
                <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 transition-transform duration-300 group-hover/hero-btn3:scale-110" />
                <span className="text-center leading-tight">{t.home.card3Title}</span>
              </Link>
            </div>
            <div
              className="mt-6 bg-white p-4 md:p-5 shadow-card-hover animate-hero-soft min-w-0 overflow-hidden rounded-2xl border border-white/10"
              style={{ animationDelay: "280ms" }}
            >
              <div className="flex flex-col sm:flex-row gap-3 min-w-0">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-12 px-4 rounded-xl border border-border bg-white text-sm font-medium text-foreground sm:w-48 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ui-filter-control"
                >
                  <option value="">{t.home.categoryPlaceholder}</option>
                  {(categories || []).map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {getCategoryDisplayName(cat, lang) ||
                        (t.suppliers as { categories?: Record<string, string> }).categories?.[cat.value] ||
                        cat.label}
                    </option>
                  ))}
                </select>
                <div className="flex-1 relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={t.home.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ui-filter-control"
                  />
                </div>
                <Button onClick={handleSearch} className="h-12 px-6 rounded-xl font-bold bg-primary hover:bg-primary/90 active:scale-[0.97]">
                  {t.common.search}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Services — two white cards: image on top, title + subtext below (no overlay / no icon) */}
      <section className="our-services-section bg-muted py-10 md:py-14 overflow-hidden w-full">
        <div className="container min-w-0 max-w-3xl mx-auto">
          <h2 className="text-center text-xl md:text-2xl mb-8 md:mb-10 opacity-0-init animate-fade-in-up reveal-stagger-0">
            {t.home.ourServices}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 md:gap-8 min-w-0 justify-items-center sm:justify-items-stretch">
            <Link href="/suppliers" className="group block h-full w-[70%] sm:w-full opacity-0-init animate-fade-in-up reveal-stagger-1">
              <div className="flex h-full min-h-[170px] sm:min-h-[280px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-md transition-shadow duration-300 card-lift group-hover:shadow-xl group-hover:border-black/18">
                <div className="relative w-full aspect-[16/8.5] sm:aspect-[16/9] shrink-0 overflow-hidden bg-white">
                  <Image
                    src={s1}
                    alt=""
                    fill
                    className="object-contain p-2 sm:p-3 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                  />
                </div>
                <div className="flex flex-1 flex-col items-center justify-center text-center px-3 py-2.5 sm:px-6 sm:py-5">
                  <h3 className="text-[14px] sm:text-lg md:text-xl leading-snug">
                    {t.home.findSuppliers}
                  </h3>
                  <p className="mt-1 sm:mt-2.5 max-w-[280px] text-[11px] sm:text-sm leading-relaxed">
                    {t.home.findSuppliersSub}
                  </p>
                </div>
              </div>
            </Link>
            <Link href="/marketplace" className="group block h-full w-[70%] sm:w-full opacity-0-init animate-fade-in-up reveal-stagger-2">
              <div className="flex h-full min-h-[170px] sm:min-h-[280px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-md transition-shadow duration-300 card-lift group-hover:shadow-xl group-hover:border-black/18">
                <div className="relative w-full aspect-[16/8.5] sm:aspect-[16/9] shrink-0 overflow-hidden bg-white">
                  <Image
                    src={s2}
                    alt=""
                    fill
                    className="object-contain p-2 sm:p-3 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                  />
                </div>
                <div className="flex flex-1 flex-col items-center justify-center text-center px-3 py-2.5 sm:px-6 sm:py-5">
                  <h3 className="text-[14px] sm:text-lg md:text-xl leading-snug">
                    {t.home.buyAndSell}
                  </h3>
                  <p className="mt-1 sm:mt-2.5 max-w-[300px] text-[11px] sm:text-sm leading-relaxed">
                    {t.home.buyAndSellSub}
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* Promo video — shown when set in admin, placeholder otherwise */}
          {(() => {
            const ytId = promoVideoUrl
              ? (promoVideoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/) || [])[1]
              : null;
            const isFile = promoVideoUrl && !ytId;
            return (
              <div className="mt-8 md:mt-10 opacity-0-init animate-fade-in-up reveal-stagger-3">
                {promoVideoUrl ? (
                  <div className="rounded-2xl overflow-hidden shadow-lg bg-black aspect-video">
                    {ytId ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="Promo video"
                      />
                    ) : (
                      <video
                        src={promoVideoUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-border bg-white aspect-video flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Play className="h-7 w-7 text-primary ml-1" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {lang === "ja" ? "紹介動画（準備中）" : "Introduction video coming soon"}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </section>

      {/* 2. Popular Suppliers — fixed showcase counts on home; /suppliers shows live totals + full list */}
      <section className="container py-10 md:py-12 opacity-0-init animate-fade-in-up reveal-stagger-2 min-w-0 overflow-hidden">
        <div className="flex flex-col gap-4 mb-6 min-w-0">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 min-w-0">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5 min-w-0 flex-1">
              <h2 className="section-title text-xl md:text-2xl flex items-center gap-2 min-w-0 shrink-0">
                <TrendingUp className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="truncate">{t.home.popularSuppliers}</span>
              </h2>
              <div className="flex flex-wrap gap-2 items-center" aria-label={lang === "ja" ? "プラン別サプライヤー数（表示枠）" : "Featured suppliers by plan (fixed slots)"}>
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/90 font-semibold tabular-nums">
                  {lang === "ja" ? (
                    <>
                      {t.home.popularPlanFull}-{planCounts.premium}
                      {t.home.popularPlanCompaniesSuffix}
                    </>
                  ) : (
                    <>
                      {t.home.popularPlanFull} - {planCounts.premium} {t.home.popularPlanCompaniesSuffix}
                    </>
                  )}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/35 font-semibold tabular-nums">
                  {lang === "ja" ? (
                    <>
                      {t.home.popularPlanStandard}-{planCounts.standard}
                      {t.home.popularPlanCompaniesSuffix}
                    </>
                  ) : (
                    <>
                      {t.home.popularPlanStandard} - {planCounts.standard} {t.home.popularPlanCompaniesSuffix}
                    </>
                  )}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border font-semibold tabular-nums">
                  {lang === "ja" ? (
                    <>
                      {t.home.popularPlanQuick}-{planCounts.basic}
                      {t.home.popularPlanCompaniesSuffix}
                    </>
                  ) : (
                    <>
                      {t.home.popularPlanQuick} - {planCounts.basic} {t.home.popularPlanCompaniesSuffix}
                    </>
                  )}
                </span>
              </div>
            </div>
            <Link
              href="/suppliers"
              className="link-more flex-shrink-0 self-end xl:self-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 hover:text-white"
            >
              {t.common.viewDetails} <ArrowRight className="h-3.5 w-3.5 link-more-arrow" />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 min-w-0">
          {suppliersLoading
            ? Array.from({ length: 18 }).map((_, i) => <SupplierSkeleton key={i} />)
            : popularSuppliers.map((s, i) => (
                <AnimatedGridItem key={s.id} index={i}>
                  <SupplierCard supplier={s} tagDisplayMaps={tagDisplayMaps} />
                </AnimatedGridItem>
              ))
          }
        </div>
      </section>

      {/* 3. Buy & Sell (Recent marketplace) */}
      <section className="bg-muted py-10 md:py-14 overflow-hidden w-full opacity-0-init animate-fade-in-up reveal-stagger-3">
        <div className="container min-w-0">
          <div className="flex items-center justify-between mb-6 gap-4 min-w-0">
            <h2 className="section-title text-xl md:text-2xl flex items-center gap-2 min-w-0">
              <ShoppingBag className="h-5 w-5 text-primary flex-shrink-0" /> <span className="truncate">{t.home.recentMarketplace}</span>
            </h2>
            <Link href="/marketplace" className="link-more flex-shrink-0 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 hover:text-white">
              {t.common.viewAll} <ArrowRight className="h-3.5 w-3.5 link-more-arrow" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 items-stretch min-w-0">
            {recentItems.map((item, i) => (
              <AnimatedGridItem key={item.id} index={i}>
                <MarketplaceCard item={item} />
              </AnimatedGridItem>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Latest Jobs */}
      {latestJobNotices.length > 0 && (
        <section className="container py-10 md:py-12 min-w-0 overflow-hidden opacity-0-init animate-fade-in-up reveal-stagger-4">
          <div className="flex items-center justify-between mb-6 gap-4 min-w-0">
            <h2 className="section-title text-xl md:text-2xl flex items-center gap-2 min-w-0">
              <Briefcase className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="truncate">{t.nav.jobs}</span>
            </h2>
            <Link href="/jobs" className="link-more flex-shrink-0 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 hover:text-white">
              {t.common.viewAll} <ArrowRight className="h-3.5 w-3.5 link-more-arrow" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {latestJobNotices.map((notice) => (
              <Link
                key={notice.id}
                href="/jobs"
                className="block rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all duration-200"
              >
                <p className="text-xs text-muted-foreground mb-2">
                  {new Date(notice.created_at).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-US")}
                </p>
                <h3 className="font-semibold text-sm line-clamp-2 mb-1">{notice.title}</h3>
                {notice.company && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{notice.company}</p>
                )}
                <p className="text-xs text-muted-foreground line-clamp-3">{notice.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 4. Latest News */}
      {latestNews.length > 0 && (
        <section className="container py-10 md:py-12 min-w-0 overflow-hidden opacity-0-init animate-fade-in-up reveal-stagger-5">
          <div className="flex items-center justify-between mb-6 gap-4 min-w-0">
            <h2 className="section-title text-xl md:text-2xl flex items-center gap-2 min-w-0">
              <Newspaper className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="truncate">{t.news.homeSection}</span>
            </h2>
            <Link href="/news" className="link-more flex-shrink-0 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 hover:text-white">
              {t.news.viewAllNews} <ArrowRight className="h-3.5 w-3.5 link-more-arrow" />
            </Link>
          </div>
          <div className="bg-card overflow-hidden shadow-sm min-w-0">
            <div className="overflow-x-hidden">
              {latestNews.map((article, index) => {
                const isCurrent = index === 0;
                const displayDate = (article as { published_at?: string }).published_at || article.created_at;
                const d = new Date(displayDate);
                const dateStr = `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
                const categoryLabel = (t.news as { categories?: Record<string, string> }).categories?.[article.category] ?? article.category;
                const title = lang === "ja" ? (article.title_ja || article.title) : (article.title || article.title_ja);
                return (
                  <Link
                    key={article.id}
                    href={`/news/${article.slug}`}
                    className={`flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-muted/50 transition-colors duration-300 group min-w-0 ${index % 2 === 1 ? "bg-muted/20" : "bg-transparent"}`}
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                      <img
                        src={article.image || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=112&h=112&fit=crop"}
                        alt={title || ""}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs tabular-nums flex-shrink-0 ${isCurrent ? "font-bold text-primary" : "font-medium text-muted-foreground"}`}>
                          {dateStr}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary text-white flex-shrink-0 truncate max-w-[80px] sm:max-w-none">
                          {categoryLabel}
                        </span>
                      </div>
                      <span className="text-sm text-foreground group-hover:text-primary transition-colors truncate min-w-0">
                        {title}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 5. Links (リンク集) */}
      {featuredLinks.length > 0 && (
        <section className="bg-muted py-10 md:py-12 w-full overflow-hidden opacity-0-init animate-fade-in-up reveal-stagger-6">
          <div className="container min-w-0">
            <div className="flex items-center justify-between mb-2 gap-4 min-w-0">
              <h2 className="section-title text-xl md:text-2xl flex items-center gap-2 min-w-0">
                <Globe className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="truncate">{t.links.homeSectionTitle}</span>
              </h2>
              <Link href="/links" className="link-more flex-shrink-0 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 hover:text-white">
                {t.common.viewAll} <ArrowRight className="h-3.5 w-3.5 link-more-arrow" />
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {t.links.homeSectionSubtitle}
            </p>
          </div>

          <div className="relative w-full">
            {/* Left arrow */}
            <button
              type="button"
              onClick={goLeft}
              disabled={linksIndex === 0}
              className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/95 shadow-card border border-border flex items-center justify-center text-foreground hover:bg-white hover:border-primary/40 hover:text-primary transition-all duration-200 disabled:opacity-30 disabled:cursor-default"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {/* Right arrow */}
            <button
              type="button"
              onClick={goRight}
              disabled={linksIndex >= maxLinksIndex}
              className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/95 shadow-card border border-border flex items-center justify-center text-foreground hover:bg-white hover:border-primary/40 hover:text-primary transition-all duration-200 disabled:opacity-30 disabled:cursor-default"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Viewport — on mobile: 1 card at 60vw; on desktop: 3 cards */}
            <div className="overflow-hidden px-12 sm:px-14 md:px-16 min-w-0 w-full">
              <div
                className="flex flex-nowrap transition-transform duration-500 ease-out"
                style={
                  isMobile
                    ? {
                        width: "max-content",
                        transform: `translateX(-${linksIndex * 60}vw)`,
                      }
                    : {
                        width: `${(featuredLinks.length / VISIBLE) * 100}%`,
                        transform: `translateX(${-linksIndex * (100 / featuredLinks.length)}%)`,
                      }
                }
              >
                {featuredLinks.map((link: any) => (
                  <div
                    key={link.id ?? link.url}
                    className="flex-shrink-0"
                    style={
                      isMobile
                        ? { width: "60vw", padding: "0 0.5rem" }
                        : { width: `${100 / featuredLinks.length}%`, padding: "0 0.5rem" }
                    }
                  >
                    <a
                      href={link.url}
                      target={link.url.startsWith("http") ? "_blank" : "_self"}
                      rel="noopener noreferrer"
                      className="group relative block w-full aspect-[208/144] overflow-hidden shadow-card card-lift"
                    >
                      {!failedLinkImages[String(link.id ?? link.url)] &&
                      (link.bg_image || link.bgImage || "").toString().trim() ? (
                        <img
                          src={(link.bg_image || link.bgImage || "").toString().trim()}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          onError={() =>
                            setFailedLinkImages((prev) => ({ ...prev, [String(link.id ?? link.url)]: true }))
                          }
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/70 flex items-center justify-center text-2xl">
                          {link.icon || "🔗"}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10 transition-opacity duration-300 group-hover:from-black/85 group-hover:via-black/45" />
                      <div className="absolute inset-0 p-3.5 flex flex-col justify-between">
                        <div className="self-end">
                          <ExternalLink className="h-3.5 w-3.5 text-white/60 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                          <h3 className="text-white text-xs font-bold leading-snug line-clamp-2 drop-shadow-sm">
                            {lang === "ja" ? (link.name_ja || link.nameJa || link.name) : link.name}
                          </h3>
                        </div>
                      </div>
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Dot indicators */}
            {maxLinksIndex > 0 && (
              <div className="flex justify-center gap-1.5 mt-4">
                {Array.from({ length: maxLinksIndex + 1 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setLinksIndex(i); startAutoTimer(); }}
                    className={`rounded-full transition-all duration-200 ${i === linksIndex ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"}`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

    </Layout>
  );
};

export default Index;
