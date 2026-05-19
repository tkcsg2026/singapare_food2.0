import type { Metadata } from "next";
import Contact from "@/pages/Contact";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Request a listing on Singapore F&B Portal or contact us with your company details. Required: company name, contact person, email, and phone.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/contact`,
  },
  openGraph: {
    title: "Contact Singapore F&B Portal",
    description:
      "Request a listing or contact us with your company details. We will review your submission and respond.",
    type: "website",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/contact`,
  },
  robots: { index: true, follow: false },
};

export default Contact;
