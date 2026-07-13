import Link from "next/link";
import { MapPin, Ruler } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

interface ShopListingCardProps {
  listing: {
    slug: string;
    image: string;
    title: string;
    listing_type: "rent" | "takeover" | "both";
    location: string;
    building: string;
    monthly_rent: string;
    floor_size: string;
    asking_price: string;
  };
  onRequireLogin?: () => boolean;
  lazyImage?: boolean;
}

export function ShopListingCard({ listing, onRequireLogin, lazyImage = false }: ShopListingCardProps) {
  const { t } = useTranslation();

  const typeLabel = t.shops.types[listing.listing_type] ?? listing.listing_type;
  const place = [listing.location, listing.building].filter(Boolean).join(" · ");
  // Rent leads for rent listings; takeover-only listings show the asking price instead
  const price =
    listing.listing_type === "takeover"
      ? listing.asking_price || listing.monthly_rent
      : listing.monthly_rent || listing.asking_price;

  const handleClick = (e: React.MouseEvent) => {
    if (onRequireLogin && !onRequireLogin()) {
      e.preventDefault();
    }
  };

  return (
    <Link href={`/shops/${listing.slug}`} className="group block h-full min-w-0" onClick={handleClick}>
      <div className="bg-card overflow-hidden shadow-card card-hover card-lift border border-border h-full flex flex-col min-w-0 transition-shadow duration-300 group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.12),0_0_0_1px_hsl(var(--primary)/0.1)]">
        <div className="aspect-[4/3] overflow-hidden bg-muted flex-shrink-0 relative">
          <img
            src={listing.image}
            alt={listing.title}
            loading={lazyImage ? "lazy" : undefined}
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
          />
          <span className="absolute top-2 left-2 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm">
            {typeLabel}
          </span>
        </div>
        <div className="p-3 flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
          {price && <p className="font-bold text-sm sm:text-base text-primary flex-shrink-0 truncate">{price}</p>}
          <p className="text-xs sm:text-[15px] font-medium text-foreground truncate mt-1 leading-snug min-w-0" title={listing.title}>
            {listing.title}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-shrink-0 min-w-0">
            {place && (
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate min-w-0 flex items-center gap-1">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{place}</span>
              </span>
            )}
            {listing.floor_size && (
              <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/15 flex-shrink-0 flex items-center gap-1 transition-transform duration-300 group-hover:scale-105">
                <Ruler className="h-3 w-3" />
                {listing.floor_size}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
