import type { Metadata } from "next";
import ShopListingDetail from "@/pages/ShopListingDetail";
import { JsonLd } from "@/components/JsonLd";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg";

async function getListing(slug: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("shop_listings")
    .select("title, description, image, listing_type, location, slug")
    .eq("slug", slug)
    .eq("status", "approved")
    .single();
  return data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListing(slug);

  if (!listing) {
    return { title: "Shop Listing" };
  }

  const title: string = listing.title || slug;
  const description: string = (
    listing.description || `${title} — Shop for rent/takeover on Singapore F&B Portal`
  ).slice(0, 160);
  const image: string | undefined = listing.image;
  const pageUrl = `${siteUrl}/shops/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Shops for Rent / Takeover`,
      description,
      type: "website",
      url: pageUrl,
      images: image ? [{ url: image, alt: title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Shops for Rent / Takeover`,
      description,
      images: image ? [image] : [],
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

export default async function ShopListingRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await getListing(slug);

  const jsonLd = listing
    ? {
        "@context": "https://schema.org",
        "@type": "Offer",
        name: listing.title,
        description: listing.description || "",
        image: listing.image,
        url: `${siteUrl}/shops/${slug}`,
        category: listing.listing_type === "rent" ? "Shop for Rent" : "Business Takeover",
        areaServed: listing.location || "Singapore",
      }
    : null;

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      <ShopListingDetail />
    </>
  );
}
