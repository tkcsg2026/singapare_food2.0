import type { MetadataRoute } from "next";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg";

const staticRoutes: MetadataRoute.Sitemap = [
  { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
  { url: `${siteUrl}/suppliers`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  { url: `${siteUrl}/marketplace`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  { url: `${siteUrl}/news`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  { url: `${siteUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  { url: `${siteUrl}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  { url: `${siteUrl}/jobs`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.55 },
  { url: `${siteUrl}/plans`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServerSupabaseClient();

  let supplierRoutes: MetadataRoute.Sitemap = [];
  let marketplaceRoutes: MetadataRoute.Sitemap = [];
  let newsRoutes: MetadataRoute.Sitemap = [];

  if (supabase) {
    const [suppliersResult, marketplaceResult, newsResult] = await Promise.all([
      supabase.from("suppliers").select("slug, created_at").order("created_at", { ascending: false }),
      supabase
        .from("marketplace_items")
        .select("slug, created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
      supabase
        .from("news_articles")
        .select("slug, published_at, created_at")
        .eq("published", true)
        .order("created_at", { ascending: false }),
    ]);

    supplierRoutes = (suppliersResult.data ?? []).map((s) => ({
      url: `${siteUrl}/suppliers/${s.slug}`,
      lastModified: new Date(s.created_at),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    marketplaceRoutes = (marketplaceResult.data ?? []).map((i) => ({
      url: `${siteUrl}/marketplace/${i.slug}`,
      lastModified: new Date(i.created_at),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    newsRoutes = (newsResult.data ?? []).map((a) => ({
      url: `${siteUrl}/news/${a.slug}`,
      lastModified: new Date((a as any).published_at || a.created_at),
      changeFrequency: "monthly",
      priority: 0.7,
    }));
  }

  return [...staticRoutes, ...supplierRoutes, ...marketplaceRoutes, ...newsRoutes];
}
