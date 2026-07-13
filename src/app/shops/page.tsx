import type { Metadata } from "next";
import ShopListings from "@/pages/ShopListings";

export const metadata: Metadata = {
  title: "Shops for Rent / Takeover — F&B Spaces in Singapore",
  description:
    "Find F&B shop spaces for rent and businesses for takeover across Singapore. Browse restaurant, café, and bakery premises listed by owners and operators.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/shops`,
  },
  openGraph: {
    title: "Shops for Rent / Takeover | Singapore F&B Portal",
    description:
      "Find F&B shop spaces for rent and businesses for takeover across Singapore. Browse restaurant, café, and bakery premises listed by owners and operators.",
    type: "website",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/shops`,
  },
};

export default function ShopListingsPage() {
  return <ShopListings />;
}
