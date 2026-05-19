/**
 * Supplier category group definitions.
 * Groups are stored in the DB (type = 'supplier-group') and each supplier
 * sub-category has a `parent_group` column linking it to a group's value.
 *
 * This module provides:
 *  - A hardcoded fallback for when the DB is unavailable or groups haven't been seeded yet.
 *  - A `buildDynamicGroups()` helper that constructs groups from fetched CategoryRow data.
 */

import type { CategoryRow, SupplierRow } from "@/types/database";

export interface CategoryGroup {
  key: string;
  labelEn: string;
  labelJa: string;
  /** Ordered list of sub-category values belonging to this group */
  children: string[];
}

/** Hardcoded fallback — used when DB data is unavailable */
export const FALLBACK_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    key: "food-supplies",
    labelEn: "Food & Supplies",
    labelJa: "食材・供給品",
    children: ["meat-poultry", "seafood", "produce-dry-goods", "beverages"],
  },
  {
    key: "kitchen-hardware",
    labelEn: "Kitchen & Hardware",
    labelJa: "厨房・設備",
    children: ["kitchen-equipment", "furniture-interior"],
  },
  {
    key: "tech-pos",
    labelEn: "Tech & POS",
    labelJa: "テクノロジー",
    children: ["pos-systems", "crm", "inventory", "online-ordering"],
  },
  {
    key: "professional-services",
    labelEn: "Professional Services",
    labelJa: "専門サービス",
    children: ["services-maintenance", "consultancy-marketing"],
  },
];

/**
 * Build category groups dynamically from DB rows.
 *
 * In addition to the explicit groups, any supplier sub-category whose
 * `parent_group` is empty / unknown is appended to a synthesised "Other"
 * group so newly added categories still appear in the filter UI even when
 * the admin has not assigned them to a parent group yet.
 *
 * @param groupRows  - rows with type = 'supplier-group'
 * @param supplierRows - rows with type = 'supplier' (each has parent_group)
 * @returns ordered CategoryGroup[] — falls back to FALLBACK_CATEGORY_GROUPS when no group rows exist
 */
export function buildDynamicGroups(
  groupRows: CategoryRow[],
  supplierRows: CategoryRow[]
): CategoryGroup[] {
  // No groups in DB yet → use the hardcoded fallback list, but still surface
  // any extra supplier sub-categories that aren't covered by it under "Other".
  if (!groupRows || groupRows.length === 0) {
    const fallback = FALLBACK_CATEGORY_GROUPS.map((g) => ({ ...g, children: [...g.children] }));
    const known = new Set(fallback.flatMap((g) => g.children));
    const extras = supplierRows
      .filter((c) => c.value && !known.has(c.value))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => c.value);
    if (extras.length > 0) {
      fallback.push({
        key: "other",
        labelEn: "Other",
        labelJa: "その他",
        children: extras,
      });
    }
    return fallback;
  }

  const sorted = [...groupRows].sort((a, b) => a.sort_order - b.sort_order);
  const groupValues = new Set(sorted.map((g) => g.value));

  const groups: CategoryGroup[] = sorted.map((g) => {
    const children = supplierRows
      .filter((c) => (c.parent_group || "") === g.value)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => c.value);

    return {
      key: g.value,
      labelEn: g.label,
      labelJa: g.label_ja || g.label,
      children,
    };
  });

  // Catch-all bucket for sub-categories that don't reference a known group
  const orphans = supplierRows
    .filter((c) => {
      const pg = c.parent_group || "";
      return !pg || !groupValues.has(pg);
    })
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => c.value);

  if (orphans.length > 0) {
    groups.push({
      key: "other",
      labelEn: "Other",
      labelJa: "その他",
      children: orphans,
    });
  }

  return groups;
}

/**
 * Map from old category value → new category value (for backward compatibility).
 *
 * NOTE: We intentionally do **not** map `packaging` here.  `packaging` is a
 * standalone supplier category that admins may add via Category Management;
 * mapping it to another value would cause those suppliers to disappear when
 * the user filters by "Packaging".
 */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  meat: "meat-poultry",
  vegetables: "produce-dry-goods",
  dairy: "produce-dry-goods",
  "dry-goods": "produce-dry-goods",
  equipment: "kitchen-equipment",
  seafood: "seafood",
  beverages: "beverages",
};

/**
 * Ensures every category value used by at least one supplier appears in the
 * filter / dropdown lists even when the `categories` table was not updated yet
 * (e.g. new "packaging" rows added only on supplier records).
 */
export function augmentSupplierCategoriesFromRows(
  base: CategoryRow[] | undefined,
  suppliers: SupplierRow[] | undefined,
): CategoryRow[] {
  const rows: CategoryRow[] = [...(base || [])];
  const seen = new Set(rows.map((r) => r.value));

  for (const s of suppliers || []) {
    for (const raw of [s.category, s.category_2, s.category_3]) {
      if (!raw) continue;
      const normalized = LEGACY_CATEGORY_MAP[raw] ?? raw;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      const pretty = normalized
        .split("-")
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(" ");
      rows.push({
        id: `__syn_${normalized}`,
        type: "supplier",
        value: normalized,
        label: pretty,
        label_ja: pretty,
        sort_order: 10_000 + rows.length,
        parent_group: "",
      });
    }
  }

  return rows.sort((a, b) => a.sort_order - b.sort_order);
}

/** Look up which group a sub-category belongs to */
export function findGroupForCategory(
  value: string,
  groups: CategoryGroup[] = FALLBACK_CATEGORY_GROUPS
): CategoryGroup | undefined {
  return groups.find((g) => g.children.includes(value));
}

/** Get group label by language */
export function getGroupLabel(group: CategoryGroup, lang: "en" | "ja"): string {
  return lang === "ja" ? group.labelJa : group.labelEn;
}
