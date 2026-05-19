import type { Metadata } from "next";
import { Suspense } from "react";
import Suppliers from "@/pages/Suppliers";

export const metadata: Metadata = {
  title: "Supplier Directory",
  description:
    "Browse Singapore's trusted F&B suppliers. Filter by category, area, and certifications. Find halal-certified, organic, and specialty ingredient suppliers for your restaurant or food business.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/suppliers`,
  },
  openGraph: {
    title: "Singapore F&B Supplier Directory | F&B Portal",
    description:
      "Browse Singapore's trusted F&B suppliers. Find halal-certified, organic, and specialty ingredient suppliers for your restaurant.",
    type: "website",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/suppliers`,
  },
};

export default function SuppliersPage() {
  return (
    <Suspense fallback={<div className="container py-16 text-center text-muted-foreground">読み込み中...</div>}>
      <Suppliers />
    </Suspense>
  );
}
