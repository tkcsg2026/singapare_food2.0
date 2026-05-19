"use client";
import { ExternalLink, Globe } from "lucide-react";
import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/contexts/LanguageContext";
import { useFetch } from "@/hooks/useSupabaseData";

export const LINKS_DATA = [
  {
    category: "government",
    items: [
      {
        name: "Singapore Food Agency (SFA)",
        nameJa: "シンガポール食品庁（SFA）",
        description: "Official food safety regulations, licensing, and compliance information.",
        descriptionJa: "食品安全規制、ライセンス、コンプライアンス情報の公式サイト。",
        url: "https://www.sfa.gov.sg",
        icon: "🏛️",
        bgImage: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80",
      },
      {
        name: "National Environment Agency (NEA)",
        nameJa: "国家環境庁（NEA）",
        description: "Food hygiene grading, hawker centre management and environmental health.",
        descriptionJa: "食品衛生評価、ホーカーセンター管理および環境衛生に関する情報。",
        url: "https://www.nea.gov.sg",
        icon: "🌿",
        bgImage: "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=600&q=80",
      },
      {
        name: "Enterprise Singapore",
        nameJa: "エンタープライズ・シンガポール",
        description: "Business grants, support schemes, and export assistance for F&B companies.",
        descriptionJa: "F&B企業向けの補助金、支援制度、輸出支援に関する情報。",
        url: "https://www.enterprisesg.gov.sg",
        icon: "🇸🇬",
        bgImage: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80",
      },
      {
        name: "Singapore Customs",
        nameJa: "シンガポール税関",
        description: "Import/export licensing and regulations for food and beverage products.",
        descriptionJa: "食品・飲料製品の輸出入ライセンスと規制に関する情報。",
        url: "https://www.customs.gov.sg",
        icon: "📋",
        bgImage: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=80",
      },
    ],
  },
  {
    category: "association",
    items: [
      {
        name: "Restaurant Association of Singapore (RAS)",
        nameJa: "シンガポール・レストラン協会（RAS）",
        description: "Industry body representing restaurants and food service businesses in Singapore.",
        descriptionJa: "シンガポールのレストランおよびフードサービス業界を代表する業界団体。",
        url: "https://www.ras.org.sg",
        icon: "🍽️",
        bgImage: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80",
      },
      {
        name: "Singapore Food Manufacturers' Association (SFMA)",
        nameJa: "シンガポール食品製造業者協会（SFMA）",
        description: "Representing food manufacturers and processing companies in Singapore.",
        descriptionJa: "シンガポールの食品メーカーと加工会社を代表する協会。",
        url: "https://sfma.org.sg",
        icon: "🏭",
        bgImage: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80",
      },
      {
        name: "Majlis Ugama Islam Singapura (MUIS)",
        nameJa: "シンガポール・イスラム宗教評議会（MUIS）",
        description: "Official halal certification body for Singapore's food and beverage industry.",
        descriptionJa: "シンガポールの食品・飲料業界の公式ハラール認証機関。",
        url: "https://www.muis.gov.sg",
        icon: "✅",
        bgImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
      },
      {
        name: "Singapore Tourism Board (STB)",
        nameJa: "シンガポール観光局（STB）",
        description: "Tourism development and food events including Singapore Food Festival.",
        descriptionJa: "シンガポール・フードフェスティバルを含む観光振興と食イベントに関する情報。",
        url: "https://www.stb.gov.sg",
        icon: "🗺️",
        bgImage: "https://images.unsplash.com/photo-1565967511849-76a60a516170?w=600&q=80",
      },
    ],
  },
  {
    category: "platform",
    items: [
      {
        name: "F&B Portal Singapore",
        nameJa: "F&Bポータル・シンガポール",
        description: "Singapore's premier supplier discovery and chef networking platform.",
        descriptionJa: "シンガポールを代表するサプライヤー発見およびシェフネットワーキングプラットフォーム。",
        url: "/",
        icon: "🔗",
        bgImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80",
      },
      {
        name: "GrabFood for Merchants",
        nameJa: "GrabFood（加盟店向け）",
        description: "Register and manage your restaurant listing on GrabFood delivery platform.",
        descriptionJa: "GrabFoodデリバリープラットフォームへのレストラン登録・管理。",
        url: "https://merchant.grab.com",
        icon: "🛵",
        bgImage: "https://images.unsplash.com/photo-1526367790999-0150786686a2?w=600&q=80",
      },
      {
        name: "Foodpanda Partners",
        nameJa: "フードパンダ（パートナー向け）",
        description: "Partner portal for restaurants and food businesses on Foodpanda.",
        descriptionJa: "フードパンダのレストラン・フードビジネス向けパートナーポータル。",
        url: "https://www.foodpanda.sg/contents/partner-with-us.htm",
        icon: "🐼",
        bgImage: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
      },
    ],
  },
  {
    category: "resource",
    items: [
      {
        name: "WSQ Food Safety Course",
        nameJa: "WSQ食品安全コース",
        description: "Mandatory food hygiene training courses for food handlers in Singapore.",
        descriptionJa: "シンガポールの食品取扱者向け必須食品衛生トレーニングコース。",
        url: "https://www.sfa.gov.sg/food-information/food-safety-education/food-safety-for-consumers",
        icon: "📚",
        bgImage: "https://images.unsplash.com/photo-1588515724527-074a7a56616c?w=600&q=80",
      },
      {
        name: "Singapore Standards (SS) for Food",
        nameJa: "食品に関するシンガポール規格（SS）",
        description: "Official food quality and safety standards published by Enterprise Singapore.",
        descriptionJa: "エンタープライズ・シンガポールが発行する公式食品品質・安全基準。",
        url: "https://www.singaporestandardseshop.sg",
        icon: "📐",
        bgImage: "https://images.unsplash.com/photo-1576402187878-974f70c890a5?w=600&q=80",
      },
      {
        name: "SkillsFuture for F&B",
        nameJa: "F&B向けスキルズフューチャー",
        description: "Subsidised training programmes for F&B industry professionals in Singapore.",
        descriptionJa: "シンガポールのF&B業界専門家向け補助金付きトレーニングプログラム。",
        url: "https://www.skillsfuture.gov.sg",
        icon: "🎓",
        bgImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&q=80",
      },
      {
        name: "30 by 30 — Singapore Food Story",
        nameJa: "30 by 30 — シンガポール・フードストーリー",
        description: "Singapore's goal to produce 30% of nutritional needs locally by 2030.",
        descriptionJa: "2030年までに栄養ニーズの30%を国内で生産するシンガポールの目標。",
        url: "https://www.sfa.gov.sg/food-farming/singapore-food-story",
        icon: "🌾",
        bgImage: "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=600&q=80",
      },
    ],
  },
  {
    category: "government",
    items: [
      {
        name: "Ministry of Health (MOH)",
        nameJa: "保健省（MOH）",
        description: "Public health policies, dietary guidelines and food-related health advisories for Singapore.",
        descriptionJa: "シンガポールの公衆衛生政策、食事ガイドライン、食品関連健康勧告。",
        url: "https://www.moh.gov.sg",
        icon: "🏥",
        bgImage: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&q=80",
      },
      {
        name: "Agri-Food & Veterinary Authority (AVA)",
        nameJa: "農食品・獣医局（AVA）",
        description: "Animal health, food safety and agri-food industry oversight in Singapore.",
        descriptionJa: "動物の健康、食品安全、農食品産業の監督機関。",
        url: "https://www.nparks.gov.sg/avs",
        icon: "🐄",
        bgImage: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=600&q=80",
      },
      {
        name: "Economic Development Board (EDB)",
        nameJa: "経済開発庁（EDB）",
        description: "Investment incentives and business setup support for food manufacturing companies.",
        descriptionJa: "食品製造企業向けの投資インセンティブとビジネス設立支援。",
        url: "https://www.edb.gov.sg",
        icon: "🏢",
        bgImage: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80",
      },
    ],
  },
  {
    category: "association",
    items: [
      {
        name: "Singapore Retailers Association (SRA)",
        nameJa: "シンガポール小売業者協会（SRA）",
        description: "Representing retail food and beverage businesses, promoting industry standards and growth.",
        descriptionJa: "飲食小売業者を代表し、業界基準の促進と成長を支援する協会。",
        url: "https://www.sra.org.sg",
        icon: "🛒",
        bgImage: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&q=80",
      },
      {
        name: "Bakery & Confectionery Association (BCAS)",
        nameJa: "ベーカリー・菓子協会（BCAS）",
        description: "Promoting the baking and confectionery trade and craftsmanship in Singapore.",
        descriptionJa: "シンガポールのベーキング・菓子業界の振興と職人技の推進。",
        url: "https://www.bcas.org.sg",
        icon: "🥐",
        bgImage: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80",
      },
      {
        name: "Vegetable Importers & Exporters Association",
        nameJa: "野菜輸出入業者協会",
        description: "Trade association for Singapore's fresh produce importers, exporters and distributors.",
        descriptionJa: "生鮮食品の輸出入業者・流通業者のための業界団体。",
        url: "https://www.viea.org.sg",
        icon: "🥦",
        bgImage: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80",
      },
      {
        name: "Wine & Spirit Association (WSA)",
        nameJa: "ワイン・スピリッツ協会（WSA）",
        description: "Representing importers and distributors of wines and spirits in Singapore.",
        descriptionJa: "シンガポールのワイン・スピリッツ輸入業者・流通業者を代表する協会。",
        url: "https://www.wsa.org.sg",
        icon: "🍷",
        bgImage: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=80",
      },
    ],
  },
  {
    category: "platform",
    items: [
      {
        name: "TableCheck Singapore",
        nameJa: "TableCheck（シンガポール）",
        description: "Restaurant reservation and guest management platform used by many F&B operators.",
        descriptionJa: "多くの飲食店で使われる予約・顧客管理プラットフォーム。",
        url: "https://www.tablecheck.com/en/",
        icon: "📅",
        bgImage: "https://logo.clearbit.com/tablecheck.com",
      },
      {
        name: "Chope",
        nameJa: "Chope",
        description: "Reservation and demand-generation tools for restaurants in Singapore.",
        descriptionJa: "シンガポールの飲食店向け予約・集客ツール。",
        url: "https://www.chope.co/singapore-restaurants",
        icon: "🍴",
        bgImage: "https://logo.clearbit.com/chope.co",
      },
      {
        name: "OpenRice Singapore",
        nameJa: "OpenRice シンガポール",
        description: "Restaurant discovery and listing platform used by diners across Asia.",
        descriptionJa: "アジアで利用されるレストラン検索・掲載プラットフォーム。",
        url: "https://sg.openrice.com/en/singapore",
        icon: "🧭",
        bgImage: "https://logo.clearbit.com/openrice.com",
      },
      {
        name: "Japan Foodie (JNTO)",
        nameJa: "Japan Foodie（JNTO）",
        description: "Official Japan travel food guide and culinary discovery content.",
        descriptionJa: "日本政府観光局による公式グルメ・食文化ガイド。",
        url: "https://www.japan.travel/en/food/",
        icon: "🍜",
        bgImage: "https://logo.clearbit.com/japan.travel",
      },
      {
        name: "Tabelog",
        nameJa: "食べログ",
        description: "Major Japanese restaurant discovery and review platform.",
        descriptionJa: "日本最大級のレストラン検索・口コミプラットフォーム。",
        url: "https://tabelog.com/en/",
        icon: "⭐",
        bgImage: "https://logo.clearbit.com/tabelog.com",
      },
    ],
  },
  {
    category: "association",
    items: [
      {
        name: "Food and Beverage Management Association Singapore (FBMA)",
        nameJa: "シンガポールF&Bマネジメント協会（FBMA）",
        description: "Professional F&B networking and management development association.",
        descriptionJa: "F&B業界のネットワーキングと人材育成を行う専門団体。",
        url: "https://www.fbma.sg/",
        icon: "🤝",
        bgImage: "https://logo.clearbit.com/fbma.sg",
      },
      {
        name: "Japan Foodservice Association (JF)",
        nameJa: "日本フードサービス協会（JF）",
        description: "Industry body for Japan's restaurant and foodservice sector.",
        descriptionJa: "日本の外食・フードサービス業界を代表する団体。",
        url: "https://www.jfnet.or.jp/",
        icon: "🏮",
        bgImage: "https://logo.clearbit.com/jfnet.or.jp",
      },
      {
        name: "Food Industry Center (Japan)",
        nameJa: "食品産業センター（日本）",
        description: "Supports Japanese food manufacturing, standards and policy development.",
        descriptionJa: "日本の食品製造、基準整備、政策連携を支援する団体。",
        url: "http://shokusan.or.jp/",
        icon: "🏢",
        bgImage: "https://logo.clearbit.com/shokusan.or.jp",
      },
      {
        name: "All Japan Coffee Association",
        nameJa: "全日本コーヒー協会",
        description: "Coffee trade and standards information in Japan.",
        descriptionJa: "日本のコーヒー流通・基準に関する情報。",
        url: "https://coffee.ajca.or.jp/",
        icon: "☕",
        bgImage: "https://logo.clearbit.com/ajca.or.jp",
      },
    ],
  },
  {
    category: "government",
    items: [
      {
        name: "Ministry of Manpower (MOM)",
        nameJa: "人材開発省（MOM）",
        description: "Work pass, hiring, and employment requirements relevant to F&B operations.",
        descriptionJa: "F&B事業に関わる雇用・就労ビザ・採用要件情報。",
        url: "https://www.mom.gov.sg/",
        icon: "🧾",
        bgImage: "https://logo.clearbit.com/mom.gov.sg",
      },
      {
        name: "Singapore Government Procurement (GeBIZ)",
        nameJa: "シンガポール政府調達（GeBIZ）",
        description: "Public procurement opportunities and tenders, including food-related sectors.",
        descriptionJa: "食品関連を含む公共調達案件・入札情報。",
        url: "https://www.gebiz.gov.sg/",
        icon: "📦",
        bgImage: "https://logo.clearbit.com/gebiz.gov.sg",
      },
      {
        name: "Ministry of Agriculture, Forestry and Fisheries (Japan)",
        nameJa: "農林水産省（日本）",
        description: "Food industry policies, standards and agriculture-linked initiatives in Japan.",
        descriptionJa: "日本の食品産業政策・基準・農業連携施策の公式情報。",
        url: "https://www.maff.go.jp/e/",
        icon: "🌱",
        bgImage: "https://logo.clearbit.com/maff.go.jp",
      },
      {
        name: "Japan External Trade Organization (JETRO)",
        nameJa: "日本貿易振興機構（JETRO）",
        description: "Export and market-entry support for food businesses in Japan and overseas.",
        descriptionJa: "食品関連企業の輸出・海外展開支援情報。",
        url: "https://www.jetro.go.jp/en/",
        icon: "🌐",
        bgImage: "https://logo.clearbit.com/jetro.go.jp",
      },
    ],
  },
  {
    category: "resource",
    items: [
      {
        name: "JFOODO",
        nameJa: "JFOODO（日本食品海外プロモーション）",
        description: "Official Japanese food overseas promotion organization and market insights.",
        descriptionJa: "日本食品の海外プロモーション機関と市場情報。",
        url: "https://www.jfoodo.go.jp/",
        icon: "🍣",
        bgImage: "https://logo.clearbit.com/jfoodo.go.jp",
      },
      {
        name: "Sake & Shochu Information Center",
        nameJa: "日本酒・焼酎情報センター",
        description: "Educational resources for Japanese beverages, quality and export information.",
        descriptionJa: "日本酒・焼酎の品質や海外展開に関する情報。",
        url: "https://www.japansake.or.jp/",
        icon: "🍶",
        bgImage: "https://logo.clearbit.com/japansake.or.jp",
      },
      {
        name: "TasteAtlas Singapore Food Guide",
        nameJa: "TasteAtlas シンガポール料理ガイド",
        description: "Global food reference with cuisine and dish discovery content for Singapore.",
        descriptionJa: "シンガポール料理の発見に使えるグローバル食文化リファレンス。",
        url: "https://www.tasteatlas.com/singapore",
        icon: "📖",
        bgImage: "https://logo.clearbit.com/tasteatlas.com",
      },
      {
        name: "Tokyo Metropolitan Food Safety Portal",
        nameJa: "東京都 食の安全ポータル",
        description: "Food safety and hygiene guidance from Tokyo's official public resources.",
        descriptionJa: "東京都の公式食品安全・衛生情報。",
        url: "https://www.fukushihoken.metro.tokyo.lg.jp/shokuhin/",
        icon: "🛡️",
        bgImage: "https://logo.clearbit.com/metro.tokyo.lg.jp",
      },
    ],
  },
];

const Links = () => {
  const { t, lang } = useTranslation();
  const tl = t.links;
  const { data: linksData, loading: linksLoading } = useFetch<any[]>("/api/links");
  const links = linksData || [];
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const order = ["government", "association", "platform", "resource"];
    return order.map((category) => ({
      category,
      items: links.filter((l) => l.category === category),
    }));
  }, [links]);

  const hasAnyVisibleLink = useMemo(
    () => grouped.some((g) => g.items.length > 0),
    [grouped]
  );

  return (
    <Layout>
      <div className="container py-10 md:py-14">
        <div className="mb-10">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Globe className="h-7 w-7 text-primary" />
            {tl.pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{tl.pageSubtitle}</p>
        </div>

        {linksLoading ? (
          <p className="text-sm text-muted-foreground py-12 text-center">{tl.loading}</p>
        ) : !hasAnyVisibleLink ? (
          <div
            className="rounded-2xl border border-dashed border-border bg-muted/15 px-6 py-12 text-center text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto"
            role="status"
          >
            {tl.emptyPage}
          </div>
        ) : (
          <div className="space-y-12">
            {grouped.map(({ category, items }, sectionIdx) => (
              <section key={`${category}-${sectionIdx}`}>
                <h2 className="text-lg font-bold mb-5 flex items-center gap-2 text-foreground">
                  <span className="w-1 h-5 bg-primary rounded-full inline-block" />
                  {tl.categories[category]}
                </h2>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-3 border-l-2 border-muted py-1">{tl.emptyCategory}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {items.map((link, linkIdx) => (
                      <a
                        key={`${sectionIdx}-${linkIdx}-${link.url}`}
                        href={link.url}
                        target={link.url.startsWith("http") ? "_blank" : "_self"}
                        rel="noopener noreferrer"
                        className="group bg-card border border-border p-5 card-hover flex flex-col gap-3 hover:border-primary/40 transition-colors"
                      >
                        <div className="relative h-28 -m-5 mb-3 overflow-hidden border-b border-border rounded-t-sm">
                          {!failedImages[String(link.id)] && (link.bg_image || link.bgImage || "").toString().trim() ? (
                            <img
                              src={(link.bg_image || link.bgImage || "").toString().trim()}
                              alt={lang === "ja" ? (link.name_ja || link.nameJa || link.name) : link.name}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                              onError={() => setFailedImages((prev) => ({ ...prev, [String(link.id)]: true }))}
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center text-2xl">
                              {link.icon || "🔗"}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                          <div className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-xl leading-none shadow-sm">
                            {link.icon}
                          </div>
                          <ExternalLink className="absolute right-3 top-3 h-3.5 w-3.5 text-white/90 group-hover:text-white transition-colors" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">
                            {lang === "ja" ? (link.name_ja || link.nameJa || link.name) : link.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">
                            {lang === "ja" ? (link.description_ja || link.descriptionJa || link.description) : link.description}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-primary flex items-center gap-1 mt-auto">
                          {tl.visitSite} <ExternalLink className="h-3 w-3" />
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Links;
