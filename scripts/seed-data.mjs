/**
 * Seed test data into Supabase via the REST (PostgREST) API.
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
 *   node scripts/seed-data.mjs
 *
 * The service-role key can be found in:
 *   Supabase Dashboard → Project Settings → API → Secret key (sb_secret_...)
 */

const PROJECT_URL = "https://uwlfjcmzciunetehmicr.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SERVICE_KEY) {
  console.log(`
============================================================
  SEED FAILED: Service role key not set.
============================================================

Option A – Run in Supabase SQL Editor (recommended):
  1. Open https://supabase.com/dashboard/project/uwlfjcmzciunetehmicr
  2. Click "SQL Editor" in the left menu
  3. Paste the contents of supabase-seed.sql and click Run

Option B – Use the secret key:
  1. Supabase Dashboard → Project Settings → API
  2. Copy "Secret key" (starts with sb_secret_...)
  3. In PowerShell:
       $env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
       node scripts/seed-data.mjs
============================================================
`);
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  Prefer: "resolution=ignore-duplicates,return=representation",
};

async function upsert(table, rows) {
  const res = await fetch(`${PROJECT_URL}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`  ✗ ${table}: HTTP ${res.status} – ${text}`);
    return false;
  }
  const data = JSON.parse(text);
  console.log(`  ✓ ${table}: ${Array.isArray(data) ? data.length : 1} row(s) upserted`);
  return true;
}

// ── Suppliers ────────────────────────────────────────────────
const suppliers = [
  {
    id: "a1000000-0000-0000-0000-000000000001",
    slug: "tokyo-seafood",
    name: "Tokyo Seafood Co.",
    name_ja: "東京シーフード株式会社",
    logo: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=200&h=200&fit=crop",
    category: "seafood",
    category_ja: "海鮮・鮮魚",
    tags: ["少量対応", "日本語対応", "ハラール"],
    area: "central",
    area_ja: "中央エリア",
    description: "Premium seafood supplier with daily fresh catches",
    description_ja: "毎日新鮮な魚介類を提供する高品質シーフードサプライヤー。築地から直送。",
    whatsapp: "6512345678",
    views: 1250,
    certifications: ["HACCP", "ISO 22000", "ハラール認証"],
    about: "2005年創業。シンガポールの日本料理店を中心に、最高品質の鮮魚を毎日お届けしています。",
    featured: true,
  },
  {
    id: "a1000000-0000-0000-0000-000000000002",
    slug: "green-harvest",
    name: "Green Harvest Pte Ltd",
    name_ja: "グリーンハーベスト",
    logo: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=200&h=200&fit=crop",
    category: "produce-dry-goods",
    category_ja: "青果・乾物",
    tags: ["少量対応", "オーガニック"],
    area: "north",
    area_ja: "北部エリア",
    description: "Organic vegetables and herbs supplier",
    description_ja: "オーガニック野菜とハーブの専門サプライヤー。地元農園から新鮮直送。",
    whatsapp: "6523456789",
    views: 980,
    certifications: ["有機JAS", "GlobalGAP"],
    about: "シンガポール北部の自社農園で栽培したオーガニック野菜を直接お届けしています。",
    featured: false,
  },
  {
    id: "a1000000-0000-0000-0000-000000000003",
    slug: "asia-meat-supply",
    name: "Asia Meat Supply",
    name_ja: "アジアミートサプライ",
    logo: "https://images.unsplash.com/photo-1588347818036-558601350947?w=200&h=200&fit=crop",
    category: "meat-poultry",
    category_ja: "肉類・家禽",
    tags: ["ハラール", "大量注文可", "翌日配送"],
    area: "west",
    area_ja: "西部エリア",
    description: "Halal certified meat supplier",
    description_ja: "ハラール認証済み。和牛からチキンまで幅広い肉類を取り扱い。",
    whatsapp: "6534567890",
    views: 1500,
    certifications: ["ハラール認証", "HACCP"],
    about: "アジア各国から厳選した肉類を、シンガポール全土のレストランにお届けしています。",
    featured: true,
  },
  {
    id: "a1000000-0000-0000-0000-000000000004",
    slug: "sakura-beverages",
    name: "Sakura Beverages",
    name_ja: "さくらビバレッジ",
    logo: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200&h=200&fit=crop",
    category: "beverages",
    category_ja: "飲料・酒類",
    tags: ["日本語対応", "少量対応", "日本酒専門"],
    area: "central",
    area_ja: "中央エリア",
    description: "Japanese sake and beverages specialist",
    description_ja: "日本酒・焼酎を中心とした飲料の専門卸。蔵元直送の希少銘柄も取扱。",
    whatsapp: "6545678901",
    views: 870,
    certifications: ["酒類販売免許"],
    about: "日本全国の蔵元と直接取引し、最高品質の日本酒をお届けしています。",
    featured: false,
  },
  {
    id: "a1000000-0000-0000-0000-000000000005",
    slug: "pacific-dry-goods",
    name: "Pacific Dry Goods",
    name_ja: "パシフィック乾物",
    logo: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=200&h=200&fit=crop",
    category: "produce-dry-goods",
    category_ja: "青果・乾物",
    tags: ["少量対応", "日本語対応"],
    area: "east",
    area_ja: "東部エリア",
    description: "Japanese condiments and dry goods",
    description_ja: "味噌、醤油、だし等の和食調味料と乾物を幅広く取り扱い。",
    whatsapp: "6556789012",
    views: 720,
    certifications: ["食品衛生管理者"],
    about: "日本の伝統的な調味料と乾物を専門に取り扱う卸売業者です。",
    featured: false,
  },
  {
    id: "a1000000-0000-0000-0000-000000000006",
    slug: "kitchen-pro-equipment",
    name: "Kitchen Pro Equipment",
    name_ja: "キッチンプロ機器",
    logo: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=200&fit=crop",
    category: "kitchen-equipment",
    category_ja: "厨房機器",
    tags: ["設置サポート", "メンテナンス対応"],
    area: "south",
    area_ja: "南部エリア",
    description: "Commercial kitchen equipment supplier",
    description_ja: "業務用厨房機器の販売・設置・メンテナンスまでワンストップで対応。",
    whatsapp: "6567890123",
    views: 650,
    certifications: ["ISO 9001"],
    about: "シンガポール全土のレストラン・ホテルに業務用厨房機器を提供しています。",
    featured: false,
  },
];

// ── Supplier Products ────────────────────────────────────────
const products = [
  { supplier_id: "a1000000-0000-0000-0000-000000000001", name: "マグロ（本マグロ）",       image: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=400&h=300&fit=crop", moq: "1kg〜" },
  { supplier_id: "a1000000-0000-0000-0000-000000000001", name: "サーモン（ノルウェー産）", image: "https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=400&h=300&fit=crop", moq: "2kg〜" },
  { supplier_id: "a1000000-0000-0000-0000-000000000001", name: "エビ（ブラックタイガー）", image: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400&h=300&fit=crop", moq: "1kg〜" },
  { supplier_id: "a1000000-0000-0000-0000-000000000002", name: "有機レタスミックス",       image: "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=400&h=300&fit=crop", moq: "500g〜" },
  { supplier_id: "a1000000-0000-0000-0000-000000000002", name: "フレッシュハーブセット",   image: "https://images.unsplash.com/photo-1515586000433-45406d8e6662?w=400&h=300&fit=crop", moq: "100g〜" },
  { supplier_id: "a1000000-0000-0000-0000-000000000003", name: "A5和牛サーロイン",         image: "https://images.unsplash.com/photo-1615937722923-67f6deaf2cc9?w=400&h=300&fit=crop", moq: "500g〜" },
  { supplier_id: "a1000000-0000-0000-0000-000000000003", name: "ハラールチキン",           image: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&h=300&fit=crop", moq: "2kg〜" },
  { supplier_id: "a1000000-0000-0000-0000-000000000004", name: "純米大吟醸セット",         image: "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400&h=300&fit=crop", moq: "6本〜" },
  { supplier_id: "a1000000-0000-0000-0000-000000000005", name: "有機醤油（1L）",           image: "https://images.unsplash.com/photo-1585672840563-f2af2ced55c9?w=400&h=300&fit=crop", moq: "6本〜" },
  { supplier_id: "a1000000-0000-0000-0000-000000000005", name: "信州味噌",                 image: "https://images.unsplash.com/photo-1614563637806-1d0e645e0940?w=400&h=300&fit=crop", moq: "1kg〜" },
  { supplier_id: "a1000000-0000-0000-0000-000000000006", name: "業務用冷蔵庫",             image: "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=400&h=300&fit=crop", moq: "1台〜" },
];

// ── Marketplace Items ────────────────────────────────────────
const marketplaceItems = [
  {
    slug: "commercial-oven-used",
    title: "業務用コンベクションオーブン",
    price: 2500,
    image: "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=600&h=450&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop",
    ],
    area: "中央エリア", condition: "良好", years_used: 2,
    description: "閉店のため出品。まだまだ使えます。定期メンテナンス済み。即日引き取り可能。",
    category: "厨房機器", seller_id: null, seller_name: "田中シェフ", seller_whatsapp: "6512345678",
    created_at: "2024-01-15T00:00:00Z", status: "approved", delivery: "引き取りのみ",
  },
  {
    slug: "sushi-counter-set",
    title: "寿司カウンターセット（檜製）",
    price: 4800,
    image: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=600&h=450&fit=crop",
    images: ["https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&h=600&fit=crop"],
    area: "東部エリア", condition: "良好", years_used: 3,
    description: "檜の寿司カウンター。8席分。移転のためお譲りします。",
    category: "厨房機器", seller_id: null, seller_name: "佐藤", seller_whatsapp: "6523456789",
    created_at: "2024-01-12T00:00:00Z", status: "approved", delivery: "配送可能",
  },
  {
    slug: "ramen-bowls-set",
    title: "ラーメン丼セット（50個）",
    price: 350,
    image: "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=600&h=450&fit=crop",
    images: ["https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=800&h=600&fit=crop"],
    area: "西部エリア", condition: "新品同様", years_used: 0,
    description: "未使用のラーメン丼50個セット。メニュー変更のため出品。",
    category: "食器・備品", seller_id: null, seller_name: "鈴木", seller_whatsapp: "6534567890",
    created_at: "2024-01-10T00:00:00Z", status: "approved", delivery: "引き取り・配送可",
  },
  {
    slug: "ice-cream-machine",
    title: "業務用アイスクリームマシン",
    price: 1800,
    image: "https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?w=600&h=450&fit=crop",
    images: ["https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?w=800&h=600&fit=crop"],
    area: "北部エリア", condition: "使用感あり", years_used: 4,
    description: "まだ動作します。メンテナンス記録あり。",
    category: "厨房機器", seller_id: null, seller_name: "山田", seller_whatsapp: "6545678901",
    created_at: "2024-01-08T00:00:00Z", status: "approved", delivery: "引き取りのみ",
  },
  {
    slug: "chef-knives-set",
    title: "包丁セット（堺製）5本",
    price: 890,
    image: "https://images.unsplash.com/photo-1593618998160-e34014e67546?w=600&h=450&fit=crop",
    images: ["https://images.unsplash.com/photo-1593618998160-e34014e67546?w=800&h=600&fit=crop"],
    area: "中央エリア", condition: "良好", years_used: 1,
    description: "堺の職人が作った和包丁5本セット。出刃、柳刃、薄刃、菜切、牛刀。",
    category: "調理器具", seller_id: null, seller_name: "高橋シェフ", seller_whatsapp: "6556789012",
    created_at: "2024-01-05T00:00:00Z", status: "approved", delivery: "配送可能",
  },
  {
    slug: "restaurant-tables",
    title: "レストランテーブル4台セット",
    price: 600,
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=450&fit=crop",
    images: ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop"],
    area: "南部エリア", condition: "良好", years_used: 2,
    description: "4人掛けテーブル4台。木製天板、鉄脚。店舗改装のため出品。",
    category: "家具", seller_id: null, seller_name: "中村", seller_whatsapp: "6567890123",
    created_at: "2024-01-03T00:00:00Z", status: "approved", delivery: "引き取りのみ",
  },
];

// ── News Articles ────────────────────────────────────────────
const newsArticles = [
  {
    slug: "singapore-fb-trends-2024",
    title: "Singapore F&B Industry Trends 2024",
    title_ja: "2024年シンガポールF&B業界トレンド",
    excerpt: "Key trends shaping Singapore food service in 2024.",
    excerpt_ja: "2024年のシンガポール外食産業を形成する主要トレンドを解説します。",
    content: "The Singapore F&B industry continues to evolve rapidly. Plant-based foods and sustainable sourcing are gaining traction across restaurants and cafes.",
    content_ja: "シンガポールのF&B業界は急速に進化を続けています。日本料理の需要が高まる中、高品質な食材の安定供給が業界全体の課題となっています。特に2024年は植物性食品と持続可能な調達への関心が高まっています。",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=450&fit=crop",
    category: "industry", author: "編集部", published: true,
  },
  {
    slug: "halal-certification-guide",
    title: "Halal Certification Guide for F&B Suppliers",
    title_ja: "F&Bサプライヤーのためのハラール認証ガイド",
    excerpt: "Everything you need to know about halal certification in Singapore.",
    excerpt_ja: "シンガポールでのハラール認証取得に関する完全ガイドです。",
    content: "Halal certification is essential for reaching Muslim consumers in Singapore. MUIS oversees halal certification and suppliers must meet specific standards.",
    content_ja: "ハラール認証は、シンガポールのムスリム消費者にリーチするために不可欠です。シンガポールではMUISがハラール認証を管轄しており、取得には一定の基準を満たす必要があります。",
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=450&fit=crop",
    category: "regulation", author: "編集部", published: true,
  },
  {
    slug: "japanese-cuisine-demand-surge",
    title: "Surge in Japanese Cuisine Demand in Singapore",
    title_ja: "シンガポールでの日本料理需要急増",
    excerpt: "Japanese restaurant openings hit record numbers in Singapore.",
    excerpt_ja: "シンガポールでの日本料理レストランの開業が過去最高を記録しました。",
    content: "Demand for authentic Japanese cuisine is growing significantly. The first half of 2024 saw record new openings of Japanese restaurants.",
    content_ja: "シンガポールでの本格的な日本料理への需要が急増しています。2024年上半期の日本料理レストランの新規開業数は過去最高を記録。和食食材の安定調達を求めるレストランオーナーからの問い合わせも増加しています。",
    image: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&h=450&fit=crop",
    category: "trend", author: "編集部", published: true,
  },
];

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Supabase database...\n");

  await upsert("suppliers", suppliers);
  await upsert("supplier_products", products);
  await upsert("marketplace_items", marketplaceItems);
  await upsert("news_articles", newsArticles);

  console.log("\nDone! Verify in Supabase Dashboard → Table Editor.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
