/**
 * Illustrative “inspiration” tiles only — not copies of retailer catalogues.
 * Each row links out to a real retailer category; images are Unsplash (royalty-free).
 * Do not present these as items sold on F&B Portal.
 */
export type KitchenwareShowcaseItem = {
  id: string;
  title: string;
  titleJa: string;
  caption: string;
  captionJa: string;
  image: string;
  shopUrl: string;
  shopLabel: string;
};

export const KITCHENWARE_SHOWCASE: KitchenwareShowcaseItem[] = [
  {
    id: "1",
    title: "Cast-iron & enamel cookware",
    titleJa: "鋳物ホーロー鍋",
    caption: "Durable for braising, baking, and buffet service.",
    captionJa: "煮込み・オーブン・ビュッフェに強い定番。",
    image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80",
    shopUrl: "https://www.lecreuset.com.sg/",
    shopLabel: "Le Creuset SG",
  },
  {
    id: "2",
    title: "Minimal tableware sets",
    titleJa: "ミニマルな食器セット",
    caption: "Neutral plates and bowls for cafés and casual dining.",
    captionJa: "カフェ・カジュアル向けの落ち着いた食器。",
    image: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&q=80",
    shopUrl: "https://www.ikea.com/sg/en/cat/kitchenware-tableware-kt001/",
    shopLabel: "IKEA SG",
  },
  {
    id: "3",
    title: "Chef knives & prep",
    titleJa: "包丁・下ごしらえ",
    caption: "Sharp edges and boards for high-volume prep.",
    captionJa: "大量仕込み向けの刃物とまな板。",
    image: "https://images.unsplash.com/photo-1593618998160-e34014e67546?w=600&q=80",
    shopUrl: "https://shop.tottstore.com/",
    shopLabel: "ToTT",
  },
  {
    id: "4",
    title: "Baking tins & moulds",
    titleJa: "焼き型・モールド",
    caption: "Cakes, pastries, and production baking essentials.",
    captionJa: "ケーキ・パン製造向けの型・道具。",
    image: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=600&q=80",
    shopUrl: "https://tangs.com/productlist/category/HOME-LIVING-KITCHEN-BAKING",
    shopLabel: "TANGS",
  },
  {
    id: "5",
    title: "Stainless steel pans",
    titleJa: "ステンレスフライパン",
    caption: "Even heat for proteins and sauces on the line.",
    captionJa: "ライン料理向けの均一な熱伝導。",
    image: "https://images.unsplash.com/photo-1593618998160-e34014e67546?w=600&q=80",
    shopUrl: "https://www.tramontina.com.sg/",
    shopLabel: "Tramontina",
  },
  {
    id: "6",
    title: "Compact storage & jars",
    titleJa: "収納・保存容器",
    caption: "Dry storage and mise en place in tight kitchens.",
    captionJa: "狭い厨房でのドライストック・仕込み整理。",
    image: "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=600&q=80",
    shopUrl: "https://www.nitori.com.sg/collections/kitchenware-cookware",
    shopLabel: "Nitori",
  },
  {
    id: "7",
    title: "Modern kitchen furniture",
    titleJa: "モダンキッチン家具",
    caption: "Islands, carts, and open-kitchen layouts.",
    captionJa: "アイランド・ワゴン・オープンキッチン向け。",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80",
    shopUrl: "https://www.hipvan.com/kitchen",
    shopLabel: "HipVan",
  },
  {
    id: "8",
    title: "Japanese kitchen gadgets",
    titleJa: "日系キッチン小物",
    caption: "Peelers, graters, and specialty tools.",
    captionJa: "ピーラー・おろし金など専門小物。",
    image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=600&q=80",
    shopUrl: "https://www.takashimaya.com.sg/productlist/category/HOUSEHOLD-COOKING-KITCHEN-KITCHEN-TOOLS",
    shopLabel: "Takashimaya",
  },
  {
    id: "9",
    title: "Stackable cookware sets",
    titleJa: "積み重ね鍋セット",
    caption: "Space-saving stacks for small back-of-house.",
    captionJa: "狭い下準備室向けの省スペース鍋。",
    image: "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=600&q=80",
    shopUrl: "https://modori.sg/",
    shopLabel: "Modori",
  },
  {
    id: "10",
    title: "Commercial-style supplies",
    titleJa: "業務用に近い用品",
    caption: "Pots, ladles, and hardware-store classics.",
    captionJa: "寸胴・おたま・金物店で揃う定番。",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
    shopUrl: "https://angleeseng.com.sg/",
    shopLabel: "Ang Lee Seng",
  },
];
