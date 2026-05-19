import type { Metadata } from "next";
import JobVacancies from "@/pages/JobVacancies";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg";

export const metadata: Metadata = {
  title: "Job Vacancies",
  description:
    "Free F&B job notice board for Singapore. Choose structured options, describe the role, and send your listing via WhatsApp.",
  alternates: {
    canonical: `${siteUrl}/jobs`,
  },
  openGraph: {
    title: "Job Vacancies | F&B Portal",
    description:
      "Post a simple F&B job notice with structured fields and send it via WhatsApp.",
    type: "website",
    url: `${siteUrl}/jobs`,
  },
  robots: { index: true, follow: true },
};

export default JobVacancies;
