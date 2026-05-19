"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, Calendar, User } from "lucide-react";
import Layout from "@/components/Layout";
import { useFetch } from "@/hooks/useSupabaseData";
import { useTranslation } from "@/contexts/LanguageContext";
import { resolveNewsAuthor } from "@/lib/news-author";

const NewsDetail = () => {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { data: article, loading } = useFetch<any>(`/api/news/${slug}`, [slug]);
  const { t, lang } = useTranslation();

  const title = article && !article.error && (lang === "ja" ? (article.title_ja || article.title) : (article.title || article.title_ja));
  const excerpt = article && !article.error && (lang === "ja" ? (article.excerpt_ja || article.excerpt) : (article.excerpt || article.excerpt_ja));

  useEffect(() => {
    if (!title) return;
    document.title = `${title} | ${lang === "ja" ? "F&Bポータル" : "F&B Portal"}`;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (excerpt) {
      if (!metaDesc) {
        metaDesc = document.createElement("meta");
        metaDesc.setAttribute("name", "description");
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute("content", excerpt.slice(0, 160));
    }
    return () => {
      document.title = lang === "ja" ? "F&Bポータル" : "F&B Portal";
    };
  }, [title, excerpt, lang]);

  if (loading) return <Layout><div className="container py-16 text-center text-muted-foreground">{t.common.loading}</div></Layout>;

  if (!article || article.error) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">{t.newsDetail.notFound}</p>
          <Link href="/news" className="text-primary hover:underline mt-4 inline-block">{t.newsDetail.backToList}</Link>
        </div>
      </Layout>
    );
  }

  const displayTitle = lang === "ja" ? (article.title_ja || article.title) : (article.title || article.title_ja);
  const content = lang === "ja" ? (article.content_ja || article.content || "") : (article.content || article.content_ja || "");
  const categoryLabel = (t.news as { categories?: Record<string, string> }).categories?.[article.category] ?? article.category;
  const displayAuthor = resolveNewsAuthor(article.author, lang as "ja" | "en");

  return (
    <Layout>
      <div className="container max-w-3xl py-6">
        <Link href="/news" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 font-medium">
          <ArrowLeft className="h-4 w-4" /> {t.newsDetail.backToList}
        </Link>

        {article.image && (
          <div className="aspect-[16/9] rounded-2xl overflow-hidden mb-8">
            <img src={article.image} alt={displayTitle} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <span className="tag-badge">{categoryLabel}</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(article.published_at || article.created_at).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-SG")}
          </span>
          {displayAuthor && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {displayAuthor}
            </span>
          )}
        </div>

        <h1 className="text-3xl font-black tracking-tight mb-6">{displayTitle}</h1>

        <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
          {content.split("\n").map((p: string, i: number) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default NewsDetail;
