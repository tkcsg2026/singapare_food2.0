import type { Metadata } from "next";
import MarketplaceItemPage from "@/pages/MarketplaceItem";
import { JsonLd } from "@/components/JsonLd";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { marketplaceItems as mockItems } from "@/data/mockData";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg";

async function getItem(slug: string) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase
      .from("marketplace_items")
      .select("title, title_en, description, description_en, image, price, category, slug")
      .eq("slug", slug)
      .single();
    if (data) return data;
  }
  return (mockItems as any[]).find((i) => i.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await getItem(slug);

  if (!item) {
    return { title: "Item Not Found" };
  }

  const title: string = item.title_en || item.title || slug;
  const description: string =
    (item.description_en || item.description || `${title} — Available on Singapore F&B Marketplace`)
      .slice(0, 160);
  const image: string | undefined = item.image;
  const pageUrl = `${siteUrl}/marketplace/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | F&B Marketplace`,
      description,
      type: "website",
      url: pageUrl,
      images: image ? [{ url: image, alt: title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | F&B Marketplace`,
      description,
      images: image ? [image] : [],
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

export default async function MarketplaceItemRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getItem(slug);

  const jsonLd = item
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: item.title_en || item.title,
        description: item.description_en || item.description || "",
        image: item.image,
        url: `${siteUrl}/marketplace/${slug}`,
        offers: {
          "@type": "Offer",
          price: item.price,
          priceCurrency: "SGD",
          availability: "https://schema.org/InStock",
          url: `${siteUrl}/marketplace/${slug}`,
          seller: {
            "@type": "Person",
            name: item.seller_name || "Seller",
          },
        },
      }
    : null;

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      <MarketplaceItemPage />
    </>
  );
}
