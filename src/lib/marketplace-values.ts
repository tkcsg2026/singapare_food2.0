/**
 * Canonical keys for the Buy & Sell columns that are stored as display text.
 *
 * `condition`, `area` and `delivery` hold whatever the poster's UI language
 * rendered — "良好" from the JA form, "Good" from the EN one — while the filter
 * dropdowns are keyed by slug. Comparing the two directly never matched, so the
 * condition filter silently returned nothing. These maps fold every spelling of
 * a value onto one key so rows posted in either language filter alike.
 *
 * Category is handled separately: its aliases come from the `categories` table
 * (see `buildCategoryAliases`) rather than a hard-coded list, so a category
 * added from the admin panel is folded too.
 */

export const MARKETPLACE_CONDITIONS = ["like-new", "good", "used", "needs-repair"] as const;
export type MarketplaceCondition = (typeof MARKETPLACE_CONDITIONS)[number];

/** Lower-cased spelling → canonical key. Covers slug, JA label and EN label. */
const CONDITION_ALIASES: Record<string, MarketplaceCondition> = {
  "like-new": "like-new",
  "like new": "like-new",
  "新品同様": "like-new",
  "新品": "like-new",
  good: "good",
  "良好": "good",
  used: "used",
  "使用感あり": "used",
  "needs-repair": "needs-repair",
  "needs repair": "needs-repair",
  "要修理": "needs-repair",
};

/**
 * Canonical condition key for a stored value, or "" when it matches nothing
 * known — an unrecognised value must not accidentally match a filter.
 */
export function conditionKey(raw: string | null | undefined): string {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key) return "";
  return CONDITION_ALIASES[key] ?? "";
}

/** Category rows as the /api/categories route returns them (labels resolved). */
type CategoryLike = { value: string; label?: string | null; label_ja?: string | null };

/**
 * Lower-cased label/value → category value, built from the live category list
 * so legacy rows that stored a display label ("厨房機器") match the option whose
 * value is the slug ("kitchen-equipment").
 */
export function buildCategoryAliases(categories: CategoryLike[] | null | undefined): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const category of categories ?? []) {
    const value = (category.value ?? "").trim();
    if (!value) continue;
    for (const spelling of [value, category.label, category.label_ja]) {
      const key = (spelling ?? "").trim().toLowerCase();
      if (key) aliases.set(key, value);
    }
  }
  return aliases;
}

/**
 * Canonical category value for a stored value. "other:Signage" — what the post
 * form writes when a member types their own category — collapses to "other" so
 * those posts appear under the Other filter.
 */
export function categoryKey(raw: string | null | undefined, aliases: Map<string, string>): string {
  const stored = (raw ?? "").trim().toLowerCase();
  if (!stored) return "";
  const base = stored.startsWith("other:") ? "other" : stored;
  return aliases.get(base) ?? base;
}
