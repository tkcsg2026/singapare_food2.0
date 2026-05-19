import type { Metadata } from "next";
import Privacy from "@/pages/Privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Singapore F&B Portal — learn how we collect, use, and protect your data.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://thekitchenconnection.net"}/privacy`,
  },
};

export default Privacy;
