"use client";
import Link from "next/link";
import {
  Check,
  X,
  Crown,
  Star,
  Zap,
  MessageCircle,
  Package,
  Sparkles,
  TrendingUp,
  BarChart2,
  Headphones,
  List,
  Mail,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";

const planData = [
  {
    tier: "basic" as const,
    icon: <Zap className="h-6 w-6" />,
    color: "text-slate-500",
    bgColor: "bg-slate-100",
    borderColor: "border-border",
    popular: false,
  },
  {
    tier: "standard" as const,
    icon: <Star className="h-6 w-6" />,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/50",
    popular: false,
  },
  {
    tier: "premium" as const,
    icon: <Crown className="h-6 w-6" />,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary",
    popular: true,
  },
];

type CellValue = boolean | string;

interface ComparisonFeature {
  icon: React.ReactNode;
  labelKey: string;
  basic: CellValue;
  standard: CellValue;
  premium: CellValue;
}

const Plans = () => {
  const { t, lang } = useTranslation();
  const p = t.plans;

  const comparisonFeatures: ComparisonFeature[] = [
    {
      icon: <List className="h-4 w-4" />,
      labelKey: "featureListing",
      basic: true,
      standard: true,
      premium: true,
    },
    {
      icon: <MessageCircle className="h-4 w-4" />,
      labelKey: "featureWhatsapp",
      basic: false,
      standard: true,
      premium: true,
    },
    {
      icon: <Package className="h-4 w-4" />,
      labelKey: "featureProducts",
      basic: p.productsBasic,
      standard: p.productsStandard,
      premium: p.productsPremium,
    },
    {
      icon: <TrendingUp className="h-4 w-4" />,
      labelKey: "featureSearchPriority",
      basic: p.valueStandard,
      standard: p.valuePrioritized,
      premium: p.valueHighest,
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      labelKey: "featureFeatured",
      basic: false,
      standard: false,
      premium: true,
    },
    {
      icon: <BarChart2 className="h-4 w-4" />,
      labelKey: "featureAnalytics",
      basic: false,
      standard: false,
      premium: true,
    },
    {
      icon: <Headphones className="h-4 w-4" />,
      labelKey: "featurePriority",
      basic: false,
      standard: false,
      premium: true,
    },
  ];

  function renderCell(value: CellValue, tier: "basic" | "standard" | "premium") {
    if (value === true) {
      return (
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${tier === "premium" ? "bg-primary/10 text-primary" : "bg-primary/10 text-primary"}`}>
          <Check className="h-4 w-4 font-bold" strokeWidth={3} />
        </span>
      );
    }
    if (value === false) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground">
          <X className="h-3.5 w-3.5" />
        </span>
      );
    }
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
        tier === "premium"
          ? "bg-primary/10 text-primary"
          : tier === "standard"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      }`}>
        {value}
      </span>
    );
  }

  return (
    <Layout>
      <div className="container py-12 md:py-20 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">{p.pageTitle}</h1>
          <p className="text-muted-foreground mt-2">{p.pageSubtitle}</p>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch mb-16">
          {planData.map(({ tier, icon, color, bgColor, borderColor, popular }) => {
            const name = p[tier];
            const desc = p[`${tier}Desc` as keyof typeof p] as string;
            const isPremium = tier === "premium";

            return (
              <div
                key={tier}
                className={`relative rounded-2xl border-2 p-6 md:p-8 flex flex-col ${borderColor} ${
                  isPremium
                    ? "shadow-xl shadow-primary/20 md:scale-105 md:-mt-2 md:-mb-2 bg-gradient-to-b from-primary/5 to-white"
                    : "shadow-sm bg-card"
                }`}
              >
                {popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow flex items-center gap-1.5 whitespace-nowrap">
                    <Crown className="h-3 w-3" /> {p.mostPopular}
                  </div>
                )}

                {/* Icon + Name */}
                <div className={`w-12 h-12 rounded-xl ${bgColor} ${color} flex items-center justify-center mb-4`}>
                  {icon}
                </div>
                <h2 className="text-xl font-bold">{name}</h2>
                <p className="text-sm text-muted-foreground mt-1 mb-6">{desc}</p>

                {/* Feature list */}
                <ul className="space-y-2.5 flex-1 mb-8">
                  {comparisonFeatures.map((f) => {
                    const val = f[tier];
                    const isIncluded = val !== false;
                    return (
                      <li key={f.labelKey} className={`flex items-center gap-2 text-sm ${isIncluded ? "text-foreground" : "text-muted-foreground line-through"}`}>
                        {isIncluded
                          ? <Check className={`h-4 w-4 flex-shrink-0 text-primary`} strokeWidth={2.5} />
                          : <X className="h-4 w-4 flex-shrink-0 text-muted-foreground/50" />
                        }
                        <span>
                          {p[f.labelKey as keyof typeof p] as string}
                          {typeof val === "string" && (
                            <span className={`ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary`}>
                              {val}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <Button
                  className={`rounded-xl w-full font-bold flex items-center justify-center gap-2 ${
                    isPremium
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : tier === "standard"
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  }`}
                  asChild
                >
                  <a href="mailto:contact@fnbportal.sg">
                    <Mail className="h-4 w-4" />
                    {p.contactUs}
                  </a>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="bg-muted/40 px-6 py-4 border-b border-border">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              {p.comparisonTitle}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-6 py-3 text-sm font-semibold text-muted-foreground w-1/2">
                    {lang === "ja" ? "機能" : "Feature"}
                  </th>
                  {planData.map(({ tier, icon, color }) => (
                    <th key={tier} className="text-center px-4 py-3 w-[16%]">
                      <div className={`flex flex-col items-center gap-1 ${color}`}>
                        {icon}
                        <span className="text-xs font-bold text-foreground">{p[tier]}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature, idx) => (
                  <tr
                    key={feature.labelKey}
                    className={`border-b border-border last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-muted/10"}`}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5 text-sm font-medium">
                        <span className="text-primary">{feature.icon}</span>
                        {p[feature.labelKey as keyof typeof p] as string}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {renderCell(feature.basic, "basic")}
                    </td>
                    <td className="px-4 py-3.5 text-center bg-primary/5">
                      {renderCell(feature.standard, "standard")}
                    </td>
                    <td className="px-4 py-3.5 text-center bg-primary/5">
                      {renderCell(feature.premium, "premium")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-10">
          <p className="text-sm text-muted-foreground mb-3">
            {lang === "ja" ? "ご質問・お見積りはお気軽にお問い合わせください。" : "Have questions? We're happy to help you choose the right plan."}
          </p>
          <Button asChild className="rounded-xl font-bold px-8">
            <a href="mailto:contact@fnbportal.sg" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {p.contactUs}
            </a>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default Plans;
