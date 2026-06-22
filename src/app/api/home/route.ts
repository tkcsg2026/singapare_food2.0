import { createServerSupabaseClient } from "@/lib/supabase-server";
import { jsonWithPublicCache } from "@/lib/api-cache";
import { resolveCategoryDisplayLabels } from "@/lib/category-display";
import { fetchPublicPortalLinks } from "@/lib/portal-links";
import { countSuppliersByPlan, takeHomeSuppliers } from "@/lib/plans";
import { suppliers as mockSuppliers } from "@/data/mockData";
import { marketplaceItems as mockMarketplace } from "@/data/mockData";
import type { PlanCounts } from "@/lib/plans";
import type {
  CategoryRow,
  JobNoticeRow,
  MarketplaceItemRow,
  NewsArticleRow,
  SupplierRow,
} from "@/types/database";
import type { HomePagePayload } from "@/types/home";

const HOME_MARKETPLACE_LIMIT = 6;
const HOME_NEWS_LIMIT = 5;
const HOME_JOBS_LIMIT = 3;

const SUPPLIER_CARD_COLUMNS =
  "id,slug,name,name_ja,logo,category,category_ja,category_2,category_2_ja,category_3,category_3_ja,tags,area,area_ja,description,description_ja,whatsapp,whatsapp_contact_name,plan,hidden";

const MARKETPLACE_CARD_COLUMNS =
  "id,slug,title,title_en,price,image,area,area_en,condition,condition_en";

const NEWS_LIST_COLUMNS =
  "id,slug,title,title_ja,image,category,published_at,created_at";

const JOB_LIST_COLUMNS = "id,title,company,description,created_at,post_type";

function normaliseMockSupplier(s: any) {
  return {
    ...s,
    name_ja: s.nameJa ?? s.name_ja ?? s.name,
    category_ja: s.categoryJa ?? s.category_ja ?? s.category,
    area_ja: s.areaJa ?? s.area_ja ?? s.area,
    description_ja: s.descriptionJa ?? s.description_ja ?? s.description,
    plan: s.plan ?? "basic",
    hidden: s.hidden ?? false,
  } as SupplierRow;
}

function normalizeCategoryRows(rows: Record<string, unknown>[]) {
  return rows.map((c) => {
    const { enLabel, jaLabel } = resolveCategoryDisplayLabels(c as unknown as CategoryRow);
    return { ...c, label: enLabel, label_ja: jaLabel } as CategoryRow;
  });
}

function sortNewsByDate<T extends { published_at?: string | null; created_at: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.published_at || b.created_at).getTime() -
      new Date(a.published_at || a.created_at).getTime(),
  );
}

async function fetchPlanCounts(supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>): Promise<PlanCounts> {
  const { count: total, error: errTotal } = await supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true })
    .neq("hidden", true);
  const { count: premium, error: errP } = await supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true })
    .neq("hidden", true)
    .eq("plan", "premium");
  const { count: standard, error: errS } = await supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true })
    .neq("hidden", true)
    .eq("plan", "standard");

  if (errTotal || errP || errS || total == null) {
    return countSuppliersByPlan(mockSuppliers);
  }

  const basic = Math.max(0, total - (premium ?? 0) - (standard ?? 0));
  return { premium: premium ?? 0, standard: standard ?? 0, basic };
}

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    const visibleSuppliers = mockSuppliers
      .map((s) => normaliseMockSupplier(s))
      .filter((s) => !s.hidden);
    const payload: HomePagePayload = {
      suppliers: takeHomeSuppliers(visibleSuppliers),
      planCounts: countSuppliersByPlan(mockSuppliers),
      categories: [],
      tagCategories: [],
      marketplace: mockMarketplace.slice(0, HOME_MARKETPLACE_LIMIT) as unknown as MarketplaceItemRow[],
      news: [],
      jobs: [],
      links: (await fetchPublicPortalLinks(null, { homeCardsOnly: true })) as Record<string, unknown>[],
      promoVideoUrl: "",
    };
    return jsonWithPublicCache(payload);
  }

  const [
    suppliersRes,
    planCounts,
    categoriesRes,
    tagCategoriesRes,
    marketplaceRes,
    newsRes,
    jobsRes,
    links,
    promoRes,
  ] = await Promise.all([
    supabase.from("suppliers").select(SUPPLIER_CARD_COLUMNS).neq("hidden", true),
    fetchPlanCounts(supabase),
    supabase.from("categories").select("id,type,value,label,label_ja,sort_order,parent_group").eq("type", "supplier").order("sort_order"),
    supabase.from("categories").select("id,type,value,label,label_ja,sort_order,parent_group").eq("type", "tag").order("sort_order"),
    supabase
      .from("marketplace_items")
      .select(MARKETPLACE_CARD_COLUMNS)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(HOME_MARKETPLACE_LIMIT),
    supabase
      .from("news_articles")
      .select(NEWS_LIST_COLUMNS)
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(HOME_NEWS_LIMIT * 2),
    supabase
      .from("job_notices")
      .select(JOB_LIST_COLUMNS)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(HOME_JOBS_LIMIT * 3),
    fetchPublicPortalLinks(supabase, { homeCardsOnly: true }),
    supabase.from("site_settings").select("value").eq("key", "promo_video_url").maybeSingle(),
  ]);

  let suppliers: SupplierRow[] = [];
  if (suppliersRes.error || !suppliersRes.data?.length) {
    suppliers = takeHomeSuppliers(
      mockSuppliers
        .map((s) => normaliseMockSupplier(s))
        .filter((s) => !s.hidden),
    );
  } else {
    suppliers = takeHomeSuppliers(suppliersRes.data as SupplierRow[]);
  }

  const categories = categoriesRes.error
    ? []
    : normalizeCategoryRows((categoriesRes.data ?? []) as Record<string, unknown>[]);

  const tagCategories = tagCategoriesRes.error
    ? []
    : normalizeCategoryRows((tagCategoriesRes.data ?? []) as Record<string, unknown>[]);

  let marketplace: MarketplaceItemRow[] = (marketplaceRes.data ?? []) as MarketplaceItemRow[];
  if (marketplaceRes.error || marketplace.length === 0) {
    marketplace = mockMarketplace.slice(0, HOME_MARKETPLACE_LIMIT) as unknown as MarketplaceItemRow[];
  }

  let news: NewsArticleRow[] = [];
  if (!newsRes.error && newsRes.data?.length) {
    news = sortNewsByDate(newsRes.data as NewsArticleRow[]).slice(0, HOME_NEWS_LIMIT);
  }

  const jobs = ((jobsRes.error ? [] : jobsRes.data ?? []) as JobNoticeRow[])
    .filter((n) => (n.post_type ?? "job") === "job")
    .slice(0, HOME_JOBS_LIMIT);

  const promoVideoUrl =
    typeof promoRes.data?.value === "string" ? promoRes.data.value.trim() : "";

  const payload: HomePagePayload = {
    suppliers,
    planCounts,
    categories,
    tagCategories,
    marketplace,
    news,
    jobs,
    links: links as Record<string, unknown>[],
    promoVideoUrl,
  };

  return jsonWithPublicCache(payload);
}
