import type { Metadata } from "next";
import Terms from "@/pages/Terms";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Singapore F&B Portal.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://thekitchenconnection.net"}/terms`,
  },
};

export default Terms;
