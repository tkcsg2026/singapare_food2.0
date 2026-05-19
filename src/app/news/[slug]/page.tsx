import type { Metadata } from "next";
import NewsDetail from "@/pages/NewsDetail";
import { JsonLd } from "@/components/JsonLd";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg";

async function getArticle(slug: string) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase
      .from("news_articles")
      .select("title, excerpt, image, author, published_at, created_at, slug")
      .eq("slug", slug)
      .single();
    if (data) return data;
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    return { title: "Article Not Found" };
  }

  const title: string = article.title || slug;
  const description: string = (article.excerpt || `${title} — Singapore F&B Portal News`).slice(0, 160);
  const image: string | undefined = (article as any).image;
  const pageUrl = `${siteUrl}/news/${slug}`;
  const publishedTime: string | undefined = (article as any).published_at || article.created_at;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | F&B Portal News`,
      description,
      type: "article",
      url: pageUrl,
      images: image ? [{ url: image, alt: title }] : [],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | F&B Portal News`,
      description,
      images: image ? [image] : [],
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticle(slug);

  const jsonLd = article
    ? {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: article.title,
        description: article.excerpt || "",
        image: (article as any).image ? [(article as any).image] : [],
        url: `${siteUrl}/news/${slug}`,
        datePublished: (article as any).published_at || article.created_at,
        dateModified: (article as any).published_at || article.created_at,
        author: {
          "@type": "Organization",
          name: article.author || "F&B Portal",
          url: siteUrl,
        },
        publisher: {
          "@type": "Organization",
          name: "Singapore F&B Portal",
          url: siteUrl,
          logo: {
            "@type": "ImageObject",
            url: `${siteUrl}/logo.png`,
          },
        },
        isPartOf: {
          "@type": "WebSite",
          name: "Singapore F&B Portal",
          url: siteUrl,
        },
      }
    : null;

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      <NewsDetail />
    </>
  );
}
