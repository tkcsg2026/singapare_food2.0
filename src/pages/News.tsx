"use client";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Calendar, ArrowRight, Newspaper, ChevronLeft, ChevronRight } from "lucide-react";
import Layout from "@/components/Layout";
import { useFetch } from "@/hooks/useSupabaseData";
import { useTranslation } from "@/contexts/LanguageContext";
import type { NewsArticleRow, CategoryRow } from "@/types/database";
import { getCategoryDisplayName } from "@/lib/category-display";

const PER_PAGE = 9;

const News = () => {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [page, setPage] = useState(1);
  const { t, lang } = useTranslation();
  const { data: articles, loading } = useFetch<NewsArticleRow[]>("/api/news");
  const { data: categories } = useFetch<CategoryRow[]>("/api/categories?type=news");

  const filtered = (articles || []).filter(
    (a) => !selectedCategory || a.category === selectedCategory
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filtered, page]
  );

  const goToPage = (p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages)));
  };

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  return (
    <Layout>
      <div className="container py-8 min-w-0 overflow-hidden w-full">
        <div className="mb-8 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3 min-w-0 break-words-safe">
            <Newspaper className="h-7 w-7 text-primary flex-shrink-0" />
            <span className="min-w-0">{t.news.title}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t.news.subtitle}</p>
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
          <button
            onClick={() => setSelectedCategory("")}
            className={`flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              !selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t.common.all}
          </button>
          {(categories || []).map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {getCategoryDisplayName(cat, lang) ||
                (t.news as { categories?: Record<string, string> }).categories?.[cat.value] ||
                cat.value}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">{t.common.loading}</div>
        ) : filtered.length > 0 ? (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginated.map((article) => (
              <Link key={article.id} href={`/news/${article.slug}`} className="group">
                <div className="bg-card border overflow-hidden card-hover">
                  <div className="aspect-[16/9] overflow-hidden">
                    <img
                      src={article.image || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=340&fit=crop"}
                      alt={article.title_ja || article.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="tag-badge">
                        {(() => {
                          const row = (categories || []).find((c) => c.value === article.category);
                          return row
                            ? getCategoryDisplayName(row, lang)
                            : (t.news as { categories?: Record<string, string> }).categories?.[article.category] || article.category;
                        })()}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date((article as { published_at?: string }).published_at || article.created_at).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-SG")}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                      {lang === "ja" ? (article.title_ja || article.title) : (article.title || article.title_ja)}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {lang === "ja" ? (article.excerpt_ja || article.excerpt) : (article.excerpt || article.excerpt_ja)}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold mt-3">
                      {t.common.readMore} <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-10">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border bg-background hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" /> {t.news.prevPage}
              </button>
              <span className="text-sm text-muted-foreground">
                {t.news.pageOf.replace("{page}", String(page)).replace("{total}", String(totalPages))}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border bg-background hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
              >
                {t.news.nextPage} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <Newspaper className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium">{t.news.noArticles}</p>
            <p className="text-sm mt-2">{t.news.noArticlesSub}</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default News;
