"use client";
import { useState, useEffect } from "react";
import { useTranslation } from "@/contexts/LanguageContext";

interface BannerConfig {
  text_en: string;
  text_ja: string;
  is_active: boolean;
  speed: number;
  text_color?: string;
}

export function ScrollingBanner() {
  const { lang } = useTranslation();
  const [config, setConfig] = useState<BannerConfig | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetch("/api/scrolling-banner")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConfig(d))
      .catch(() => {});
  }, []);

  if (!config || !config.is_active) return null;

  const text = lang === "ja" ? config.text_ja : config.text_en;
  if (!text.trim()) return null;

  const isBlack = config.text_color === "black";
  const textColorStyle = isBlack ? "#111111" : "var(--color-primary, #e53e3e)";

  const separator = "\u00a0\u00a0\u00a0\u00a0\u2014\u00a0\u00a0\u00a0\u00a0";
  const content = `${text}${separator}${text}${separator}`;

  return (
    <div
      className="w-full overflow-hidden flex items-center leading-none bg-transparent"
      style={{ paddingTop: "2px", paddingBottom: "2px" }}
      aria-live="polite"
      aria-label="Site announcement"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="inline-flex shrink-0"
        style={{
          animation: `marquee-scroll ${config.speed}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
          willChange: "transform",
        }}
      >
        {/* Two identical copies for seamless looping: animation moves -50% */}
        <span
          className="text-[20px] sm:text-[26px] md:text-[30px] font-semibold leading-none whitespace-nowrap px-8 select-none"
          style={{ color: textColorStyle }}
        >
          {content}
        </span>
        <span
          className="text-[20px] sm:text-[26px] md:text-[30px] font-semibold leading-none whitespace-nowrap px-8 select-none"
          style={{ color: textColorStyle }}
          aria-hidden
        >
          {content}
        </span>
      </div>
    </div>
  );
}
