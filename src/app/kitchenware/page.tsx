import type { Metadata } from "next";
import KitchenwareRetailers from "@/pages/KitchenwareRetailers";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg";

export const metadata: Metadata = {
  title: "Kitchenware & tableware — Singapore retailers",
  description:
    "Curated links to Singapore kitchenware, cookware, and tableware retailers. Inspiration tiles use stock imagery; shop on each brand's official site.",
  alternates: { canonical: `${siteUrl}/kitchenware` },
  openGraph: {
    title: "Kitchenware retailers | F&B Portal",
    description: "Discover trusted Singapore retailers for kitchen and tableware.",
    url: `${siteUrl}/kitchenware`,
    type: "website",
  },
  robots: { index: false, follow: false },
};

export default KitchenwareRetailers;
