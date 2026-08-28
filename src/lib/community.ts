/**
 * Shared constants for the F&B Community forum.
 *
 * Categories are deliberately kept small and fixed — finer-grained detail is
 * expressed with tags, so the board stays browsable as it grows.
 */

export const COMMUNITY_CATEGORIES = [
  "general",
  "suppliers",
  "staff",
  "shop",
  "equipment",
  "business",
  "collaboration",
] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export function isCommunityCategory(value: unknown): value is CommunityCategory {
  return (
    typeof value === "string" &&
    (COMMUNITY_CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * Suggested tags shown as quick-pick chips on the post form and as filters on
 * the board. Users may also type their own, so this list is a starting point
 * rather than a whitelist.
 */
export const COMMUNITY_SUGGESTED_TAGS = [
  "Restaurant",
  "Cafe",
  "Bar",
  "Supplier",
  "Hiring",
  "Halal",
  "Japanese Food",
  "Central Area",
] as const;

export const COMMUNITY_MAX_TAGS = 5;
export const COMMUNITY_TITLE_MAX = 140;
export const COMMUNITY_CONTENT_MAX = 8000;
export const COMMUNITY_REPLY_MAX = 4000;
export const COMMUNITY_TAG_MAX = 30;

/** Trims, de-duplicates (case-insensitively) and caps a raw tag list. */
export function normaliseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const tag = entry.trim().replace(/\s+/g, " ").slice(0, COMMUNITY_TAG_MAX);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= COMMUNITY_MAX_TAGS) break;
  }
  return out;
}

/** Splits a free-text tag input ("Cafe, Halal") into individual tags. */
export function parseTagInput(value: string): string[] {
  return normaliseTags(value.split(/[,、，]/));
}

/** Human-friendly "3 hours ago" style label used across the forum UI. */
export function formatRelativeTime(iso: string, lang: "en" | "ja"): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return lang === "ja" ? "たった今" : "just now";
  if (diff < hour) {
    const n = Math.floor(diff / minute);
    return lang === "ja" ? `${n}分前` : `${n}m ago`;
  }
  if (diff < day) {
    const n = Math.floor(diff / hour);
    return lang === "ja" ? `${n}時間前` : `${n}h ago`;
  }
  if (diff < 30 * day) {
    const n = Math.floor(diff / day);
    return lang === "ja" ? `${n}日前` : `${n}d ago`;
  }
  return new Date(iso).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-SG");
}
