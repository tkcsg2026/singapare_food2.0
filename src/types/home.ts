import type { PlanCounts } from "@/lib/plans";
import type {
  CategoryRow,
  JobNoticeRow,
  MarketplaceItemRow,
  NewsArticleRow,
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
  links: Record<string, unknown>[];
  promoVideoUrl: string;
}
