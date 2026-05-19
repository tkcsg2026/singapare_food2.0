"use client";
import { useState, useMemo, useEffect } from "react";
import { Search, SlidersHorizontal, X, LayoutGrid, List } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { AnimatedGridItem } from "@/components/AnimatedGridItem";
import { SupplierCard } from "@/components/SupplierCard";
import { useFetch } from "@/hooks/useSupabaseData";
import { useTranslation } from "@/contexts/LanguageContext";
import { sortSuppliersByPlan } from "@/lib/plans";
import type { PlanCounts } from "@/lib/plans";
import { buildSupplierTagDisplayMaps, getCategoryDisplayName } from "@/lib/category-display";
import { buildDynamicGroups, LEGACY_CATEGORY_MAP, getGroupLabel, augmentSupplierCategoriesFromRows } from "@/lib/category-groups";
import type { SupplierRow, CategoryRow } from "@/types/database";

const Suppliers = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams?.get("q") || "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams?.get("category") ? [searchParams.get("category")!] : []
  );
  const [selectedPlan, setSelectedPlan] = useState<string>(searchParams?.get("plan") || "");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showAllTags, setShowAllTags] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { t, lang } = useTranslation();

  useEffect(() => {
    const plan = searchParams?.get("plan") || "";
    setSelectedPlan(plan);
  }, [searchParams]);

  const setPlanFilter = (plan: string) => {
    setSelectedPlan(plan);
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (plan) params.set("plan", plan);
    else params.delete("plan");
    router.replace(`/suppliers?${params.toString()}`, { scroll: false });
  };

  const { data: suppliers } = useFetch<SupplierRow[]>("/api/suppliers");
  const { data: planCountsData } = useFetch<PlanCounts>("/api/suppliers/plan-counts");
  const planCounts: PlanCounts = planCountsData ?? { premium: 0, standard: 0, basic: 0 };
  const { data: categories } = useFetch<CategoryRow[]>("/api/categories?type=supplier");
  const { data: groupRows } = useFetch<CategoryRow[]>("/api/categories?type=supplier-group");
  const { data: tagCategories } = useFetch<(CategoryRow & { type: "tag"; label_ja?: string | null })[]>("/api/categories?type=tag");

  // Surface every category value used by at least one supplier — including
  // newly-added ones (e.g. "packaging") that haven't been added to the
  // categories table yet — so they appear in the filter UI.
  const categoriesForUi = useMemo(
    () => augmentSupplierCategoriesFromRows(categories || [], suppliers || []),
    [categories, suppliers]
  );

  const categoryGroups = useMemo(
    () => buildDynamicGroups(groupRows || [], categoriesForUi),
    [groupRows, categoriesForUi]
  );
  const tagDisplayMaps = useMemo(() => buildSupplierTagDisplayMaps(tagCategories || []), [tagCategories]);

  const areas = [
    { value: "central", label: t.suppliers.areas.central },
    { value: "east",    label: t.suppliers.areas.east },
    { value: "west",    label: t.suppliers.areas.west },
    { value: "north",   label: t.suppliers.areas.north },
    { value: "south",   label: t.suppliers.areas.south },
  ];

  const toggleCategory = (val: string) =>
    setSelectedCategories((prev) => prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val]);
  const toggleArea = (val: string) =>
    setSelectedAreas((prev) => prev.includes(val) ? prev.filter((a) => a !== val) : [...prev, val]);
  const toggleTag = (val: string) =>
    setSelectedTags((prev) => prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val]);

  // Pull every category-like value the supplier has (EN + JA slots) and
  // legacy-map it. Including the *_ja columns is what makes a "Packaging"
  // filter match a supplier tagged only as "包装", and it ensures any future
  // category added by the admin works without code changes.
  const supplierCategories = (s: SupplierRow) =>
    [s.category, s.category_2, s.category_3, s.category_ja, s.category_2_ja, s.category_3_ja]
      .filter(Boolean)
      .map((c) => LEGACY_CATEGORY_MAP[c!] ?? c!);

  /** Aggressive normalisation so "Packaging", "packaging", " Packaging "
   *  and even "packaging-supplies" fingerprint the same way. */
  const normalizeCat = (s: string) =>
    (s || "").trim().toLowerCase().replace(/[\s\-_./]+/g, "");

  /** All accepted aliases for a selected filter value (its value, label, label_ja
   *  in lowercase / normalised form). A supplier matches when *any* of its
   *  stored category strings normalises into this set. */
  const categoryMatchSet = (filterValue: string): Set<string> => {
    const out = new Set<string>();
    const push = (v?: string | null) => {
      const n = normalizeCat(v ?? "");
      if (n) out.add(n);
    };
    push(filterValue);
    push(LEGACY_CATEGORY_MAP[filterValue]);
    const row = categoriesForUi.find((c) => c.value === filterValue);
    if (row) {
      push(row.value);
      push(row.label);
      push(row.label_ja || "");
    }
    return out;
  };
  const sortedTagCategories = useMemo(
    () => [...(tagCategories || [])].sort((a, b) => a.sort_order - b.sort_order),
    [tagCategories]
  );
  const visibleTagCategories = showAllTags ? sortedTagCategories : sortedTagCategories.slice(0, 3);
  const matchSelectedTag = (supplier: SupplierRow, tagValue: string): boolean => {
    const row = sortedTagCategories.find((c) => c.value === tagValue);
    if (!row) return false;
    const en = tagDisplayMaps.toEn[row.value] || row.label;
    const ja = tagDisplayMaps.toJa[row.value] || row.label_ja || row.label;
    const candidates = new Set([row.value, row.label, row.label_ja || "", en, ja].filter(Boolean));
    return (supplier.tags ?? []).some((rawTag) => {
      const tagEn = tagDisplayMaps.toEn[rawTag] || rawTag;
      const tagJa = tagDisplayMaps.toJa[rawTag] || rawTag;
      return candidates.has(rawTag) || candidates.has(tagEn) || candidates.has(tagJa);
    });
  };

  const filtered = useMemo(() => {
    const base = (suppliers || []).filter((s) => {
      if (selectedPlan && (s.plan || "basic") !== selectedPlan) return false;
      if (query) {
        const q = query.toLowerCase();
        const matchName = s.name_ja?.includes(query) || s.name?.toLowerCase().includes(q);
        const matchDesc = s.description_ja?.includes(query) || s.description?.toLowerCase().includes(q);
        const matchCat = [s.category_ja, s.category_2_ja, s.category_3_ja, s.category, s.category_2, s.category_3].some((c) => c && (String(c).includes(query) || String(c).toLowerCase().includes(q)));
        if (!matchName && !matchDesc && !matchCat) return false;
      }
      if (selectedCategories.length) {
        const supplierCats = supplierCategories(s).map(normalizeCat);
        const anyMatch = selectedCategories.some((sel) => {
          const set = categoryMatchSet(sel);
          return supplierCats.some((sc) => set.has(sc));
        });
        if (!anyMatch) return false;
      }
      if (selectedAreas.length && !selectedAreas.includes(s.area)) return false;
      if (selectedTags.length && !selectedTags.every((tagValue) => matchSelectedTag(s, tagValue))) return false;
      return true;
    });
    // Sort by plan tier, shuffle within each tier with a daily seed
    return sortSuppliersByPlan(base);
  }, [suppliers, query, selectedCategories, selectedAreas, selectedPlan, selectedTags, sortedTagCategories, tagDisplayMaps]);

  const FilterPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-bold text-sm mb-3">{t.suppliers.plan}</h3>
        <div className="space-y-2.5">
          {[
            { value: "", label: t.common.all },
            { value: "premium", label: `${t.suppliers.planPremium} (${planCounts.premium})` },
            { value: "standard", label: `${t.suppliers.planStandard} (${planCounts.standard})` },
            { value: "basic", label: `${t.suppliers.planBasic} (${planCounts.basic})` },
          ].map(({ value, label }) => (
            <label key={value || "all"} className="flex items-center gap-2.5 text-sm cursor-pointer hover:text-foreground transition-colors">
              <input type="radio" name="plan" checked={selectedPlan === value} onChange={() => setPlanFilter(value)} className="rounded-full border-border accent-primary" />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-bold text-sm mb-3">{t.suppliers.category}</h3>
        <div className="space-y-4">
          {categoryGroups.map((group) => {
            const groupCats = group.children
              .map((val) => categoriesForUi.find((c) => c.value === val))
              .filter(Boolean) as CategoryRow[];
            if (groupCats.length === 0) return null;
            return (
              <div key={group.key}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  {getGroupLabel(group, lang)}
                </p>
                <div className="space-y-2 pl-1">
                  {groupCats.map((cat) => (
                    <label key={cat.value} className="flex items-center gap-2.5 text-sm cursor-pointer hover:text-foreground transition-colors">
                      <input type="checkbox" checked={selectedCategories.includes(cat.value)} onChange={() => toggleCategory(cat.value)} className="rounded border-border accent-primary" />
                      {getCategoryDisplayName(cat, lang)}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="font-bold text-sm mb-3">{t.suppliers.area}</h3>
        <div className="space-y-2.5">
          {areas.map((area) => (
            <label key={area.value} className="flex items-center gap-2.5 text-sm cursor-pointer hover:text-foreground transition-colors">
              <input type="checkbox" checked={selectedAreas.includes(area.value)} onChange={() => toggleArea(area.value)} className="rounded border-border accent-primary" />
              {area.label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-bold text-sm mb-3">{t.suppliers.tags}</h3>
        <div className="space-y-2.5">
          {visibleTagCategories.map((tag) => (
            <label key={tag.value} className="flex items-center gap-2.5 text-sm cursor-pointer hover:text-foreground transition-colors">
              <input
                type="checkbox"
                checked={selectedTags.includes(tag.value)}
                onChange={() => toggleTag(tag.value)}
                className="rounded border-border accent-primary"
              />
              {getCategoryDisplayName(tag, lang)}
            </label>
          ))}
          {sortedTagCategories.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllTags((prev) => !prev)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {showAllTags
                ? (lang === "ja" ? "一部のみ表示" : "Show less")
                : `${t.common.viewAll} (${sortedTagCategories.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="container py-8 min-w-0 overflow-hidden w-full">
        <div className="mb-8 min-w-0 section-heading-enter">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight break-words-safe">{t.suppliers.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.suppliers.subtitle}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input type="text" placeholder={t.suppliers.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} className="w-full min-h-[44px] h-12 pl-10 pr-4 rounded-xl border bg-background text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ui-filter-control" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="md:hidden min-h-[44px] h-12 px-4 rounded-xl border bg-background flex items-center justify-center gap-2 text-sm font-medium flex-shrink-0">
            <SlidersHorizontal className="h-4 w-4" />
            {t.common.filter}
          </button>
        </div>
        <div className="flex gap-8 min-w-0">
          <aside className="hidden md:block w-56 flex-shrink-0 animate-fade-in-up opacity-0-init" style={{ animationDelay: "60ms", animationFillMode: "forwards" }}>
            <div className="sticky top-24 bg-card border p-5 rounded-xl shadow-sm transition-shadow duration-300 hover:shadow-md">
              <FilterPanel />
            </div>
          </aside>
          {showFilters && (
            <div className="fixed inset-0 z-50 md:hidden">
              <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm animate-filter-backdrop" onClick={() => setShowFilters(false)} />
              <div className="absolute right-0 top-0 bottom-0 w-[min(20rem,100vw)] max-w-[85vw] bg-background p-4 sm:p-6 overflow-y-auto shadow-2xl animate-filter-drawer">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-bold text-lg">{t.common.filters}</h2>
                  <button onClick={() => setShowFilters(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
                </div>
                <FilterPanel />
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4 mb-4 min-w-0">
              <p className="text-sm text-muted-foreground font-medium">{t.suppliers.resultCount(filtered.length)}</p>
              <div className="flex border border-border rounded-lg overflow-hidden transition-colors duration-200">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 transition-all duration-300 ${viewMode === "grid" ? "bg-primary text-primary-foreground shadow-inner" : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted/80"}`}
                  title={t.suppliers.viewGrid}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 transition-all duration-300 ${viewMode === "list" ? "bg-primary text-primary-foreground shadow-inner" : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted/80"}`}
                  title={t.suppliers.viewList}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
            {(() => {
              // When a specific plan is selected, show flat list without group headers
              if (selectedPlan) {
                return (
                  <div className={`min-w-0 ${viewMode === "list" ? "space-y-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"}`}>
                    {filtered.map((s, i) => (
                      <AnimatedGridItem key={s.id} index={i}>
                        <SupplierCard supplier={s} variant={viewMode} rank={selectedCategories.length === 1 ? i + 1 : undefined} tagDisplayMaps={tagDisplayMaps} />
                      </AnimatedGridItem>
                    ))}
                  </div>
                );
              }
              // Group by plan with section headers
              const planOrder: Array<"premium" | "standard" | "basic"> = ["premium", "standard", "basic"];
              const planLabel: Record<string, string> = {
                premium: t.suppliers.planPremium,
                standard: t.suppliers.planStandard,
                basic: t.suppliers.planBasic,
              };
              const planBorder: Record<string, string> = {
                premium: "border-amber-400",
                standard: "border-red-400",
                basic: "border-border",
              };
              const planText: Record<string, string> = {
                premium: "text-amber-600",
                standard: "text-red-500",
                basic: "text-muted-foreground",
              };
              return (
                <div className="space-y-10 min-w-0">
                  {planOrder.map((plan) => {
                    const group = filtered.filter((s) => (s.plan || "basic") === plan);
                    if (group.length === 0) return null;
                    return (
                      <div key={plan}>
                        <div className={`flex items-center gap-3 mb-4 pb-2 border-b-2 ${planBorder[plan]}`}>
                          <span className={`text-sm font-bold uppercase tracking-wider ${planText[plan]}`}>
                            {planLabel[plan]}
                          </span>
                          <span className="text-xs text-muted-foreground">({planCounts[plan]})</span>
                        </div>
                        <div className={`min-w-0 ${viewMode === "list" ? "space-y-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"}`}>
                          {group.map((s, i) => (
                            <AnimatedGridItem key={s.id} index={i}>
                              <SupplierCard supplier={s} variant={viewMode} rank={selectedCategories.length === 1 ? i + 1 : undefined} tagDisplayMaps={tagDisplayMaps} />
                            </AnimatedGridItem>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {filtered.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg font-medium">{t.suppliers.noResults}</p>
                <p className="text-sm mt-2">{t.suppliers.noResultsSub}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Suppliers;
