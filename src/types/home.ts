import type { PlanCounts } from "@/lib/plans";
import type {
  CategoryRow,
  CommunityThreadRow,
  JobNoticeRow,
  MarketplaceItemRow,
  NewsArticleRow,
  ShopListingRow,
  SupplierRow,
} from "@/types/database";

/** Payload returned by GET /api/home — optimised for the landing page. */
export interface HomePagePayload {
  suppliers: SupplierRow[];
  planCounts: PlanCounts;
  categories: CategoryRow[];
  tagCategories: CategoryRow[];
  marketplace: MarketplaceItemRow[];
  news: NewsArticleRow[];
  jobs: JobNoticeRow[];
  /** Approved shop / takeover listings; empty when the board is not migrated yet. */
  shopListings: ShopListingRow[];
  /** Active forum threads; empty when the community tables are not migrated yet. */
  communityThreads: CommunityThreadRow[];
  links: Record<string, unknown>[];
  promoVideoUrl: string;
}
