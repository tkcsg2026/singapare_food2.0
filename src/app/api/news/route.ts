import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient, requireAdmin } from "@/lib/supabase-server";

const mockArticles = [
  { id: "1", slug: "singapore-food-safety-new-regulations-2025", title: "Singapore Introduces Stricter Food Safety Regulations for 2025", title_ja: "シンガポール、2025年に向けて食品安全規制を強化", excerpt: "The Singapore Food Agency (SFA) has announced a new set of food safety regulations set to take effect in Q2 2025, impacting all F&B establishments.", excerpt_ja: "シンガポール食品庁（SFA）は、2025年第2四半期から施行される新たな食品安全規制を発表しました。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=340&fit=crop", category: "regulation", author: "F&B Portal", published: true, created_at: "2025-01-15T08:00:00Z" },
  { id: "2", slug: "plant-based-food-trend-singapore-2025", title: "Plant-Based Food Market Surges in Singapore", title_ja: "シンガポールでプラントベース食品市場が急成長", excerpt: "Singapore's plant-based food sector is seeing record growth, with new local brands and international players entering the market.", excerpt_ja: "シンガポールのプラントベース食品セクターは記録的な成長を見せており、新しいローカルブランドや国際的な企業が市場に参入しています。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=340&fit=crop", category: "trend", author: "F&B Portal", published: true, created_at: "2025-01-20T09:00:00Z" },
  { id: "3", slug: "halal-certification-expansion-singapore", title: "MUIS Expands Halal Certification Programme for Suppliers", title_ja: "MUISがサプライヤー向けハラール認証プログラムを拡大", excerpt: "The Majlis Ugama Islam Singapura (MUIS) has expanded its halal certification programme to cover more food supply chain participants.", excerpt_ja: "シンガポール・イスラム宗教評議会（MUIS）は、より多くのフードサプライチェーン参加者をカバーするためにハラール認証プログラムを拡大しました。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&h=340&fit=crop", category: "regulation", author: "F&B Portal", published: true, created_at: "2025-02-01T10:00:00Z" },
  { id: "4", slug: "restaurant-association-singapore-annual-gala-2025", title: "RAS Annual Gala 2025: Celebrating Singapore's F&B Industry", title_ja: "RAS年次ガラ2025：シンガポールF&B業界を祝う", excerpt: "The Restaurant Association of Singapore is hosting its annual gala dinner on March 15, recognising outstanding contributions to the industry.", excerpt_ja: "シンガポール・レストラン協会は3月15日に年次ガラディナーを開催し、業界への優れた貢献を表彰します。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=340&fit=crop", category: "event", author: "F&B Portal", published: true, created_at: "2025-02-10T11:00:00Z" },
  { id: "5", slug: "seafood-supply-chain-sustainability-singapore", title: "Singapore's Seafood Suppliers Embrace Sustainability Standards", title_ja: "シンガポールの水産業者が持続可能性基準を採用", excerpt: "Major seafood suppliers in Singapore are adopting new sustainability certifications as consumer demand for responsible sourcing grows.", excerpt_ja: "シンガポールの主要水産業者は、消費者の責任ある調達への需要の高まりに応え、新しい持続可能性認証を取得しています。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&h=340&fit=crop", category: "industry", author: "F&B Portal", published: true, created_at: "2025-02-15T08:30:00Z" },
  { id: "6", slug: "food-delivery-platform-changes-singapore-2025", title: "Food Delivery Platforms Update Commission Structures in Singapore", title_ja: "フードデリバリープラットフォームがシンガポールの手数料体系を更新", excerpt: "Major food delivery platforms operating in Singapore have announced revised commission structures, affecting thousands of F&B businesses.", excerpt_ja: "シンガポールで運営されている主要フードデリバリープラットフォームが手数料体系の見直しを発表し、数千のF&Bビジネスに影響を与えています。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1526367790999-0150786686a2?w=600&h=340&fit=crop", category: "industry", author: "F&B Portal", published: true, created_at: "2025-02-20T09:00:00Z" },
  { id: "7", slug: "singapore-food-festival-2025-announcement", title: "Singapore Food Festival 2025 Programme Unveiled", title_ja: "シンガポール・フードフェスティバル2025のプログラムが発表", excerpt: "The Singapore Tourism Board has unveiled the programme for Singapore Food Festival 2025, featuring over 50 events across the island.", excerpt_ja: "シンガポール観光局がシンガポール・フードフェスティバル2025のプログラムを発表し、島全体で50以上のイベントが予定されています。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=340&fit=crop", category: "event", author: "F&B Portal", published: true, created_at: "2025-03-01T10:00:00Z" },
  { id: "8", slug: "cold-chain-logistics-innovation-singapore", title: "Cold Chain Innovation Boosts Freshness for Singapore Suppliers", title_ja: "コールドチェーンの革新がシンガポール業者の鮮度向上に貢献", excerpt: "New cold chain logistics technologies are helping Singapore's food suppliers maintain product quality over longer distances.", excerpt_ja: "新しいコールドチェーン物流技術がシンガポールの食品業者の長距離輸送における品質維持を支援しています。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&h=340&fit=crop", category: "industry", author: "F&B Portal", published: true, created_at: "2025-03-05T09:00:00Z" },
  { id: "9", slug: "organic-produce-demand-singapore-restaurants", title: "Organic Produce Demand Rising Among Singapore Fine Dining Restaurants", title_ja: "シンガポールの高級レストランでオーガニック食材の需要が上昇", excerpt: "Fine dining establishments in Singapore are increasingly sourcing organic produce, driving new supplier relationships.", excerpt_ja: "シンガポールの高級飲食店がオーガニック食材の調達を増やしており、新たなサプライヤーとの関係を築いています。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&h=340&fit=crop", category: "trend", author: "F&B Portal", published: true, created_at: "2025-03-10T08:00:00Z" },
  { id: "10", slug: "sfa-food-hygiene-officer-training-2025", title: "SFA Launches New Food Hygiene Officer Training Programme", title_ja: "SFAが新たな食品衛生責任者トレーニングプログラムを開始", excerpt: "The Singapore Food Agency has launched an updated training programme for Food Hygiene Officers, with online modules now available.", excerpt_ja: "シンガポール食品庁は食品衛生責任者向けの更新されたトレーニングプログラムを開始し、オンラインモジュールも利用可能になりました。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=340&fit=crop", category: "regulation", author: "F&B Portal", published: true, created_at: "2025-03-15T10:30:00Z" },
  { id: "11", slug: "japanese-cuisine-popularity-singapore-2025", title: "Japanese Cuisine Continues to Dominate Singapore's Food Scene", title_ja: "日本料理がシンガポールのフードシーンをリードし続ける", excerpt: "Singapore remains one of the top markets for Japanese cuisine outside Japan, with new openings and supplier partnerships driving growth.", excerpt_ja: "シンガポールは日本以外で最大の日本料理市場の一つであり続け、新規開店やサプライヤーとのパートナーシップが成長を牽引しています。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1540648639573-8c848de23f0a?w=600&h=340&fit=crop", category: "trend", author: "F&B Portal", published: true, created_at: "2025-03-18T09:00:00Z" },
  { id: "12", slug: "hawker-centre-modernisation-project-singapore", title: "Singapore's Hawker Centre Modernisation Project Update", title_ja: "シンガポールのホーカーセンター近代化プロジェクトの最新情報", excerpt: "The National Environment Agency has released an update on its hawker centre upgrading programme, covering 20 centres island-wide.", excerpt_ja: "国家環境庁はホーカーセンターのアップグレードプログラムに関する最新情報を発表し、島全体の20センターが対象となっています。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&h=340&fit=crop", category: "industry", author: "F&B Portal", published: true, created_at: "2025-03-22T10:00:00Z" },
  { id: "13", slug: "food-waste-reduction-initiative-singapore-fnb", title: "F&B Industry Joins Singapore's Zero Waste Masterplan", title_ja: "F&B業界がシンガポールのゼロ廃棄物マスタープランに参加", excerpt: "Restaurant operators and food suppliers in Singapore are rolling out waste reduction programmes as part of the national Zero Waste Masterplan.", excerpt_ja: "シンガポールのレストラン経営者と食品業者が国家ゼロ廃棄物マスタープランの一環として廃棄物削減プログラムを展開しています。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&h=340&fit=crop", category: "industry", author: "F&B Portal", published: true, created_at: "2025-03-25T08:00:00Z" },
  { id: "14", slug: "singapore-international-food-expo-2025", title: "Singapore International Food & Beverage Expo 2025 Opens Registration", title_ja: "シンガポール国際食品・飲料エキスポ2025が登録受付開始", excerpt: "The Singapore International Food & Beverage Expo 2025 has opened exhibitor registration, expecting over 500 companies from 30 countries.", excerpt_ja: "シンガポール国際食品・飲料エキスポ2025の出展者登録が開始され、30カ国から500社以上の参加が見込まれています。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1505935428862-770b6f24f629?w=600&h=340&fit=crop", category: "event", author: "F&B Portal", published: true, created_at: "2025-04-01T11:00:00Z" },
  { id: "15", slug: "nea-grading-system-update-singapore", title: "NEA Updates Food Establishment Grading System", title_ja: "NEAが食品施設の評価制度を更新", excerpt: "The National Environment Agency has revised its food hygiene grading criteria, introducing new standards for food storage and handling.", excerpt_ja: "国家環境庁が食品衛生評価基準を改訂し、食品保管と取り扱いに関する新基準を導入しました。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1611095973763-414019e72400?w=600&h=340&fit=crop", category: "regulation", author: "F&B Portal", published: true, created_at: "2025-04-05T09:00:00Z" },
  { id: "16", slug: "local-farm-produce-singapore-restaurants", title: "Singapore Restaurants Increase Local Farm Produce Usage", title_ja: "シンガポールのレストランが地元農産物の使用を拡大", excerpt: "As part of Singapore's '30 by 30' food security goal, more restaurants are sourcing from local farms, supporting a growing ecosystem.", excerpt_ja: "シンガポールの「30 by 30」食料安全保障目標の一環として、より多くのレストランが地元農場からの調達を増やし、成長するエコシステムを支援しています。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600&h=340&fit=crop", category: "trend", author: "F&B Portal", published: true, created_at: "2025-04-10T10:00:00Z" },
  { id: "17", slug: "ai-menu-optimization-singapore-restaurants", title: "AI-Powered Menu Optimisation Gains Traction in Singapore", title_ja: "AI活用のメニュー最適化がシンガポールで普及", excerpt: "Singapore restaurant chains are deploying AI tools to analyse sales data and optimise menus, reducing waste and improving margins.", excerpt_ja: "シンガポールのレストランチェーンがAIツールを活用して売上データを分析しメニューを最適化し、廃棄物削減と利益率改善を実現しています。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&h=340&fit=crop", category: "trend", author: "F&B Portal", published: true, created_at: "2025-04-15T08:00:00Z" },
  { id: "18", slug: "singapore-wine-spirits-certification-2025", title: "New Certification Pathway for Singapore Wine & Spirits Importers", title_ja: "シンガポールのワイン・スピリッツ輸入業者向け新認証ルート", excerpt: "Singapore Customs has introduced a streamlined certification pathway for wine and spirits importers, reducing processing time by 40%.", excerpt_ja: "シンガポール税関がワイン・スピリッツ輸入業者向けの合理化された認証ルートを導入し、処理時間を40%削減しました。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&h=340&fit=crop", category: "regulation", author: "F&B Portal", published: true, created_at: "2025-04-18T09:00:00Z" },
  { id: "19", slug: "fnb-portal-singapore-launch-announcement", title: "F&B Portal Singapore Officially Launches", title_ja: "F&Bポータル・シンガポール、正式ローンチ", excerpt: "F&B Portal Singapore, the city-state's premier supplier discovery platform connecting restaurants with trusted food suppliers, has officially launched.", excerpt_ja: "シンガポールの主要サプライヤー発見プラットフォームであるF&Bポータル・シンガポールが正式にローンチしました。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=340&fit=crop", category: "industry", author: "F&B Portal", published: true, created_at: "2025-04-20T08:00:00Z" },
  { id: "20", slug: "chef-talent-shortage-singapore-hospitality", title: "Singapore Hospitality Sector Faces Ongoing Chef Talent Shortage", title_ja: "シンガポールのホスピタリティ業界、シェフ不足が続く", excerpt: "A survey by the Restaurant Association of Singapore highlights a persistent shortage of trained chefs, with restaurants calling for enhanced culinary training programmes.", excerpt_ja: "シンガポール・レストラン協会の調査が、訓練を受けたシェフの慢性的な不足を浮き彫りにし、レストランが充実した料理訓練プログラムを求めています。", content: "", content_ja: "", image: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=600&h=340&fit=crop", category: "industry", author: "F&B Portal", published: true, created_at: "2025-04-25T10:00:00Z" },
];

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const all = searchParams.get("all");

  if (!supabase) {
    let result = [...mockArticles].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (!all) result = result.filter((a) => a.published);
    if (category) result = result.filter((a) => a.category === category);
    return NextResponse.json(result);
  }

  // Admin list (drafts + published): must use service role; anon RLS cannot see unpublished rows.
  if (all === "true") {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const admin = createAdminSupabaseClient();
    if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    let query = admin.from("news_articles").select("*");
    if (category) query = query.eq("category", category);
    query = query.order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const items = (data ?? []) as Array<{ published_at?: string | null; created_at: string }>;
    items.sort(
      (a, b) =>
        new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime(),
    );
    return NextResponse.json(items);
  }

  let query = supabase.from("news_articles").select("*");
  query = query.eq("published", true);
  if (category) query = query.eq("category", category);
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json([]);
  const items = (data ?? []) as Array<{ published_at?: string | null; created_at: string }>;
  items.sort((a, b) => new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime());
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = await req.json();
  const titleEn = typeof body.title === "string" ? body.title.trim() : "";
  const titleJa = typeof body.title_ja === "string" ? body.title_ja.trim() : "";
  const payload = {
    ...body,
    title: titleEn || titleJa || "Untitled",
    title_ja: titleJa || titleEn || "",
  };
  const { data, error } = await supabase.from("news_articles").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
