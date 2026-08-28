import type { Metadata } from "next";
import Community from "@/pages/Community";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg";

export const metadata: Metadata = {
  title: "F&B Community — Singapore F&B Forum",
  description:
    "A discussion board for Singapore's F&B industry. Ask about shop operations, suppliers, staff, equipment and collaboration — every thread stays searchable.",
  alternates: {
    canonical: `${siteUrl}/community`,
  },
  openGraph: {
    title: "F&B Community | Singapore F&B Portal",
    description:
      "Ask questions, share supplier tips and swap notes with Singapore's F&B people.",
    type: "website",
    url: `${siteUrl}/community`,
  },
  robots: { index: true, follow: true },
};

export default function CommunityPage() {
  return <Community />;
}
