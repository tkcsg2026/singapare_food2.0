"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import en from "@/locales/en";
import ja from "@/locales/ja";
import type { Translations } from "@/locales/en";

type Lang = "en" | "ja";

interface LanguageState {
  lang: Lang;
  t: Translations;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageState>({
  lang: "en",
  t: en,
  setLang: () => {},
  toggleLang: () => {},
});

const STORAGE_KEY = "fb-portal-lang";

function getStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    return saved === "en" || saved === "ja" ? saved : "en";
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Always start with "en" so server and first client render match (avoids hydration mismatch).
  const [lang, setLangState] = useState<Lang>("en");

  // After mount, restore saved language from localStorage (client-only).
  useEffect(() => {
    const saved = getStoredLang();
    setLangState(saved);
    if (typeof document !== "undefined") {
      document.documentElement.lang = saved;
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      // Sync html[lang] so :lang(ja) CSS selector activates Yu Mincho
      if (typeof document !== "undefined") {
        document.documentElement.lang = l;
      }
    } catch {}
  }, []);

  // Set html[lang] on mount once preference is restored
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const toggleLang = useCallback(() => {
    setLang(lang === "en" ? "ja" : "en");
  }, [lang, setLang]);

  const t = lang === "ja" ? ja : en;

  return (
    <LanguageContext.Provider value={{ lang, t, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Returns the current translations and language helpers */
export function useTranslation() {
  return useContext(LanguageContext);
}
