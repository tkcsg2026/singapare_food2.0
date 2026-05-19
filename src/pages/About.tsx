"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, ShoppingBag, Newspaper, Globe, ArrowRight } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";

type AboutSiteContent = {
  hero_title_en?: string;
  hero_title_ja?: string;
  hero_sub_en?: string;
  hero_sub_ja?: string;
  hero_image?: string;
  intro_text_en?: string;
  intro_text_ja?: string;
  feature_image_1?: string;
  feature_image_2?: string;
  feature_image_3?: string;
  feature_image_4?: string;
  feature1_title_en?: string;
  feature1_title_ja?: string;
  feature1_desc_en?: string;
  feature1_desc_ja?: string;
  feature2_title_en?: string;
  feature2_title_ja?: string;
  feature2_desc_en?: string;
  feature2_desc_ja?: string;
  feature3_title_en?: string;
  feature3_title_ja?: string;
  feature3_desc_en?: string;
  feature3_desc_ja?: string;
  feature4_title_en?: string;
  feature4_title_ja?: string;
  feature4_desc_en?: string;
  feature4_desc_ja?: string;
};

const DEFAULT_FEATURE_IMAGES = [
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=700&h=450&fit=crop",
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=700&h=450&fit=crop",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&h=450&fit=crop",
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=700&h=450&fit=crop",
];

const features = [
  {
    icon: Search,
    titleKey: "feature1Title" as const,
    descKey: "feature1Desc" as const,
    defaultImage: DEFAULT_FEATURE_IMAGES[0],
    color: "bg-primary/5",
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
  },
  {
    icon: ShoppingBag,
    titleKey: "feature2Title" as const,
    descKey: "feature2Desc" as const,
    defaultImage: DEFAULT_FEATURE_IMAGES[1],
    color: "bg-primary/5",
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
  },
  {
    icon: Newspaper,
    titleKey: "feature3Title" as const,
    descKey: "feature3Desc" as const,
    defaultImage: DEFAULT_FEATURE_IMAGES[2],
    color: "bg-primary/5",
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
  },
  {
    icon: Globe,
    titleKey: "feature4Title" as const,
    descKey: "feature4Desc" as const,
    defaultImage: DEFAULT_FEATURE_IMAGES[3],
    color: "bg-primary/5",
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
  },
];

type LiveStats = { suppliers: number; products: number; categories: number; users: number };

const About = () => {
  const { t, lang } = useTranslation();
  const [content, setContent] = useState<AboutSiteContent | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [contentLoaded, setContentLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings?key=about_site")
      .then((r) => r.json())
      .then((d) => {
        if (d?.value) {
          try {
            const parsed = typeof d.value === "string" ? JSON.parse(d.value) : d.value;
            setContent(parsed);
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setContentLoaded(true));

    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setLiveStats(d))
      .catch(() => {});
  }, []);

  const heroTitle = lang === "ja" ? (content?.hero_title_ja || t.about.heroTitle) : (content?.hero_title_en || t.about.heroTitle);
  const heroSub = lang === "ja" ? (content?.hero_sub_ja || t.about.heroSub) : (content?.hero_sub_en || t.about.heroSub);
  const introText = lang === "ja" ? content?.intro_text_ja : content?.intro_text_en;
  const featureImages = [
    content?.feature_image_1 ?? DEFAULT_FEATURE_IMAGES[0],
    content?.feature_image_2 ?? DEFAULT_FEATURE_IMAGES[1],
    content?.feature_image_3 ?? DEFAULT_FEATURE_IMAGES[2],
    content?.feature_image_4 ?? DEFAULT_FEATURE_IMAGES[3],
  ];

  const heroImage = content?.hero_image || "/hero-bg.jpg";

  return (
    <Layout>
      {/* Hero section */}
      <section className="relative min-h-[400px] flex items-center overflow-hidden w-full">
        <div className="absolute inset-0 bg-gray-900">
          {contentLoaded && (
            <img src={heroImage} alt="" className="w-full h-full object-cover animate-fade-in" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/25" />
        </div>
        <div className="container py-16 md:py-20 relative z-10 min-w-0 w-full">
          <div className={`max-w-2xl min-w-0 transition-opacity duration-300 ${contentLoaded ? "opacity-100" : "opacity-0"}`}>
            <p className="text-sm font-semibold text-white/80 mb-3 uppercase tracking-wider break-words-safe">{t.about.pageSubtitle}</p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight whitespace-pre-line break-words-safe text-white">
              {heroTitle}
            </h1>
            <p className="mt-4 text-white/85 text-base sm:text-lg max-w-lg leading-relaxed whitespace-pre-line break-words-safe">
              {heroSub}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link href="/suppliers">
                <Button className="h-12 px-6 rounded-xl font-bold gap-2">
                  {t.about.ctaButton} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" className="h-12 px-6 rounded-xl font-bold !bg-transparent border-2 border-white !text-white shadow-none hover:!bg-white/15 hover:!text-white hover:border-white">
                  {t.about.ctaButton2}
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="outline" className="h-12 px-6 rounded-xl font-bold !bg-transparent border-2 border-white !text-white shadow-none hover:!bg-white/15 hover:!text-white hover:border-white">
                  {t.about.ctaButton3}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Optional intro paragraph from admin */}
      {introText && (
        <section className="border-b border-border bg-muted/30 overflow-hidden w-full">
          <div className="container py-8 min-w-0">
            <p className="text-muted-foreground leading-relaxed max-w-3xl whitespace-pre-line break-words-safe text-center mx-auto">{introText}</p>
          </div>
        </section>
      )}

      {/* Stats bar — live counts from database */}
      <section className="border-y border-border bg-white overflow-hidden w-full">
        <div className="container py-8 min-w-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-black text-primary">
                {liveStats ? liveStats.suppliers.toLocaleString() : "—"}
              </p>
              <p className="text-sm text-muted-foreground mt-1 font-medium">{t.about.stat1}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-black text-primary">
                {liveStats ? liveStats.products.toLocaleString() : "—"}
              </p>
              <p className="text-sm text-muted-foreground mt-1 font-medium">{t.about.stat2}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-black text-primary">
                {liveStats ? liveStats.categories.toLocaleString() : "—"}
              </p>
              <p className="text-sm text-muted-foreground mt-1 font-medium">{t.about.stat3}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-black text-primary">
                {liveStats ? liveStats.users.toLocaleString() : "—"}
              </p>
              <p className="text-sm text-muted-foreground mt-1 font-medium">{t.about.stat4}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features alternating layout */}
      <section className="py-12 md:py-16 overflow-hidden w-full">
        <div className="container min-w-0">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-black">{t.about.pageTitle}</h2>
          </div>

          <div className="space-y-16 md:space-y-24">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              const isEven = idx % 2 === 0;
              const n = idx + 1;
              const titleKey = `feature${n}_title` as const;
              const descKey = `feature${n}_desc` as const;
              const featureTitle = lang === "ja"
                ? ((content as any)?.[`${titleKey}_ja`] || t.about[feature.titleKey])
                : ((content as any)?.[`${titleKey}_en`] || t.about[feature.titleKey]);
              const featureDesc = lang === "ja"
                ? ((content as any)?.[`${descKey}_ja`] || t.about[feature.descKey])
                : ((content as any)?.[`${descKey}_en`] || t.about[feature.descKey]);
              return (
                <div key={feature.titleKey} className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center ${!isEven ? "md:[&>*:first-child]:order-2" : ""}`}>
                  {/* Text side */}
                  <div className="space-y-4">
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${feature.color} ${feature.iconColor}`}>
                      <div className={`w-6 h-6 rounded-full ${feature.iconBg} flex items-center justify-center`}>
                        <Icon className={`h-3.5 w-3.5 ${feature.iconColor}`} />
                      </div>
                      0{n}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black">{featureTitle}</h3>
                    <p className="text-muted-foreground leading-relaxed">{featureDesc}</p>
                  </div>
                  {/* Image side */}
                  <div className={`rounded-2xl overflow-hidden shadow-lg ${feature.color}`}>
                    {contentLoaded ? (
                      <img
                        src={featureImages[idx]}
                        alt={featureTitle}
                        className="w-full h-64 md:h-80 object-cover animate-fade-in"
                      />
                    ) : (
                      <div className="w-full h-64 md:h-80 bg-muted animate-pulse" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="bg-primary py-16 md:py-20">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{t.about.ctaTitle}</h2>
          <p className="text-white/80 mb-8 text-lg">{t.about.ctaSub}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/suppliers">
              <Button className="h-12 px-8 rounded-xl font-bold bg-white text-primary hover:bg-white/90 gap-2">
                {t.about.ctaButton} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" className="h-12 px-8 rounded-xl font-bold !bg-transparent border-2 border-white !text-white shadow-none hover:!bg-white/15 hover:!text-white">
                {t.about.ctaButton2}
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="outline" className="h-12 px-8 rounded-xl font-bold !bg-transparent border-2 border-white !text-white shadow-none hover:!bg-white/15 hover:!text-white">
                {t.about.ctaButton3}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
