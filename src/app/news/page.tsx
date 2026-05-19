import type { Metadata } from "next";
import News from "@/pages/News";

export const metadata: Metadata = {
  title: "F&B Industry News",
  description:
    "Latest news and updates from Singapore's F&B industry. Stay informed on regulations, trends, events, and supplier news from the Singapore food and beverage sector.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/news`,
  },
  openGraph: {
    title: "F&B Industry News | Singapore F&B Portal",
    description:
      "Latest news from Singapore's F&B industry — regulations, trends, events, and supplier updates.",
    type: "website",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/news`,
  },
};

export default function NewsPage() {
  return <News />;
}
