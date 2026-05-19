import type { Metadata } from "next";
import SupplierDetail from "@/pages/SupplierDetail";
import { JsonLd } from "@/components/JsonLd";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { suppliers as mockSuppliers } from "@/data/mockData";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg";

async function getSupplier(slug: string) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase
      .from("suppliers")
      .select("name, description, logo, area, category, slug, whatsapp, certifications")
      .eq("slug", slug)
      .single();
    if (data) return data;
  }
  return (mockSuppliers as any[]).find((s) => s.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supplier = await getSupplier(slug);

  if (!supplier) {
    return { title: "Supplier Not Found" };
  }

  const name: string = supplier.name || supplier.name_ja || slug;
  const description: string =
    (supplier.description || supplier.description_ja || `${name} — Singapore F&B Supplier`)
      .slice(0, 160);
  const image: string | undefined = supplier.logo;
  const pageUrl = `${siteUrl}/suppliers/${slug}`;

  return {
    title: name,
    description,
    openGraph: {
      title: `${name} | Singapore F&B Portal`,
      description,
      type: "profile",
      url: pageUrl,
      images: image ? [{ url: image, alt: name }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} | Singapore F&B Portal`,
      description,
      images: image ? [image] : [],
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supplier = await getSupplier(slug);

  const jsonLd = supplier
    ? {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "@id": `${siteUrl}/suppliers/${slug}`,
        name: supplier.name || supplier.name_ja,
        description: supplier.description || supplier.description_ja || "",
        url: `${siteUrl}/suppliers/${slug}`,
        image: supplier.logo,
        address: {
          "@type": "PostalAddress",
          addressLocality: supplier.area || "Singapore",
          addressCountry: "SG",
        },
        areaServed: "Singapore",
        ...(supplier.whatsapp
          ? { telephone: supplier.whatsapp }
          : {}),
      }
    : null;

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      <SupplierDetail />
    </>
  );
}
