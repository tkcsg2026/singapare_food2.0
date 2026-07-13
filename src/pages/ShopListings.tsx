"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import Layout from "@/components/Layout";
import { AnimatedGridItem } from "@/components/AnimatedGridItem";
import { ShopListingCard } from "@/components/ShopListingCard";
import { Button } from "@/components/ui/button";
import { useFetch } from "@/hooks/useSupabaseData";
import { useTranslation } from "@/contexts/LanguageContext";
import { useLoginPrompt } from "@/components/LoginPromptModal";
import type { ShopListingRow } from "@/types/database";

const ShopListings = () => {
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const { t } = useTranslation();
  const { requireLogin, loginPromptModal, isLoggedIn } = useLoginPrompt();

  const { data: listings } = useFetch<ShopListingRow[]>("/api/shop-listings");

  const listingTypes = [
    { value: "rent", label: t.shops.types.rent },
    { value: "takeover", label: t.shops.types.takeover },
    { value: "both", label: t.shops.types.both },
  ];

  const filtered = useMemo(() => {
    return (listings || []).filter((listing) => {
      if (query) {
        const q = query.toLowerCase();
        const haystack = [
          listing.title,
          listing.location,
          listing.building,
          listing.suitable_for,
          listing.description,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (selectedType && listing.listing_type !== selectedType) return false;
      return true;
    });
  }, [listings, query, selectedType]);

  return (
    <Layout>
      <div className="container py-8 min-w-0 overflow-hidden w-full">
        <div className="mb-8 min-w-0 section-heading-enter flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight break-words-safe">{t.shops.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t.shops.subtitle}</p>
          </div>
          <Link
            href="/dashboard/new-shop-listing"
            onClick={(e) => {
              if (!isLoggedIn && !requireLogin()) e.preventDefault();
            }}
            className="flex-shrink-0"
          >
            <Button className="gap-1.5 font-bold">
              <Plus className="h-4 w-4" /> {t.shops.postListing}
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t.shops.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ui-filter-control"
            />
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-12 px-4 rounded-xl border bg-background text-sm ui-filter-control"
          >
            <option value="">{t.shops.allTypes}</option>
            {listingTypes.map((lt) => (
              <option key={lt.value} value={lt.value}>{lt.label}</option>
            ))}
          </select>
        </div>

        <p className="text-sm text-muted-foreground mb-4 font-medium">{t.shops.resultCount(filtered.length)}</p>
        <div
          key={selectedType}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 min-w-0 transition-opacity duration-300"
        >
          {filtered.map((listing, i) => (
            <AnimatedGridItem key={listing.id} index={i}>
              <ShopListingCard listing={listing} onRequireLogin={requireLogin} />
            </AnimatedGridItem>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">{t.shops.noResults}</p>
          </div>
        )}
      </div>
      {loginPromptModal}
    </Layout>
  );
};

export default ShopListings;
