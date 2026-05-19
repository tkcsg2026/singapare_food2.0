import type { Metadata } from "next";
import About from "@/pages/About";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about Singapore F&B Portal — the platform connecting restaurants, chefs, and food suppliers across Singapore. Discover our mission to strengthen the F&B supply chain.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/about`,
  },
  openGraph: {
    title: "About Singapore F&B Portal | The Kitchen Connection",
    description:
      "Connecting Singapore's restaurants, chefs, and food suppliers. Learn about our mission to strengthen the F&B supply chain.",
    type: "website",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/about`,
  },
};


export default About;
