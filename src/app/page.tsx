import Index from "@/pages/Index";
import { JsonLd } from "@/components/JsonLd";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Singapore F&B Portal",
  alternateName: "F&B Portal",
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  description:
    "Singapore's premier F&B supplier discovery platform connecting restaurants, chefs, and trusted food suppliers.",
  sameAs: [],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: `${siteUrl}/contact`,
    availableLanguage: ["English", "Japanese"],
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Singapore F&B Portal",
  url: siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/suppliers?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <JsonLd data={websiteJsonLd} />
      <Index />
    </>
  );
}
