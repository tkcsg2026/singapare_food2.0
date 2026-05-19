/**
 * Country-of-origin display helpers.
 *
 * Suppliers often only fill in the Japanese country name (e.g. 日本 / マレーシア).
 * When viewing the site in English we want to translate those values automatically
 * so the UI doesn't show Japanese on the English page.
 *
 * The mapping is a best-effort lookup table covering the most common origins for
 * Singapore F&B suppliers.  Unknown values fall back to the original string.
 */

const JA_TO_EN_MAP: Record<string, string> = {
  // East Asia
  "日本": "Japan",
  "国産": "Japan",
  "国内": "Japan",
  "中国": "China",
  "中華人民共和国": "China",
  "韓国": "South Korea",
  "大韓民国": "South Korea",
  "台湾": "Taiwan",
  "香港": "Hong Kong",
  "モンゴル": "Mongolia",

  // South-East Asia
  "シンガポール": "Singapore",
  "マレーシア": "Malaysia",
  "タイ": "Thailand",
  "タイ王国": "Thailand",
  "ベトナム": "Vietnam",
  "インドネシア": "Indonesia",
  "フィリピン": "Philippines",
  "ミャンマー": "Myanmar",
  "カンボジア": "Cambodia",
  "ラオス": "Laos",
  "ブルネイ": "Brunei",

  // South Asia / Middle East
  "インド": "India",
  "ネパール": "Nepal",
  "スリランカ": "Sri Lanka",
  "バングラデシュ": "Bangladesh",
  "パキスタン": "Pakistan",
  "イラン": "Iran",
  "イスラエル": "Israel",
  "トルコ": "Turkey",
  "サウジアラビア": "Saudi Arabia",
  "アラブ首長国連邦": "United Arab Emirates",

  // Oceania
  "オーストラリア": "Australia",
  "豪州": "Australia",
  "ニュージーランド": "New Zealand",
  "NZ": "New Zealand",

  // North America
  "アメリカ": "USA",
  "アメリカ合衆国": "USA",
  "米国": "USA",
  "USA": "USA",
  "カナダ": "Canada",
  "メキシコ": "Mexico",

  // South / Central America
  "ブラジル": "Brazil",
  "アルゼンチン": "Argentina",
  "チリ": "Chile",
  "ペルー": "Peru",
  "コロンビア": "Colombia",
  "エクアドル": "Ecuador",
  "ウルグアイ": "Uruguay",
  "パラグアイ": "Paraguay",
  "ベネズエラ": "Venezuela",
  "コスタリカ": "Costa Rica",
  "パナマ": "Panama",

  // Europe
  "イギリス": "United Kingdom",
  "英国": "United Kingdom",
  "UK": "United Kingdom",
  "アイルランド": "Ireland",
  "フランス": "France",
  "ドイツ": "Germany",
  "イタリア": "Italy",
  "スペイン": "Spain",
  "ポルトガル": "Portugal",
  "オランダ": "Netherlands",
  "ベルギー": "Belgium",
  "ルクセンブルク": "Luxembourg",
  "スイス": "Switzerland",
  "オーストリア": "Austria",
  "ノルウェー": "Norway",
  "スウェーデン": "Sweden",
  "デンマーク": "Denmark",
  "フィンランド": "Finland",
  "アイスランド": "Iceland",
  "ポーランド": "Poland",
  "チェコ": "Czech Republic",
  "ハンガリー": "Hungary",
  "ギリシャ": "Greece",
  "ロシア": "Russia",
  "ウクライナ": "Ukraine",
  "ルーマニア": "Romania",
  "ブルガリア": "Bulgaria",
  "セルビア": "Serbia",
  "クロアチア": "Croatia",

  // Africa
  "南アフリカ": "South Africa",
  "エジプト": "Egypt",
  "モロッコ": "Morocco",
  "ケニア": "Kenya",
  "ナイジェリア": "Nigeria",
  "エチオピア": "Ethiopia",
  "ガーナ": "Ghana",

  // Misc
  "EU": "EU",
};

/** Hiragana, Katakana, CJK — if absent, treat string as Western / Latin label for EN UI. */
function containsJapaneseScript(s: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\u3000-\u303f]/.test(s);
}

/**
 * Returns the English country label for a stored value.
 * Tries the explicit `en` field first, then a JA→EN lookup, then the JA fallback.
 */
export function resolveCountryLabel(opts: {
  ja?: string | null;
  en?: string | null;
  lang: "en" | "ja";
}): string {
  const ja = (opts.ja || "").trim();
  const en = (opts.en || "").trim();
  if (opts.lang === "ja") return ja || en;
  if (en) return en;
  if (!ja) return "";
  // Admins often put English in the "Japanese" field only — show it as-is on the EN site.
  if (!containsJapaneseScript(ja)) return ja;
  return JA_TO_EN_MAP[ja] ?? translateCompoundJa(ja) ?? ja;
}

/**
 * Heuristic: handles strings like "日本産" / "マレーシア産" / "日本（北海道）" etc.
 * Strips common suffixes/prefixes, looks up the core token, then re-attaches a label.
 */
function translateCompoundJa(value: string): string | null {
  const trimmed = value.trim();
  // Drop trailing 産 (origin suffix) — e.g. "日本産" → "日本"
  const noSuffix = trimmed.replace(/産$/, "").trim();
  if (noSuffix !== trimmed && JA_TO_EN_MAP[noSuffix]) {
    return JA_TO_EN_MAP[noSuffix];
  }
  // Strip parenthetical detail — "日本（北海道）" → "日本"
  const noParen = trimmed.replace(/[（(].*?[）)]/g, "").trim();
  if (noParen && noParen !== trimmed && JA_TO_EN_MAP[noParen]) {
    return JA_TO_EN_MAP[noParen];
  }
  return null;
}
