import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";

interface MarketplaceCardProps {
  item: {
    slug: string;
    image: string;
    title: string;
    title_en?: string;
    price: number;
    area: string;
    area_en?: string;
    condition: string;
    condition_en?: string;
  };
  onRequireLogin?: () => boolean;
}

export function MarketplaceCard({ item, onRequireLogin }: MarketplaceCardProps) {
  const { t, lang } = useTranslation();
  const mkt = t.marketplace as {
    areaDisplay?: Record<string, string>;
    conditionDisplay?: Record<string, string>;
  };

  const displayTitle = lang === "en" && item.title_en ? item.title_en : item.title;
  const displayArea = lang === "en"
    ? (item.area_en?.trim() || mkt.areaDisplay?.[item.area] || item.area)
    : (mkt.areaDisplay?.[item.area] ?? item.area);
  const displayCondition = lang === "en"
    ? (item.condition_en?.trim() || mkt.conditionDisplay?.[item.condition] || item.condition)
    : (mkt.conditionDisplay?.[item.condition] ?? item.condition);

  const handleClick = (e: React.MouseEvent) => {
    if (onRequireLogin && !onRequireLogin()) {
      e.preventDefault();
    }
  };

  return (
    <Link href={`/marketplace/${item.slug}`} className="group block h-full min-w-0" onClick={handleClick}>
      <div className="bg-card overflow-hidden shadow-card card-hover card-lift border border-border h-full flex flex-col min-w-0 transition-shadow duration-300 group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.12),0_0_0_1px_hsl(var(--primary)/0.1)]">
        <div className="aspect-square overflow-hidden bg-muted flex-shrink-0">
          <img
            src={item.image}
            alt={displayTitle}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
          />
        </div>
        <div className="p-3 flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
          <p className="font-bold text-sm sm:text-base text-primary flex-shrink-0">S${item.price.toLocaleString()}</p>
          <p className="text-xs sm:text-[15px] font-medium text-foreground truncate mt-1 leading-snug min-w-0" title={displayTitle}>{displayTitle}</p>
          <div className="flex items-center gap-2 mt-2 flex-shrink-0 min-w-0">
            <span className="text-[10px] sm:text-xs text-muted-foreground truncate min-w-0">{displayArea}</span>
            <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/15 flex-shrink-0 transition-transform duration-300 group-hover:scale-105">{displayCondition}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
