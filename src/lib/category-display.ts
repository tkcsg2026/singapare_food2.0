import en from "@/locales/en";
import ja from "@/locales/ja";
import type { CategoryRow } from "@/types/database";

/** Resolve EN/JA display strings from DB rows (supports legacy rows where only `label` was set, in Japanese). */
export function getLocaleMapsForCategoryType(type: string): { en: Record<string, string>; ja: Record<string, string> } {
  switch (type) {
    case "supplier":
      return { en: en.suppliers.categories as Record<string, string>, ja: ja.suppliers.categories as Record<string, string> };
    case "marketplace":
      return { en: en.marketplace.categories as Record<string, string>, ja: ja.marketplace.categories as Record<string, string> };
    case "news":
      return { en: en.news.categories as Record<string, string>, ja: ja.news.categories as Record<string, string> };
    case "tag":
      return { en: {}, ja: {} };
    default:
      return { en: {}, ja: {} };
  }
}

function slugToTitleCase(slug: string): string {
  if (!slug.trim()) return "";
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function hasJapaneseOrCJK(s: string): boolean {
  return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uff00-\uffef]/.test(s);
}

export function resolveCategoryDisplayLabels(
  c: Pick<CategoryRow, "type" | "value" | "label"> & { label_ja?: string | null },
  maps?: { en: Record<string, string>; ja: Record<string, string> }
): { enLabel: string; jaLabel: string } {
  const m = maps ?? getLocaleMapsForCategoryType(c.type);
  const jaTrim = (c.label_ja || "").trim();
  const labelTrim = (c.label || "").trim();
  const enByValue = m.en[c.value];
  const jaByValue = m.ja[c.value];

  if (jaTrim) {
    return { enLabel: labelTrim, jaLabel: jaTrim };
  }

  if (jaByValue && labelTrim === jaByValue) {
    return { enLabel: enByValue || slugToTitleCase(c.value), jaLabel: jaByValue };
  }

  if (hasJapaneseOrCJK(labelTrim)) {
    return {
      enLabel: enByValue || slugToTitleCase(c.value),
      jaLabel: labelTrim,
    };
  }

  return { enLabel: labelTrim || slugToTitleCase(c.value), jaLabel: "" };
}

export function getCategoryDisplayName(
  c: Pick<CategoryRow, "type" | "value" | "label"> & { label_ja?: string | null },
  lang: "en" | "ja"
): string {
  const { enLabel, jaLabel } = resolveCategoryDisplayLabels(c);
  if (lang === "ja") return jaLabel || enLabel;
  return enLabel;
}

export type SupplierTagDisplayMaps = { toEn: Record<string, string>; toJa: Record<string, string> };

/** Maps stored tag tokens (value, EN label, JA label) → display labels per language (admin type=tag rows). */
export function buildSupplierTagDisplayMaps(
  tagCategories: (Pick<CategoryRow, "type" | "value" | "label"> & { label_ja?: string | null })[]
): SupplierTagDisplayMaps {
  const toEn: Record<string, string> = {};
  const toJa: Record<string, string> = {};
  for (const cat of tagCategories) {
    const { enLabel, jaLabel } = resolveCategoryDisplayLabels(cat);
    const ja = (jaLabel || "").trim() || enLabel;
    const en = enLabel;
    for (const key of [cat.value, en, ja].filter(Boolean) as string[]) {
      toEn[key] = en;
      toJa[key] = ja;
    }
  }
  return { toEn, toJa };
}
