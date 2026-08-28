/**
 * Seeds one template post for every tab × category of the three two-sided
 * boards, so each cell of each board can be exercised end to end:
 *
 *   Buy & Sell      /marketplace   Selling / Wanted   × 5 categories = 10 rows
 *   Shop & Takeover /shops         Available / Wanted × 3 types      =  6 rows
 *   F&B Community   /community     7 categories                      =  7 threads
 *                                  + 13 replies (drives the reply_count trigger)
 *
 * Every row carries a fixed id under the `da7a5eed-` ("data seed") namespace, so
 * re-running updates the same rows instead of piling up duplicates, and the
 * eventual cleanup is exact:
 *
 *   node scripts/seed-sample-data.mjs            # insert / refresh
 *   node scripts/seed-sample-data.mjs --remove   # delete every sample row
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Writes go through the service role, so RLS is bypassed and the listings land
 * already approved — no admin queue step needed before testing.
 *
 * `seller_id` / `author_id` are left NULL on purpose: sample content must never
 * be attributed to a real member account.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REMOVE = process.argv.includes("--remove");

// ── env ───────────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(__dirname, "..", ".env.local");
  try {
    const env = {};
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
    return env;
  } catch (e) {
    console.error(`Could not read ${envPath}: ${e.message}`);
    process.exit(1);
  }
}

const env = loadEnv();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const HEADERS = {
  "Content-Type": "application/json",
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

// ── ids ───────────────────────────────────────────────────────────────────────
/** Fixed ids in the `da7a5eed` namespace: 1 = items, 2 = shops, 3 = threads, 4 = replies. */
const id = (group, n) => `da7a5eed-000${group}-4000-8000-${String(n).padStart(12, "0")}`;
const ITEM = (n) => id(1, n);
const SHOP = (n) => id(2, n);
const THREAD = (n) => id(3, n);
const REPLY = (n) => id(4, n);

const img = (photo, w = 800, h = 600) =>
  `https://images.unsplash.com/${photo}?w=${w}&h=${h}&fit=crop`;

// ── Buy & Sell — 5 categories × Selling / Wanted ──────────────────────────────
// `condition` / `area` / `delivery` hold the JA label and the `_en` twin holds
// the English one, matching the existing rows and the admin edit form.
const COND = {
  likeNew: { condition: "新品同様", condition_en: "Like new" },
  good: { condition: "良好", condition_en: "Good" },
  used: { condition: "使用感あり", condition_en: "Used" },
  repair: { condition: "要修理", condition_en: "Needs repair" },
};
const AREA = {
  central: { area: "中央エリア", area_en: "Central" },
  east: { area: "東部エリア", area_en: "East" },
  west: { area: "西部エリア", area_en: "West" },
  north: { area: "北部エリア", area_en: "North" },
  south: { area: "南部エリア", area_en: "South" },
};
const DELIVERY = {
  pickup: { delivery: "引き取りのみ", delivery_en: "Pickup only" },
  delivery: { delivery: "配送可能", delivery_en: "Delivery available" },
  both: { delivery: "引き取り・配送可", delivery_en: "Pickup or delivery" },
};

function item(n, row) {
  const { photo, ...rest } = row;
  return {
    id: ITEM(n),
    status: "approved",
    seller_id: null,
    seller_whatsapp: "6580000000",
    image: img(photo, 600, 450),
    images: [img(photo)],
    ...rest,
  };
}

const MARKETPLACE_ITEMS = [
  // ── Selling ────────────────────────────────────────────────────────────────
  item(1, {
    slug: "sample-6-burner-gas-range",
    post_type: "selling",
    category: "kitchen-equipment",
    title: "業務用6口ガスレンジ（オーブン付き）",
    title_en: "6-burner gas range with oven",
    price: 1800,
    years_used: 3,
    description:
      "厨房縮小のため出品します。6口すべて点火良好、下部オーブンも問題なく使用できます。半年ごとに業者点検済み、点検記録もお渡しします。",
    description_en:
      "Listed as we are downsizing the kitchen. All six burners ignite cleanly and the lower oven works without issue. Serviced every six months — maintenance records included.",
    photo: "photo-1590794056226-79ef3a8147e1",
    seller_name: "Sample Kitchen SG",
    created_at: "2026-08-24T02:00:00+00:00",
    ...COND.good,
    ...AREA.central,
    ...DELIVERY.pickup,
  }),
  item(2, {
    slug: "sample-porcelain-dinnerware-120pc",
    post_type: "selling",
    category: "tableware",
    title: "白磁食器セット 120点（未使用）",
    title_en: "Porcelain dinnerware set, 120 pieces (unused)",
    price: 420,
    years_used: 0,
    description:
      "コンセプト変更により未使用のまま保管していた白磁の食器です。プレート60枚、ボウル40個、小皿20枚。欠けはありません。",
    description_en:
      "White porcelain kept in storage unused after a concept change: 60 plates, 40 bowls, 20 side dishes. No chips or cracks.",
    photo: "photo-1578985545062-69928b1d9587",
    seller_name: "Sample Bistro",
    created_at: "2026-08-22T03:30:00+00:00",
    ...COND.likeNew,
    ...AREA.east,
    ...DELIVERY.both,
  }),
  item(3, {
    slug: "sample-japanese-knife-set",
    post_type: "selling",
    category: "tools",
    title: "和包丁3本セット（柳刃・出刃・薄刃）",
    title_en: "Japanese knife set of 3 (yanagiba, deba, usuba)",
    price: 680,
    years_used: 2,
    description:
      "白紙2号の和包丁3本セット。研ぎ直し済みですぐに使えます。桐箱と刃カバー付き。刃こぼれはありません。",
    description_en:
      "Three white-steel #2 Japanese knives, freshly sharpened and ready to use. Comes with a paulownia box and blade guards. No chips on any edge.",
    photo: "photo-1593618998160-e34014e67546",
    seller_name: "Sample Sushi Bar",
    created_at: "2026-08-20T06:15:00+00:00",
    ...COND.good,
    ...AREA.central,
    ...DELIVERY.delivery,
  }),
  item(4, {
    slug: "sample-oak-cafe-tables-chairs",
    post_type: "selling",
    category: "furniture",
    title: "カフェ用オーク材テーブル12台＋椅子40脚",
    title_en: "12 oak café tables and 40 chairs",
    price: 2400,
    years_used: 4,
    description:
      "内装リニューアルに伴いまとめてお譲りします。天板に細かな使用傷はありますが、ぐらつきはありません。バラ売りも相談可能です。",
    description_en:
      "Selling as one lot ahead of an interior refresh. Light surface marks on the tabletops, but nothing wobbles. Happy to discuss splitting the lot.",
    photo: "photo-1554118811-1e0d58224f24",
    seller_name: "Sample Coffee House",
    created_at: "2026-08-18T01:45:00+00:00",
    ...COND.used,
    ...AREA.west,
    ...DELIVERY.pickup,
  }),
  item(5, {
    slug: "sample-shopfront-neon-signage",
    post_type: "selling",
    category: "other",
    title: "店頭ネオンサイン＋メニュー用ライトボックス",
    title_en: "Shopfront neon sign and menu light box",
    price: 180,
    years_used: 5,
    description:
      "店頭で使用していたネオンサインとメニュー用ライトボックスです。ライトボックスは片側のLEDがちらつくため、交換前提でお願いします。",
    description_en:
      "Shopfront neon sign plus a menu light box. One LED strip in the light box flickers, so please budget for a replacement.",
    photo: "photo-1565299624946-b28f40a0ae38",
    seller_name: "Sample Diner",
    created_at: "2026-08-16T08:20:00+00:00",
    ...COND.repair,
    ...AREA.north,
    ...DELIVERY.pickup,
  }),

  // ── Wanted — `price` carries the poster's budget ────────────────────────────
  item(6, {
    slug: "sample-wanted-undercounter-chiller",
    post_type: "wanted",
    category: "kitchen-equipment",
    title: "【探しています】2ドア アンダーカウンター冷蔵庫",
    title_en: "[Wanted] 2-door undercounter chiller",
    price: 900,
    years_used: 0,
    description:
      "新店舗の仕込み場用に2ドアのアンダーカウンター冷蔵庫を探しています。幅1200mm前後、動作確認できるものを希望します。9月中旬の引き渡しが理想です。",
    description_en:
      "Looking for a 2-door undercounter chiller for the prep area of a new outlet. Around 1200mm wide and in verified working order. Mid-September handover preferred.",
    photo: "photo-1584568694244-14fbdf83bd30",
    seller_name: "Sample Ramen Co.",
    created_at: "2026-08-25T04:00:00+00:00",
    ...COND.good,
    ...AREA.east,
    ...DELIVERY.both,
  }),
  item(7, {
    slug: "sample-wanted-ramen-bowls",
    post_type: "wanted",
    category: "tableware",
    title: "【探しています】ラーメン丼 100個以上",
    title_en: "[Wanted] 100+ ramen bowls",
    price: 300,
    years_used: 0,
    description:
      "同柄で100個以上まとまるラーメン丼を探しています。直径20cm以上、欠けのないものを希望します。閉店在庫の一括譲渡も歓迎です。",
    description_en:
      "After 100+ matching ramen bowls, 20cm diameter or larger, with no chips. Happy to take closing-down stock as a single lot.",
    photo: "photo-1557872943-16a5ac26437e",
    seller_name: "Sample Noodle Bar",
    created_at: "2026-08-23T07:10:00+00:00",
    ...COND.likeNew,
    ...AREA.central,
    ...DELIVERY.pickup,
  }),
  item(8, {
    slug: "sample-wanted-stand-mixer",
    post_type: "wanted",
    category: "tools",
    title: "【探しています】業務用スタンドミキサー 20クォート",
    title_en: "[Wanted] Commercial stand mixer, 20 quart",
    price: 1200,
    years_used: 0,
    description:
      "ベーカリー立ち上げのため20クォートのスタンドミキサーを探しています。ボウルとフックが揃っていれば多少の使用感は問いません。",
    description_en:
      "Setting up a bakery and looking for a 20-quart stand mixer. Cosmetic wear is fine as long as the bowl and hook are included.",
    photo: "photo-1607623814075-e51df1bdc82f",
    seller_name: "Sample Bakery",
    created_at: "2026-08-21T05:25:00+00:00",
    ...COND.good,
    ...AREA.west,
    ...DELIVERY.delivery,
  }),
  item(9, {
    slug: "sample-wanted-bar-stools",
    post_type: "wanted",
    category: "furniture",
    title: "【探しています】カウンター用バースツール 10脚",
    title_en: "[Wanted] 10 counter bar stools",
    price: 500,
    years_used: 0,
    description:
      "カウンター席の増設用にバースツールを10脚探しています。座面高さ65〜75cm、木製またはスチール製を希望します。多少の傷は構いません。",
    description_en:
      "Need 10 bar stools to extend a counter. Seat height 65–75cm, timber or steel. Minor scuffs are not a problem.",
    photo: "photo-1414235077428-338989a2e8c0",
    seller_name: "Sample Izakaya",
    created_at: "2026-08-19T09:40:00+00:00",
    ...COND.used,
    ...AREA.south,
    ...DELIVERY.pickup,
  }),
  item(10, {
    // "other:<free text>" is what the post form writes when a member types their
    // own category — it still belongs under the Other filter.
    slug: "sample-wanted-shopfront-signage",
    post_type: "wanted",
    category: "other:Signage & Lighting",
    title: "【探しています】店頭サイン・照明一式",
    title_en: "[Wanted] Shopfront signage and lighting",
    price: 250,
    years_used: 0,
    description:
      "10月オープンの店舗用に、店頭サインと什器照明を探しています。閉店される店舗からまとめて譲っていただけると助かります。",
    description_en:
      "Fitting out a shop opening in October and looking for shopfront signage plus display lighting. Ideally a single lot from a closing outlet.",
    photo: "photo-1526367790999-0150786686a2",
    seller_name: "Sample Cafe Project",
    created_at: "2026-08-17T02:55:00+00:00",
    ...COND.used,
    ...AREA.north,
    ...DELIVERY.both,
  }),
];

// ── Shop & Takeover — 3 listing types × Available / Wanted ────────────────────
// On a "wanted" post the rent / price / size fields carry the seeker's budget
// and requirements rather than a real unit's figures.
function shop(n, row) {
  const { photo, ...rest } = row;
  return {
    id: SHOP(n),
    status: "approved",
    seller_id: null,
    seller_whatsapp: "6580000000",
    image: img(photo, 600, 450),
    images: [img(photo)],
    ...rest,
  };
}

const SHOP_LISTINGS = [
  // ── Available ──────────────────────────────────────────────────────────────
  shop(1, {
    slug: "sample-tanjong-pagar-shop-for-rent",
    post_type: "available",
    listing_type: "rent",
    title: "タンジョンパガー 路面店舗（居抜き・排気ダクト有）",
    location: "Tanjong Pagar",
    building: "Icon Village",
    monthly_rent: "S$6,500/mo",
    floor_size: "650 sqft",
    asking_price: "",
    lease_remaining: "3 years",
    suitable_for: "Cafe, casual dining, bakery",
    key_features: ["exhaust-hood", "gas-supply", "fully-fitted-kitchen"],
    reason: "Current tenant is relocating to a larger unit.",
    description:
      "Ground-floor corner unit on a lunch-crowd stretch, five minutes from Tanjong Pagar MRT. Exhaust duct and gas are already in place, so an F&B fit-out can start immediately. Grease trap and three-phase power available.",
    seller_name: "Sample Property Agent",
    created_at: "2026-08-25T01:00:00+00:00",
    photo: "photo-1552566626-52f8b828add9",
  }),
  shop(2, {
    slug: "sample-bugis-ramen-takeover",
    post_type: "available",
    listing_type: "takeover",
    title: "ブギス ラーメン店 居抜き譲渡（営業中・スタッフ引継可）",
    location: "Bugis",
    building: "Bugis Cube",
    monthly_rent: "S$8,200/mo",
    floor_size: "900 sqft",
    asking_price: "S$85,000",
    lease_remaining: "2 years 4 months",
    suitable_for: "Ramen, Japanese casual dining",
    key_features: ["exhaust-hood", "gas-supply", "fully-fitted-kitchen", "outdoor-seating"],
    reason: "Owner is returning to Japan.",
    description:
      "Trading ramen shop with 34 seats, handed over as a going concern. Kitchen equipment, POS and supplier contacts are all included, and the four current staff are open to staying on. Books available to serious buyers after an NDA.",
    seller_name: "Sample Ramen Owner",
    created_at: "2026-08-23T02:30:00+00:00",
    photo: "photo-1517248135467-4c7edcad34c4",
  }),
  shop(3, {
    slug: "sample-tiong-bahru-corner-unit",
    post_type: "available",
    listing_type: "both",
    title: "ティオンバル 角地カフェ物件（賃貸・居抜き譲渡どちらも可）",
    location: "Tiong Bahru",
    building: "Standalone shophouse",
    monthly_rent: "S$5,800/mo",
    floor_size: "780 sqft",
    asking_price: "S$60,000",
    lease_remaining: "2 years",
    suitable_for: "Cafe, brunch, wine bar",
    key_features: ["exhaust-hood", "outdoor-seating", "liquor-licence"],
    reason: "Owner is consolidating to a single outlet.",
    description:
      "Corner shophouse unit with a five-table alfresco licence and a transferable liquor licence. Available either as a straight lease or as a takeover with the existing fit-out and equipment — the asking price covers the takeover option.",
    seller_name: "Sample Cafe Group",
    created_at: "2026-08-21T04:20:00+00:00",
    photo: "photo-1521017432531-fbd92d768814",
  }),

  // ── Wanted ─────────────────────────────────────────────────────────────────
  shop(4, {
    slug: "sample-wanted-central-shop-for-rent",
    post_type: "wanted",
    listing_type: "rent",
    title: "【探しています】中央エリアの賃貸店舗 600〜900 sqft",
    location: "Central (Tanjong Pagar / Chinatown / Telok Ayer)",
    building: "Shophouse or mall unit",
    monthly_rent: "Budget up to S$7,000/mo",
    floor_size: "600–900 sqft",
    asking_price: "",
    lease_remaining: "2 years or longer preferred",
    suitable_for: "Japanese casual dining, 30–40 seats",
    key_features: ["exhaust-hood", "gas-supply"],
    reason: "Opening a second outlet in Q4.",
    description:
      "Looking for a lunch-trade unit in the Central area for a second Japanese casual dining outlet. Exhaust duct and gas supply are must-haves; a bare unit is fine as we will fit out ourselves. Ready to take over from October.",
    seller_name: "Sample Restaurant Group",
    created_at: "2026-08-24T06:00:00+00:00",
    photo: "photo-1555396273-367ea4eb4db5",
  }),
  shop(5, {
    slug: "sample-wanted-east-cafe-takeover",
    post_type: "wanted",
    listing_type: "takeover",
    title: "【探しています】東部エリアのカフェ居抜き譲渡",
    location: "East (Katong / Joo Chiat / Siglap)",
    building: "Shophouse preferred",
    monthly_rent: "Budget up to S$5,500/mo",
    floor_size: "500–800 sqft",
    asking_price: "Budget up to S$50,000",
    lease_remaining: "18 months or longer preferred",
    suitable_for: "Specialty coffee, brunch",
    key_features: ["exhaust-hood", "outdoor-seating"],
    reason: "First outlet — prefer a fitted space to shorten setup.",
    description:
      "First-time operator looking to take over a running or recently closed café in the East. A usable existing fit-out matters more than size — we would rather inherit equipment than build from scratch. Can complete within a month.",
    seller_name: "Sample Coffee Startup",
    created_at: "2026-08-22T08:45:00+00:00",
    photo: "photo-1554118811-1e0d58224f24",
  }),
  shop(6, {
    slug: "sample-wanted-west-halal-space",
    post_type: "wanted",
    listing_type: "both",
    title: "【探しています】西部エリア ハラール対応可能な店舗（賃貸・譲渡問わず）",
    location: "West (Jurong East / Clementi / Bukit Batok)",
    building: "Mall unit or HDB commercial",
    monthly_rent: "Budget up to S$6,000/mo",
    floor_size: "700–1,100 sqft",
    asking_price: "Budget up to S$40,000",
    lease_remaining: "Open",
    suitable_for: "Halal-certified casual dining",
    key_features: ["exhaust-hood", "gas-supply", "fully-fitted-kitchen"],
    reason: "Expanding a halal-certified concept westward.",
    description:
      "Open to either a lease or a takeover in the West. The unit must be able to pass halal certification — no shared pork-handling kitchen. Heavy weekend footfall matters more to us than a prime frontage.",
    seller_name: "Sample Halal Kitchen",
    created_at: "2026-08-20T03:15:00+00:00",
    photo: "photo-1590846406792-0adc7f938f1d",
  }),
];

// ── F&B Community — one thread per category ──────────────────────────────────
// Thread 1 is old but has the newest replies, and thread 6 is the newest with
// almost no activity, so "Latest activity" and "Newest" sort visibly differently.
// The reply_count / last_reply_at columns are left to the DB trigger.
function thread(n, row) {
  return {
    id: THREAD(n),
    author_id: null,
    author_avatar: "",
    status: "active",
    pinned: false,
    locked: false,
    view_count: 0,
    reply_count: 0,
    // Overwritten by the trigger for any thread that has replies.
    last_reply_at: row.created_at,
    updated_at: row.created_at,
    ...row,
  };
}

const COMMUNITY_THREADS = [
  thread(1, {
    category: "general",
    pinned: true,
    title: "Read first: how this board works (and what gets the best answers)",
    content:
      "Welcome to the F&B Community. A few things that make this board useful for everyone:\n\n1. Pick the category that matches your question — it is how people find threads worth answering.\n2. Add tags for the specifics (Halal, Cafe, Central Area). Categories stay broad on purpose; tags carry the detail.\n3. Put the real question in the title. \"Need help\" gets skipped; \"Which grease trap servicing interval passes NEA?\" gets answered.\n4. Numbers help. Rent, headcount, covers per day — people can only advise against something concrete.\n\nIf you are hiring, selling equipment or offering a space, the Jobs, Buy & Sell and Shop boards are better places for the listing itself. Use this board for the questions around it.",
    tags: ["Restaurant", "Cafe"],
    author_name: "Sample Moderator",
    view_count: 412,
    created_at: "2026-08-05T02:00:00+00:00",
  }),
  thread(2, {
    category: "suppliers",
    title: "Seafood suppliers doing genuine next-day delivery — who are you using?",
    content:
      "We run a 40-seat Japanese place in the CBD and our current seafood supplier has slipped to two or three days on anything that is not salmon. Weekend specials keep getting pulled.\n\nWho are you ordering from that actually holds a next-day cut-off? Order minimum is not a problem for us — consistency is. Interested in both wholesalers and smaller importers.",
    tags: ["Supplier", "Japanese Food", "Central Area"],
    author_name: "Sample Chef",
    view_count: 186,
    created_at: "2026-08-26T01:30:00+00:00",
  }),
  thread(3, {
    category: "staff",
    title: "How are you covering kitchen shifts right now?",
    content:
      "Down two line cooks since June and the usual job portals are returning almost nothing usable. We have tried raising the band about 12% with no real change in applicant quality.\n\nAre referral bonuses still working for anyone? And for those who moved to a four-day roster — did it actually help retention, or did it just push overtime somewhere else?",
    tags: ["Hiring", "Restaurant"],
    author_name: "Sample Owner",
    view_count: 231,
    created_at: "2026-08-20T05:00:00+00:00",
  }),
  thread(4, {
    category: "shop",
    title: "Is Tanjong Pagar still worth the rent in 2026?",
    content:
      "Looking at a 650 sqft unit off Tanjong Pagar Road at S$6,500/mo. Lunch footfall looks strong on weekdays but the street is close to dead by Saturday afternoon.\n\nFor those trading in the area now — is the weekday lunch trade carrying the rent on its own, or are you relying on dinner and delivery to make it work? Trying to sanity-check the numbers before committing to a three-year lease.",
    tags: ["Central Area", "Restaurant"],
    author_name: "Sample Operator",
    view_count: 158,
    created_at: "2026-08-24T07:15:00+00:00",
  }),
  thread(5, {
    category: "equipment",
    title: "Combi oven vs another convection — is the upgrade worth it at our size?",
    content:
      "Our convection oven is on its last legs. A replacement is about S$4k; a used combi is quoting around S$11k.\n\nWe do roughly 120 covers a day across a bakery-café menu. Everyone who owns a combi tells me they would never go back, but I would like to hear the honest version — how much of the gain is real at this volume, and how bad is the servicing bill once it is out of warranty?",
    tags: ["Restaurant", "Cafe"],
    author_name: "Sample Baker",
    view_count: 274,
    created_at: "2026-08-12T03:40:00+00:00",
  }),
  thread(6, {
    category: "business",
    title: "What actually moved the needle on marketing this year?",
    content:
      "Comparing where our marketing budget went in the first half against what it returned, and the honest answer is that most of it did nothing measurable.\n\nWhat has genuinely worked for you in 2026 — short video, an email list, delivery-platform promos, or something less obvious? Especially interested in anyone tracking it properly rather than going on feel.",
    tags: ["Cafe", "Bar"],
    author_name: "Sample Marketer",
    view_count: 97,
    created_at: "2026-08-27T06:20:00+00:00",
  }),
  thread(7, {
    category: "collaboration",
    locked: true,
    title: "[Closed] Looking for a pop-up partner — halal dessert concept, 6 weeks",
    content:
      "We have a six-week slot in a Bugis mall atrium starting mid-September and are after a halal-certified dessert partner to share it with. We cover the space and the licensing; you bring the product and one staff member per shift. Revenue split negotiable.\n\nUpdate: partner found — thanks to everyone who reached out. Closing this thread so it stops collecting replies.",
    tags: ["Halal", "Cafe"],
    author_name: "Sample Events Team",
    view_count: 143,
    created_at: "2026-08-18T04:10:00+00:00",
  }),
];

function reply(n, threadN, row) {
  return {
    id: REPLY(n),
    thread_id: THREAD(threadN),
    author_id: null,
    author_avatar: "",
    status: "active",
    updated_at: row.created_at,
    ...row,
  };
}

const COMMUNITY_REPLIES = [
  // Thread 1 — old thread kept alive by recent replies
  reply(1, 1, {
    author_name: "Sample Chef",
    content:
      "Adding one: search before you post. Half the rent and licensing questions here already have a thread with the answer, and the old ones usually have better detail than a fresh reply will.",
    created_at: "2026-08-06T01:15:00+00:00",
  }),
  reply(2, 1, {
    author_name: "Sample Owner",
    content:
      "Worth saying plainly — people share real numbers on this board because it stays civil. If someone posts their P&L, do not screenshot it elsewhere.",
    created_at: "2026-08-14T08:30:00+00:00",
  }),
  reply(3, 1, {
    author_name: "Sample Supplier Rep",
    content:
      "From the supplier side: we do read these threads. If you name a category rather than a company when something goes wrong, you tend to get more useful replies and fewer defensive ones.",
    created_at: "2026-08-27T09:45:00+00:00",
  }),
  // Thread 2
  reply(4, 2, {
    author_name: "Sample Izakaya",
    content:
      "We moved to a smaller importer in Jurong Fishery Port about eight months ago. Cut-off is 4pm for next-morning delivery and they have missed it twice all year. Minimum is S$300 per drop, which is the trade-off.",
    created_at: "2026-08-26T04:20:00+00:00",
  }),
  reply(5, 2, {
    author_name: "Sample Chef",
    content:
      "That minimum is fine for us, thanks. Did you have to commit to fixed delivery days, or can you order ad hoc for weekend specials?",
    created_at: "2026-08-26T07:05:00+00:00",
  }),
  // Thread 3
  reply(6, 3, {
    author_name: "Sample Restaurant Group",
    content:
      "Referral bonus works for us but only when it is paid in two parts — half on start, half at three months. Paying it all up front just bought us a lot of two-week hires.",
    created_at: "2026-08-20T09:10:00+00:00",
  }),
  reply(7, 3, {
    author_name: "Sample Baker",
    content:
      "We went to a four-day roster in March. Retention did improve, but be honest with yourself about prep time — we had to move two hours of morning prep to a part-timer, so the saving was smaller than it looked on paper.",
    created_at: "2026-08-21T02:50:00+00:00",
  }),
  // Thread 4
  reply(8, 4, {
    author_name: "Sample Cafe Group",
    content:
      "We trade two streets over. Weekday lunch is genuinely strong, but it will not carry S$6,500 on its own — dinner plus delivery is roughly 40% of our revenue. Do not sign a three-year lease on the lunch numbers alone.",
    created_at: "2026-08-25T03:35:00+00:00",
  }),
  // Thread 5
  reply(9, 5, {
    author_name: "Sample Ramen Owner",
    content:
      "At 120 covers the combi pays for itself mostly in labour, not output — you stop babysitting trays. Servicing is the real cost: budget around S$1,200 a year once the warranty lapses, and more if your water is hard and you skip the softener.",
    created_at: "2026-08-13T01:25:00+00:00",
  }),
  reply(10, 5, {
    author_name: "Sample Bistro",
    content:
      "Counterpoint — we bought a used combi and spent nearly S$3k on the steam generator in year one. If you go used, pay for an independent inspection first. At S$11k I would want service records before I signed anything.",
    created_at: "2026-08-14T06:40:00+00:00",
  }),
  // Thread 6 — newest thread, minimal activity
  reply(11, 6, {
    author_name: "Sample Coffee House",
    content:
      "The only thing we can actually attribute revenue to is the email list. It is unglamorous and slow to build, but a Thursday send still fills Saturday brunch better than anything we have paid for.",
    created_at: "2026-08-28T02:10:00+00:00",
  }),
  // Thread 7 — locked after the partner was found
  reply(12, 7, {
    author_name: "Sample Halal Kitchen",
    content:
      "Interested — we are halal-certified and have run two mall pop-ups before. Sent you a message with our menu and the equipment we would bring.",
    created_at: "2026-08-18T08:00:00+00:00",
  }),
  reply(13, 7, {
    author_name: "Sample Events Team",
    content:
      "Slot is filled — thanks all. For anyone planning something similar: the mall wanted the halal certificate and the public liability policy three weeks before the start date, so leave time for that.",
    created_at: "2026-08-19T05:30:00+00:00",
  }),
];

// ── PostgREST helpers ─────────────────────────────────────────────────────────
async function upsert(table, rows) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?on_conflict=id`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${table}: ${res.status} ${text.slice(0, 400)}`);
  return JSON.parse(text || "[]");
}

async function removeByIds(table, ids) {
  const list = ids.map((v) => `"${v}"`).join(",");
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?id=in.(${list})`, {
    method: "DELETE",
    headers: { ...HEADERS, Prefer: "return=representation" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${table}: ${res.status} ${text.slice(0, 400)}`);
  return JSON.parse(text || "[]");
}

async function count(table, filter) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?select=id&${filter}`, {
    headers: { ...HEADERS, Prefer: "count=exact", Range: "0-0" },
  });
  const range = res.headers.get("content-range") || "";
  return Number(range.split("/")[1] ?? 0);
}

// ── run ───────────────────────────────────────────────────────────────────────
async function main() {
  if (REMOVE) {
    console.log("\nRemoving sample data...\n");
    // Replies first: the thread FK cascades, but deleting them explicitly keeps
    // the reported counts honest.
    const replies = await removeByIds("community_replies", COMMUNITY_REPLIES.map((r) => r.id));
    const threads = await removeByIds("community_threads", COMMUNITY_THREADS.map((r) => r.id));
    const shops = await removeByIds("shop_listings", SHOP_LISTINGS.map((r) => r.id));
    const items = await removeByIds("marketplace_items", MARKETPLACE_ITEMS.map((r) => r.id));
    console.log(`  marketplace_items   removed ${items.length}`);
    console.log(`  shop_listings       removed ${shops.length}`);
    console.log(`  community_threads   removed ${threads.length}`);
    console.log(`  community_replies   removed ${replies.length}`);
    console.log("\nDone. No sample rows remain.\n");
    return;
  }

  console.log("\nSeeding sample data...\n");
  const items = await upsert("marketplace_items", MARKETPLACE_ITEMS);
  console.log(`  marketplace_items   ${items.length} rows`);
  const shops = await upsert("shop_listings", SHOP_LISTINGS);
  console.log(`  shop_listings       ${shops.length} rows`);
  const threads = await upsert("community_threads", COMMUNITY_THREADS);
  console.log(`  community_threads   ${threads.length} rows`);
  const replies = await upsert("community_replies", COMMUNITY_REPLIES);
  console.log(`  community_replies   ${replies.length} rows`);

  // Coverage report — every tab × category cell should read at least 1.
  console.log("\nCoverage (sample rows only)\n");

  console.log("  Buy & Sell — /marketplace");
  for (const postType of ["selling", "wanted"]) {
    for (const category of ["kitchen-equipment", "tableware", "tools", "furniture", "other"]) {
      const n = MARKETPLACE_ITEMS.filter(
        (i) => i.post_type === postType && i.category.split(":")[0] === category,
      ).length;
      console.log(`    ${postType.padEnd(8)} ${category.padEnd(18)} ${n}`);
    }
  }

  console.log("\n  Shop & Takeover — /shops");
  for (const postType of ["available", "wanted"]) {
    for (const listingType of ["rent", "takeover", "both"]) {
      const n = SHOP_LISTINGS.filter(
        (s) => s.post_type === postType && s.listing_type === listingType,
      ).length;
      console.log(`    ${postType.padEnd(10)} ${listingType.padEnd(10)} ${n}`);
    }
  }

  console.log("\n  F&B Community — /community");
  for (const category of [
    "general", "suppliers", "staff", "shop", "equipment", "business", "collaboration",
  ]) {
    const t = COMMUNITY_THREADS.find((x) => x.category === category);
    const n = COMMUNITY_REPLIES.filter((r) => r.thread_id === t.id).length;
    console.log(`    ${category.padEnd(15)} 1 thread, ${n} replies`);
  }

  // Confirms the reply trigger recomputed reply_count / last_reply_at.
  const threadIds = COMMUNITY_THREADS.map((t) => `"${t.id}"`).join(",");
  const synced = await count("community_threads", `id=in.(${threadIds})&reply_count=gt.0`);
  const expected = new Set(COMMUNITY_REPLIES.map((r) => r.thread_id)).size;
  console.log(`\n  Threads with reply_count synced by the DB trigger: ${synced} of ${expected}`);
  console.log("\nDone. Remove it later with: node scripts/seed-sample-data.mjs --remove\n");
}

main().catch((e) => {
  console.error(`\nFailed: ${e.message}\n`);
  process.exit(1);
});
