/**
 * Curated links to Singapore kitchen / homeware retailers (external sites only).
 * Logos via Clearbit may be missing — UI falls back to initials.
 * Card art uses royalty-free Unsplash photos (not retailer product shots).
 */
export type KitchenwareRetailer = {
  id: string;
  url: string;
  name: string;
  nameJa: string;
  blurb: string;
  blurbJa: string;
  logoDomain: string;
  cardImage: string;
};

export const KITCHENWARE_RETAILERS: KitchenwareRetailer[] = [
  {
    id: "tott",
    url: "https://shop.tottstore.com/",
    name: "Tools of the Trade (ToTT)",
    nameJa: "Tools of the Trade（ToTT）",
    blurb: "Cookware, bakeware, and culinary tools — popular with home cooks and pros.",
    blurbJa: "鍋・焼き型・調理器具など、家庭からプロまで人気のキッチン専門店。",
    logoDomain: "tottstore.com",
    cardImage: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&q=80",
  },
  {
    id: "ikea",
    url: "https://www.ikea.com/sg/en/cat/kitchenware-tableware-kt001/",
    name: "IKEA Singapore — Kitchenware",
    nameJa: "IKEA シンガポール（キッチン用品）",
    blurb: "Affordable kitchenware, tableware, and storage for F&B and home kitchens.",
    blurbJa: "飲食店・家庭向けのキッチン用品、食器、収納などを幅広く展開。",
    logoDomain: "ikea.com",
    cardImage: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
  },
  {
    id: "hipvan",
    url: "https://www.hipvan.com/kitchen",
    name: "HipVan — Kitchen",
    nameJa: "HipVan（キッチン）",
    blurb: "Online furniture and kitchen essentials with a modern catalogue.",
    blurbJa: "モダンなオンライン家具・キッチン用品カタログ。",
    logoDomain: "hipvan.com",
    cardImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
  },
  {
    id: "tangs",
    url: "https://tangs.com/productlist/category/HOME-LIVING-KITCHEN-BAKING",
    name: "TANGS — Kitchen and baking",
    nameJa: "TANGS（キッチン・ベイキング）",
    blurb: "Department-store selection of premium kitchen and baking brands.",
    blurbJa: "百貨店品質のキッチン・ベイキングブランド揃え。",
    logoDomain: "tangs.com",
    cardImage: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&q=80",
  },
  {
    id: "taka",
    url: "https://www.takashimaya.com.sg/productlist/category/HOUSEHOLD-COOKING-KITCHEN-KITCHEN-TOOLS",
    name: "Takashimaya — Kitchen tools",
    nameJa: "高島屋（キッチンツール）",
    blurb: "Japanese department store kitchen tools and household cooking lines.",
    blurbJa: "日系百貨店のキッチンツール・調理用品。",
    logoDomain: "takashimaya.com.sg",
    cardImage: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80",
  },
  {
    id: "tramontina",
    url: "https://www.tramontina.com.sg/",
    name: "Tramontina Singapore",
    nameJa: "トラモンティーナ シンガポール",
    blurb: "Professional-grade cookware and knives — common in commercial kitchens.",
    blurbJa: "業務用にも使われる鍋・ナイフなどプロ仕様ブランド。",
    logoDomain: "tramontina.com.sg",
    cardImage: "https://images.unsplash.com/photo-1593618998160-e34014e67546?w=800&q=80",
  },
  {
    id: "nitori",
    url: "https://www.nitori.com.sg/collections/kitchenware-cookware",
    name: "Nitori Singapore — Kitchenware",
    nameJa: "ニトリ シンガポール（キッチン用品）",
    blurb: "Japanese-style homeware: compact storage, tableware, and cookware.",
    blurbJa: "日系ホームセンター：収納・食器・鍋など。",
    logoDomain: "nitori.com.sg",
    cardImage: "https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=800&q=80",
  },
  {
    id: "modori",
    url: "https://modori.sg/",
    name: "Modori",
    nameJa: "Modori",
    blurb: "Stackable, space-saving Korean-designed cookware and dining ware.",
    blurbJa: "積み重ね収納しやすい韓国デザインの鍋・食器。",
    logoDomain: "modori.sg",
    cardImage: "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800&q=80",
  },
  {
    id: "anglee",
    url: "https://angleeseng.com.sg/",
    name: "Ang Lee Seng",
    nameJa: "Ang Lee Seng",
    blurb: "Traditional hardware and kitchen supply merchant in Singapore.",
    blurbJa: "シンガポールの老舗金物・厨房用品店。",
    logoDomain: "angleeseng.com.sg",
    cardImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
  },
  {
    id: "lecreuset",
    url: "https://www.lecreuset.com.sg/",
    name: "Le Creuset Singapore",
    nameJa: "ル・クルーゼ シンガポール",
    blurb: "Premium enamel cast iron and bakeware.",
    blurbJa: "ホーロー鋳物鍋など高級キッチンウェアの公式チャネル。",
    logoDomain: "lecreuset.com.sg",
    cardImage: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80",
  },
];
