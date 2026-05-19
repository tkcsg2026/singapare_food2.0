import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase-server";

const mockLinks = [
  { id: "1", name: "Singapore Food Agency (SFA)", name_ja: "シンガポール食品庁（SFA）", description: "Official food safety regulations, licensing, and compliance information.", description_ja: "食品安全規制、ライセンス、コンプライアンス情報の公式サイト。", url: "https://www.sfa.gov.sg", icon: "🏛️", bg_image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80", category: "government", sort_order: 1, active: true },
  { id: "2", name: "National Environment Agency (NEA)", name_ja: "国家環境庁（NEA）", description: "Food hygiene grading, hawker centre management and environmental health.", description_ja: "食品衛生評価、ホーカーセンター管理および環境衛生に関する情報。", url: "https://www.nea.gov.sg", icon: "🌿", bg_image: "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=600&q=80", category: "government", sort_order: 2, active: true },
  { id: "3", name: "Enterprise Singapore", name_ja: "エンタープライズ・シンガポール", description: "Business grants, support schemes, and export assistance for F&B companies.", description_ja: "F&B企業向けの補助金、支援制度、輸出支援に関する情報。", url: "https://www.enterprisesg.gov.sg", icon: "🇸🇬", bg_image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80", category: "government", sort_order: 3, active: true },
  { id: "4", name: "Singapore Customs", name_ja: "シンガポール税関", description: "Import/export licensing and regulations for food and beverage products.", description_ja: "食品・飲料製品の輸出入ライセンスと規制に関する情報。", url: "https://www.customs.gov.sg", icon: "📋", bg_image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=80", category: "government", sort_order: 4, active: true },
  { id: "5", name: "Restaurant Association of Singapore (RAS)", name_ja: "シンガポール・レストラン協会（RAS）", description: "Industry body representing restaurants and food service businesses in Singapore.", description_ja: "シンガポールのレストランおよびフードサービス業界を代表する業界団体。", url: "https://www.ras.org.sg", icon: "🍽️", bg_image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80", category: "association", sort_order: 5, active: true },
  { id: "6", name: "Singapore Food Manufacturers' Association (SFMA)", name_ja: "シンガポール食品製造業者協会（SFMA）", description: "Representing food manufacturers and processing companies in Singapore.", description_ja: "シンガポールの食品メーカーと加工会社を代表する協会。", url: "https://sfma.org.sg", icon: "🏭", bg_image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80", category: "association", sort_order: 6, active: true },
  { id: "7", name: "Majlis Ugama Islam Singapura (MUIS)", name_ja: "シンガポール・イスラム宗教評議会（MUIS）", description: "Official halal certification body for Singapore's food and beverage industry.", description_ja: "シンガポールの食品・飲料業界の公式ハラール認証機関。", url: "https://www.muis.gov.sg", icon: "✅", bg_image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80", category: "association", sort_order: 7, active: true },
  { id: "8", name: "Singapore Tourism Board (STB)", name_ja: "シンガポール観光局（STB）", description: "Tourism development and food events including Singapore Food Festival.", description_ja: "シンガポール・フードフェスティバルを含む観光振興と食イベントに関する情報。", url: "https://www.stb.gov.sg", icon: "🗺️", bg_image: "https://images.unsplash.com/photo-1565967511849-76a60a516170?w=600&q=80", category: "association", sort_order: 8, active: true },
  { id: "9", name: "F&B Portal Singapore", name_ja: "F&Bポータル・シンガポール", description: "Singapore's premier supplier discovery and chef networking platform.", description_ja: "シンガポールを代表するサプライヤー発見およびシェフネットワーキングプラットフォーム。", url: "/", icon: "🔗", bg_image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80", category: "platform", sort_order: 9, active: true },
  { id: "10", name: "GrabFood for Merchants", name_ja: "GrabFood（加盟店向け）", description: "Register and manage your restaurant listing on GrabFood delivery platform.", description_ja: "GrabFoodデリバリープラットフォームへのレストラン登録・管理。", url: "https://merchant.grab.com", icon: "🛵", bg_image: "https://images.unsplash.com/photo-1526367790999-0150786686a2?w=600&q=80", category: "platform", sort_order: 10, active: true },
  { id: "11", name: "Foodpanda Partners", name_ja: "フードパンダ（パートナー向け）", description: "Partner portal for restaurants and food businesses on Foodpanda.", description_ja: "フードパンダのレストラン・フードビジネス向けパートナーポータル。", url: "https://www.foodpanda.sg/contents/partner-with-us.htm", icon: "🐼", bg_image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80", category: "platform", sort_order: 11, active: true },
  { id: "12", name: "WSQ Food Safety Course", name_ja: "WSQ食品安全コース", description: "Mandatory food hygiene training courses for food handlers in Singapore.", description_ja: "シンガポールの食品取扱者向け必須食品衛生トレーニングコース。", url: "https://www.sfa.gov.sg/food-information/food-safety-education/food-safety-for-consumers", icon: "📚", bg_image: "https://images.unsplash.com/photo-1588515724527-074a7a56616c?w=600&q=80", category: "resource", sort_order: 12, active: true },
  { id: "13", name: "Singapore Standards (SS) for Food", name_ja: "食品に関するシンガポール規格（SS）", description: "Official food quality and safety standards published by Enterprise Singapore.", description_ja: "エンタープライズ・シンガポールが発行する公式食品品質・安全基準。", url: "https://www.singaporestandardseshop.sg", icon: "📐", bg_image: "https://images.unsplash.com/photo-1576402187878-974f70c890a5?w=600&q=80", category: "resource", sort_order: 13, active: true },
  { id: "14", name: "SkillsFuture for F&B", name_ja: "F&B向けスキルズフューチャー", description: "Subsidised training programmes for F&B industry professionals in Singapore.", description_ja: "シンガポールのF&B業界専門家向け補助金付きトレーニングプログラム。", url: "https://www.skillsfuture.gov.sg", icon: "🎓", bg_image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&q=80", category: "resource", sort_order: 14, active: true },
  { id: "15", name: "30 by 30 — Singapore Food Story", name_ja: "30 by 30 — シンガポール・フードストーリー", description: "Singapore's goal to produce 30% of nutritional needs locally by 2030.", description_ja: "2030年までに栄養ニーズの30%を国内で生産するシンガポールの目標。", url: "https://www.sfa.gov.sg/food-farming/singapore-food-story", icon: "🌾", bg_image: "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=600&q=80", category: "resource", sort_order: 15, active: true },
  { id: "16", name: "Ministry of Health (MOH)", name_ja: "保健省（MOH）", description: "Public health policies, dietary guidelines and food-related health advisories for Singapore.", description_ja: "シンガポールの公衆衛生政策、食事ガイドライン、食品関連健康勧告。", url: "https://www.moh.gov.sg", icon: "🏥", bg_image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&q=80", category: "government", sort_order: 16, active: true },
  { id: "17", name: "Agri-Food & Veterinary Authority (AVA)", name_ja: "農食品・獣医局（AVA）", description: "Animal health, food safety and agri-food industry oversight in Singapore.", description_ja: "動物の健康、食品安全、農食品産業の監督機関。", url: "https://www.nparks.gov.sg/avs", icon: "🐄", bg_image: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=600&q=80", category: "government", sort_order: 17, active: true },
  { id: "18", name: "Economic Development Board (EDB)", name_ja: "経済開発庁（EDB）", description: "Investment incentives and business setup support for food manufacturing companies.", description_ja: "食品製造企業向けの投資インセンティブとビジネス設立支援。", url: "https://www.edb.gov.sg", icon: "🏢", bg_image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80", category: "government", sort_order: 18, active: true },
  { id: "19", name: "Singapore Retailers Association (SRA)", name_ja: "シンガポール小売業者協会（SRA）", description: "Representing retail food and beverage businesses, promoting industry standards and growth.", description_ja: "飲食小売業者を代表し、業界基準の促進と成長を支援する協会。", url: "https://www.sra.org.sg", icon: "🛒", bg_image: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&q=80", category: "association", sort_order: 19, active: true },
  { id: "20", name: "Bakery & Confectionery Association (BCAS)", name_ja: "ベーカリー・菓子協会（BCAS）", description: "Promoting the baking and confectionery trade and craftsmanship in Singapore.", description_ja: "シンガポールのベーキング・菓子業界の振興と職人技の推進。", url: "https://www.bcas.org.sg", icon: "🥐", bg_image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80", category: "association", sort_order: 20, active: true },
  { id: "21", name: "Vegetable Importers & Exporters Association", name_ja: "野菜輸出入業者協会", description: "Trade association for Singapore's fresh produce importers, exporters and distributors.", description_ja: "生鮮食品の輸出入業者・流通業者のための業界団体。", url: "https://www.viea.org.sg", icon: "🥦", bg_image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80", category: "association", sort_order: 21, active: true },
  { id: "22", name: "Wine & Spirit Association (WSA)", name_ja: "ワイン・スピリッツ協会（WSA）", description: "Representing importers and distributors of wines and spirits in Singapore.", description_ja: "シンガポールのワイン・スピリッツ輸入業者・流通業者を代表する協会。", url: "https://www.wsa.org.sg", icon: "🍷", bg_image: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=80", category: "association", sort_order: 22, active: true },
  { id: "23", name: "Delivery Hero / Foodpanda Group", name_ja: "デリバリーヒーロー / フードパンダグループ", description: "Global food delivery giant operating across Asia with merchant onboarding resources.", description_ja: "アジア全域で展開するグローバルフードデリバリー大手の加盟店サポート情報。", url: "https://www.deliveryhero.com", icon: "🚀", bg_image: "https://images.unsplash.com/photo-1478144592103-25e218a04891?w=600&q=80", category: "platform", sort_order: 23, active: true },
  { id: "24", name: "Shopee Food Merchant Portal", name_ja: "Shopee Foodマーチャントポータル", description: "List your restaurant on Shopee Food and access seller tools and analytics.", description_ja: "Shopee Foodにレストランを掲載し、販売ツールや分析機能にアクセス。", url: "https://shopee.sg/shopee-food", icon: "🛍️", bg_image: "https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=600&q=80", category: "platform", sort_order: 24, active: true },
  { id: "25", name: "Healthy 365 — HPB", name_ja: "ヘルシー365 — 健康促進庁（HPB）", description: "Health Promotion Board's app for nutritional information and healthier dining choices.", description_ja: "健康促進庁のアプリ。栄養情報とヘルシーな食事選択に関する情報を提供。", url: "https://www.healthhub.sg/programmes/183/healthier-sg", icon: "💚", bg_image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80", category: "resource", sort_order: 25, active: true },
];

const FALLBACK_IMG = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80";

/**
 * Public site: when `portal_links` has only a few rows (or partial seed), still show the
 * curated default list. DB rows override by URL; DB-only URLs are appended.
 * Admin (`includeInactive=true`) uses raw DB rows only.
 */
function mergePortalLinksWithDefaults(
  dbRows: Record<string, unknown>[],
  defaults: typeof mockLinks,
  includeInactive: boolean
) {
  const byUrl = new Map<string, Record<string, unknown>>();
  for (const m of defaults) {
    byUrl.set(String(m.url).trim(), { ...m });
  }
  for (const row of dbRows) {
    const u = String(row.url ?? "").trim();
    if (!u) continue;
    const base = byUrl.get(u) ?? {};
    const merged = { ...base, ...row } as Record<string, unknown>;
    const bg = typeof merged.bg_image === "string" ? merged.bg_image.trim() : "";
    merged.bg_image = bg || FALLBACK_IMG;
    byUrl.set(u, merged);
  }
  let list = Array.from(byUrl.values());
  if (!includeInactive) {
    list = list.filter((r) => r.active !== false);
  }
  return list.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
}

export async function GET(_req: NextRequest) {
  const { searchParams } = new URL(_req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    const base = includeInactive ? mockLinks : mockLinks.filter((l) => l.active);
    return NextResponse.json(base.sort((a, b) => a.sort_order - b.sort_order));
  }
  let query = supabase.from("portal_links").select("*").order("sort_order");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) {
    const base = includeInactive ? mockLinks : mockLinks.filter((l) => l.active);
    return NextResponse.json(base.sort((a, b) => a.sort_order - b.sort_order));
  }
  if (!data || data.length === 0) {
    const base = includeInactive ? mockLinks : mockLinks.filter((l) => l.active);
    return NextResponse.json(base.sort((a, b) => a.sort_order - b.sort_order));
  }

  const normalized = (data ?? []).map((row: Record<string, unknown>) => {
    const bg = typeof row.bg_image === "string" ? row.bg_image.trim() : "";
    return { ...row, bg_image: bg || FALLBACK_IMG };
  });

  if (includeInactive) {
    return NextResponse.json(normalized);
  }

  return NextResponse.json(mergePortalLinksWithDefaults(normalized, mockLinks, false));
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();
  const { data, error } = await supabase.from("portal_links").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();
  const { id, ...rest } = body;
  const { data, error } = await supabase.from("portal_links").update(rest).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("portal_links").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
