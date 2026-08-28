"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Plus, Package, ShoppingCart } from "lucide-react";
import Layout from "@/components/Layout";
import { AnimatedGridItem } from "@/components/AnimatedGridItem";
import { MarketplaceCard } from "@/components/MarketplaceCard";
import { PostTypeTabs } from "@/components/PostTypeTabs";
import { Button } from "@/components/ui/button";
import { useFetch } from "@/hooks/useSupabaseData";
import { useTranslation } from "@/contexts/LanguageContext";
import { useLoginPrompt } from "@/components/LoginPromptModal";
import type { CategoryRow, MarketplaceItemRow, MarketplacePostType } from "@/types/database";
import { getCategoryDisplayName } from "@/lib/category-display";
import { buildCategoryAliases, categoryKey, conditionKey } from "@/lib/marketplace-values";

type SortOption = "newest" | "price-asc" | "price-desc";

/** Rows created before the post_type migration are treated as "selling". */
function postTypeOf(item: MarketplaceItemRow): MarketplacePostType {
  return item.post_type === "wanted" ? "wanted" : "selling";
}

const Marketplace = () => {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [postType, setPostType] = useState<MarketplacePostType>("selling");
  const { t, lang } = useTranslation();
  const { requireLogin, loginPromptModal, isLoggedIn } = useLoginPrompt();

  const { data: items } = useFetch<MarketplaceItemRow[]>("/api/marketplace");
  const { data: categories } = useFetch<CategoryRow[]>("/api/categories?type=marketplace");

  const conditions = [
    { value: "like-new", label: t.marketplace.conditions["like-new"] },
    { value: "good",     label: t.marketplace.conditions.good },
    { value: "used",     label: t.marketplace.conditions.used },
    { value: "needs-repair", label: t.marketplace.conditions["needs-repair"] },
  ];

  const isWanted = postType === "wanted";

  const bySide = useMemo(() => {
    const selling: MarketplaceItemRow[] = [];
    const wanted: MarketplaceItemRow[] = [];
    for (const item of items || []) {
      (postTypeOf(item) === "wanted" ? wanted : selling).push(item);
    }
    return { selling, wanted };
  }, [items]);

  // Older rows stored the category and condition as the display label of the
  // language they were posted in, so both sides are folded onto one key before
  // being compared with the dropdown value.
  const categoryAliases = useMemo(() => buildCategoryAliases(categories), [categories]);

  const filtered = useMemo(() => {
    const result = (isWanted ? bySide.wanted : bySide.selling).filter((item) => {
      if (query) {
        const q = query.toLowerCase();
        const categoryText = item.category?.toLowerCase() || "";
        if (
          !item.title.toLowerCase().includes(q) &&
          !item.description.toLowerCase().includes(q) &&
          !categoryText.includes(q)
        ) return false;
      }
      if (selectedCategory && categoryKey(item.category, categoryAliases) !== selectedCategory) return false;
      if (selectedCondition && conditionKey(item.condition) !== selectedCondition) return false;
      return true;
    });
    if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
    return result;
  }, [bySide, isWanted, query, selectedCategory, selectedCondition, sort, categoryAliases]);

  // Both sides use the same posting form; the query param picks which one.
  const postHref = isWanted ? "/dashboard/new-item?type=wanted" : "/dashboard/new-item";

  return (
    <Layout>
      <div className="container py-8 min-w-0 overflow-hidden w-full">
        <div className="mb-6 min-w-0 section-heading-enter flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight break-words-safe">{t.marketplace.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t.marketplace.subtitle}</p>
          </div>
          <Link
            href={postHref}
            onClick={(e) => {
              if (!isLoggedIn && !requireLogin()) e.preventDefault();
            }}
            className="flex-shrink-0"
          >
            <Button className="gap-1.5 font-bold">
              <Plus className="h-4 w-4" /> {isWanted ? t.marketplace.postWanted : t.marketplace.postItem}
            </Button>
          </Link>
        </div>

        {/* Offer / seek switch — the shared two-sided board pattern */}
        <PostTypeTabs<MarketplacePostType>
          value={postType}
          onChange={setPostType}
          className="mb-6"
          options={[
            {
              value: "selling",
              label: t.marketplace.postTypes.selling,
              hint: t.marketplace.postTypeHints.selling,
              icon: Package,
              count: bySide.selling.length,
            },
            {
              value: "wanted",
              label: t.marketplace.postTypes.wanted,
              hint: t.marketplace.postTypeHints.wanted,
              icon: ShoppingCart,
              count: bySide.wanted.length,
            },
          ]}
        />

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder={t.marketplace.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} className="w-full h-12 pl-10 pr-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ui-filter-control" />
          </div>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="h-12 px-4 rounded-xl border bg-background text-sm ui-filter-control">
            <option value="">{t.common.allCategories}</option>
            {(categories || []).map((c) => (
              <option key={c.value} value={c.value}>
                {getCategoryDisplayName(c, lang) ||
                  (t.marketplace as { categories?: Record<string, string> }).categories?.[c.value] ||
                  c.value}
              </option>
            ))}
          </select>
          <select value={selectedCondition} onChange={(e) => setSelectedCondition(e.target.value)} className="h-12 px-4 rounded-xl border bg-background text-sm ui-filter-control">
            <option value="">{t.marketplace.allConditions}</option>
            {conditions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)} className="h-12 px-4 rounded-xl border bg-background text-sm ui-filter-control">
            <option value="newest">{t.marketplace.sort.newest}</option>
            <option value="price-asc">{t.marketplace.sort.priceAsc}</option>
            <option value="price-desc">{t.marketplace.sort.priceDesc}</option>
          </select>
        </div>

        <p className="text-sm text-muted-foreground mb-4 font-medium">
          {isWanted
            ? t.marketplace.wantedResultCount(filtered.length)
            : t.marketplace.resultCount(filtered.length)}
        </p>
        <div
          key={`${postType}-${selectedCategory}-${selectedCondition}-${sort}`}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 min-w-0 transition-opacity duration-300"
        >
          {filtered.map((item, i) => (
            <AnimatedGridItem key={item.id} index={i}>
              <MarketplaceCard item={item} onRequireLogin={requireLogin} />
            </AnimatedGridItem>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">
              {isWanted ? t.marketplace.wantedNoResults : t.marketplace.noResults}
            </p>
          </div>
        )}
      </div>
      {loginPromptModal}
    </Layout>
  );
};

export default Marketplace;
