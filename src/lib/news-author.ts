const EDITORIAL_JA = new Set(["編集部", "編集 部", "編集チーム", "編集チーム"]);
const EDITORIAL_EN = new Set(["editorial desk", "editorial", "editorial department", "editors"]);

export function resolveNewsAuthor(author: string | null | undefined, lang: "ja" | "en"): string {
  const raw = (author || "").trim();
  if (!raw) return "";
  const normalized = raw.toLowerCase().replace(/\s+/g, " ");
  if (EDITORIAL_JA.has(raw) || EDITORIAL_EN.has(normalized)) {
    return lang === "ja" ? "編集部" : "Editorial Department";
  }
  return raw;
}
