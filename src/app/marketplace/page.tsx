import type { Metadata } from "next";
import Marketplace from "@/pages/Marketplace";

export const metadata: Metadata = {
  title: "F&B Marketplace — Buy & Sell Used Equipment",
  description:
    "Singapore's chef flea market. Buy and sell used F&B equipment, kitchenware, and supplies. Browse listings from chefs and restaurant operators across Singapore.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/marketplace`,
  },
  openGraph: {
    title: "F&B Marketplace — Buy & Sell | Singapore F&B Portal",
    description:
      "Buy and sell used F&B equipment and kitchenware. Browse listings from chefs and restaurant operators across Singapore.",
    type: "website",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/marketplace`,
  },
};

export default function MarketplacePage() {
  return <Marketplace />;
}
