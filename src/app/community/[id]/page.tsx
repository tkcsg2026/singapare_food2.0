import type { Metadata } from "next";
import CommunityThread from "@/pages/CommunityThread";
import { JsonLd } from "@/components/JsonLd";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg";

/**
 * Reads the thread for metadata / structured data only. Uses the anon client,
 * so RLS keeps hidden threads out of search results — the page itself still
 * renders them for their author via the API.
 */
async function getThread(id: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("community_threads")
    .select("id, title, content, category, author_name, created_at, last_reply_at, reply_count, status")
    .eq("id", id)
    .eq("status", "active")
    .single();
  return data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const thread = await getThread(id).catch(() => null);

  if (!thread) {
    return { title: "F&B Community", robots: { index: false, follow: true } };
  }

  const title: string = thread.title || "F&B Community";
  const description = String(thread.content || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const pageUrl = `${siteUrl}/community/${id}`;

  return {
    title,
    description: description || "Singapore F&B community discussion.",
    openGraph: {
      title: `${title} | F&B Community`,
      description: description || "Singapore F&B community discussion.",
      type: "article",
      url: pageUrl,
    },
    alternates: { canonical: pageUrl },
  };
}

export default async function CommunityThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const thread = await getThread(id).catch(() => null);

  const jsonLd = thread
    ? {
        "@context": "https://schema.org",
        "@type": "DiscussionForumPosting",
        headline: thread.title,
        text: String(thread.content || "").slice(0, 500),
        url: `${siteUrl}/community/${id}`,
        datePublished: thread.created_at,
        dateModified: thread.last_reply_at || thread.created_at,
        commentCount: thread.reply_count ?? 0,
        author: {
          "@type": "Person",
          name: thread.author_name || "Member",
        },
        isPartOf: {
          "@type": "WebSite",
          name: "Singapore F&B Portal",
          url: siteUrl,
        },
      }
    : null;

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      <CommunityThread />
    </>
  );
}
