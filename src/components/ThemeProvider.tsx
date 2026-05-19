"use client";
/**
 * ThemeProvider
 * Fetches `site_font` and `site_color` from /api/settings on first render,
 * then injects them as CSS custom-properties on <html> so they apply globally.
 *
 * site_font  → stored as a font-key like "noto-sans-jp"
 * site_color → stored as an HSL triple like "355 100% 57%" (the Tailwind CSS-var format)
 */
import { useEffect } from "react";

/* ── Font definitions ──────────────────────────────────────────────────── */
export const FONT_OPTIONS: {
  key: string;
  labelEn: string;
  labelJa: string;
  /** Value written directly into font-family CSS */
  css: string;
  /** Google Fonts href to load (null = system font, no load needed) */
  googleHref: string | null;
}[] = [
  // ── Japanese fonts ──
  {
    key: "noto-sans-jp",
    labelEn: "Noto Sans JP",
    labelJa: "Noto Sans JP（ゴシック）",
    css: '"Noto Sans JP", sans-serif',
    googleHref: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap",
  },
  {
    key: "noto-serif-jp",
    labelEn: "Noto Serif JP",
    labelJa: "Noto Serif JP（明朝）",
    css: '"Noto Serif JP", serif',
    googleHref: "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700&display=swap",
  },
  {
    key: "m-plus-rounded-1c",
    labelEn: "M PLUS Rounded 1c",
    labelJa: "M PLUS Rounded 1c（丸ゴシック）",
    css: '"M PLUS Rounded 1c", sans-serif',
    googleHref: "https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;700&display=swap",
  },
  {
    key: "zen-kaku-gothic-new",
    labelEn: "Zen Kaku Gothic New",
    labelJa: "Zen Kaku Gothic New（ゴシック）",
    css: '"Zen Kaku Gothic New", sans-serif',
    googleHref: "https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;700&display=swap",
  },
  {
    key: "shippori-mincho",
    labelEn: "Shippori Mincho",
    labelJa: "しっぽり明朝（明朝）",
    css: '"Shippori Mincho", serif',
    googleHref: "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&display=swap",
  },
  // ── English fonts ──
  {
    key: "inter",
    labelEn: "Inter (Default)",
    labelJa: "Inter（デフォルト）",
    css: '"Inter", system-ui, sans-serif',
    googleHref: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap",
  },
  {
    key: "roboto",
    labelEn: "Roboto",
    labelJa: "Roboto",
    css: '"Roboto", sans-serif',
    googleHref: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap",
  },
  {
    key: "playfair-display",
    labelEn: "Playfair Display",
    labelJa: "Playfair Display（エレガント）",
    css: '"Playfair Display", serif',
    googleHref: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap",
  },
  {
    key: "poppins",
    labelEn: "Poppins",
    labelJa: "Poppins（モダン）",
    css: '"Poppins", sans-serif',
    googleHref: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap",
  },
  {
    key: "lato",
    labelEn: "Lato",
    labelJa: "Lato（クリーン）",
    css: '"Lato", sans-serif',
    googleHref: "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
  },
];

/* ── Color presets ─────────────────────────────────────────────────────── */
export const COLOR_OPTIONS: {
  key: string;
  labelEn: string;
  labelJa: string;
  /** HSL triple used in Tailwind CSS vars: "H S% L%" */
  hsl: string;
  /** Hex for swatch display only */
  hex: string;
}[] = [
  { key: "red",    labelEn: "Red (default)", labelJa: "レッド（デフォルト）", hsl: "355 100% 57%", hex: "#ff2636" },
  { key: "green",  labelEn: "Green",          labelJa: "グリーン",            hsl: "142 71% 45%",  hex: "#22c55e" },
  { key: "blue",   labelEn: "Blue",           labelJa: "ブルー",              hsl: "217 91% 60%",  hex: "#3b82f6" },
  { key: "gray",   labelEn: "Gray",           labelJa: "グレー",              hsl: "220 14% 46%",  hex: "#64748b" },
  { key: "purple", labelEn: "Purple",         labelJa: "パープル",            hsl: "262 83% 58%",  hex: "#8b5cf6" },
];

/* ── Helper: inject / update a <link rel="stylesheet"> ────────────────── */
function loadGoogleFont(href: string) {
  const id = `gf-${href.replace(/\W/g, "")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/* ── Apply theme to <html> ─────────────────────────────────────────────── */
export function applyTheme(fontKey: string, colorKey: string) {
  const font = FONT_OPTIONS.find((f) => f.key === fontKey) ?? FONT_OPTIONS[0];
  const color = COLOR_OPTIONS.find((c) => c.key === colorKey) ?? COLOR_OPTIONS[0];

  const root = document.documentElement;

  // Font
  if (font.googleHref) loadGoogleFont(font.googleHref);
  root.style.setProperty("--site-font", font.css);
  root.style.setProperty("--site-font-ja", font.css);

  // Primary colour (all Tailwind vars that reference the primary hue)
  root.style.setProperty("--primary", color.hsl);
  root.style.setProperty("--accent", color.hsl);
  root.style.setProperty("--ring", color.hsl);
  root.style.setProperty("--sidebar-primary", color.hsl);
  root.style.setProperty("--sidebar-ring", color.hsl);
}

/* ── Provider component ─────────────────────────────────────────────────── */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((rows: unknown) => {
        const list = Array.isArray(rows) ? rows as { key?: string; value?: string }[] : [];
        const fontRow  = list.find((r) => r?.key === "site_font");
        const colorRow = list.find((r) => r?.key === "site_color");
        applyTheme(fontRow?.value ?? "inter", colorRow?.value ?? "red");
      })
      .catch(() => {});
  }, []);

  return <>{children}</>;
}
