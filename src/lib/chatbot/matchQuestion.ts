import { CHATBOT_KNOWLEDGE } from "./knowledge";
import type { ChatbotTopic, FaqMatchResult } from "@/types/chatbot";

/** If the message lacks these (after normalization), treat as likely off-topic before calling AI. */
const SITE_ANCHOR_KEYWORDS = [
  "supplier",
  "suppliers",
  "marketplace",
  "buy",
  "sell",
  "listing",
  "list",
  "post",
  "register",
  "login",
  "account",
  "profile",
  "dashboard",
  "favorite",
  "favourites",
  "heart",
  "contact",
  "language",
  "japanese",
  "english",
  "report",
  "approval",
  "admin",
  "terms",
  "privacy",
  "password",
  "category",
  "categories",
  "news",
  "job",
  "jobs",
  "kitchenware",
  "link",
  "portal",
  "fb",
  "message",
  "whatsapp",
  "サプライヤー",
  "売り",
  "買い",
  "マーケット",
  "出品",
  "登録",
  "ログイン",
  "アカウント",
  "マイページ",
  "プロフィール",
  "お気に入り",
  "お問い合わせ",
  "言語",
  "日本語",
  "英語",
  "通報",
  "利用規約",
  "プライバシー",
  "カテゴリ",
  "ニュース",
  "求人",
  "キッチン",
  "サイト",
  "パスワード",
];

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SIMPLE_GREETINGS = [
  "hi",
  "hello",
  "hey",
  "good morning",
  "good afternoon",
  "good evening",
  "yo",
  "hiya",
  "how are you",
  "こんにちは",
  "こんばんは",
  "おはよう",
  "やあ",
  "もしもし",
] as const;

export function isSimpleGreeting(question: string): boolean {
  const n = normalizeForMatch(question);
  if (!n) return false;
  if (n.length > 64) return false;
  return SIMPLE_GREETINGS.some((g) => {
    const ng = normalizeForMatch(g);
    return n === ng || n.startsWith(`${ng} `) || n.endsWith(` ${ng}`);
  });
}

function scoreEntry(normalized: string, keywords: string[]): number {
  let score = 0;
  for (const raw of keywords) {
    const k = normalizeForMatch(raw);
    if (k.length < 2) continue;
    if (normalized.includes(k)) {
      score += k.length >= 6 ? 3 : k.length >= 4 ? 2 : 1;
    }
  }
  return score;
}

/**
 * Returns best FAQ match. Threshold tuned so clear questions hit FAQ; borderline goes to AI.
 */
export function matchFaq(question: string, lang: "en" | "ja"): FaqMatchResult {
  const normalized = normalizeForMatch(question);
  if (!normalized) {
    return {
      hit: false,
      bestTopic: "general_platform",
      score: 0,
      secondBestScore: 0,
    };
  }

  const scores: { topic: ChatbotTopic; score: number; answer: string }[] = CHATBOT_KNOWLEDGE.map((e) => ({
    topic: e.topic,
    score: scoreEntry(normalized, e.keywords),
    answer: lang === "ja" ? e.answerJa : e.answerEn,
  })).sort((a, b) => b.score - a.score);

  const best = scores[0];
  const second = scores[1] ?? { score: 0 };

  const strong = best.score >= 4 || (best.score >= 3 && best.score >= second.score + 2);
  const medium = best.score >= 2 && best.score >= second.score + 1;

  const hit = strong || medium;

  return {
    hit,
    topic: hit ? best.topic : undefined,
    bestTopic: best.topic,
    answer: hit ? best.answer : undefined,
    score: best.score,
    secondBestScore: second.score,
  };
}

export function hasSiteAnchor(question: string): boolean {
  const n = normalizeForMatch(question);
  if (!n) return false;
  return SITE_ANCHOR_KEYWORDS.some((k) => {
    const nk = normalizeForMatch(k);
    return nk.length >= 2 && n.includes(nk);
  });
}

export function selectContextSnippets(question: string, lang: "en" | "ja", maxChars = 6000): string {
  const normalized = normalizeForMatch(question);
  const ranked = CHATBOT_KNOWLEDGE.map((e) => ({
    entry: e,
    score: scoreEntry(normalized, e.keywords),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const picked = ranked.length > 0 ? ranked : CHATBOT_KNOWLEDGE.slice(0, 6).map((entry) => ({ entry, score: 0 }));

  let out = "";
  for (const { entry } of picked) {
    const block = `[${entry.topic}] ${lang === "ja" ? entry.answerJa : entry.answerEn}\n\n`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  if (!out) {
    out = CHATBOT_KNOWLEDGE.slice(0, 4)
      .map((e) => `[${e.topic}] ${lang === "ja" ? e.answerJa : e.answerEn}`)
      .join("\n\n");
  }
  return out.trim();
}
