"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Building2, Banknote, Ruler, Tag, CalendarClock,
  UtensilsCrossed, Info, ChevronLeft, ChevronRight, User, Clock,
} from "lucide-react";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { useLoginPrompt } from "@/components/LoginPromptModal";
import { getSupabase } from "@/lib/supabase";
import type { ShopListingRow } from "@/types/database";

const ShopListingDetail = () => {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const [listing, setListing] = useState<ShopListingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useTranslation();
  const { requireLogin, loginPromptModal } = useLoginPrompt();

  // Fetch with the session token when available so owners can view their own
  // pending/rejected listings (the API hides those from everyone else).
  useEffect(() => {
    if (!slug || authLoading) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const sb = getSupabase();
        const session = sb ? (await sb.auth.getSession()).data.session : null;
        const headers: HeadersInit = {};
        if (session?.access_token) {
          (headers as Record<string, string>).Authorization = `Bearer ${session.access_token}`;
        }
        const res = await fetch(`/api/shop-listings/${encodeURIComponent(slug)}`, {
          headers,
          cache: "no-store",
        });
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setListing(data && !data.error ? data : null);
      } catch {
        if (!cancelled) setListing(null);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, authLoading]);

  if (loading || authLoading) {
    return (
      <Layout>
        <div className="container py-16 text-center text-muted-foreground">{t.common.loading}</div>
      </Layout>
    );
  }

  if (!listing) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">{t.shops.detail.notFound}</p>
          <Link href="/shops" className="text-primary hover:underline mt-4 inline-block">
            {t.shops.detail.backToList}
          </Link>
        </div>
      </Layout>
    );
  }

  const images = listing.images?.length ? listing.images : [listing.image];
  const typeLabel = t.shops.types[listing.listing_type] ?? listing.listing_type;
  const featureLabel = (f: string) => t.shops.features[f] || f;
  const whatsappMessage = `Hi, I'm interested in your shop listing "${listing.title}" on the F&B Portal.`;

  const factRows = [
    { icon: MapPin, label: t.shops.detail.location, value: listing.location },
    { icon: Building2, label: t.shops.detail.building, value: listing.building },
    { icon: Banknote, label: t.shops.detail.monthlyRent, value: listing.monthly_rent },
    { icon: Ruler, label: t.shops.detail.floorSize, value: listing.floor_size },
    { icon: Tag, label: t.shops.detail.askingPrice, value: listing.asking_price },
    { icon: CalendarClock, label: t.shops.detail.leaseRemaining, value: listing.lease_remaining },
    { icon: UtensilsCrossed, label: t.shops.detail.suitableFor, value: listing.suitable_for },
    { icon: Info, label: t.shops.detail.reason, value: listing.reason },
  ].filter((row) => row.value && row.value.trim());

  const contactButton = user ? (
    listing.seller_whatsapp ? (
      <WhatsAppButton phone={listing.seller_whatsapp} message={whatsappMessage} fullWidth size="lg" />
    ) : null
  ) : (
    <button
      type="button"
      onClick={() => requireLogin()}
      className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold text-whatsapp-foreground whatsapp-gradient border-0 hover:opacity-95 transition-all duration-200 min-h-[44px] w-full h-11 px-8 text-base"
    >
      <span className="relative z-0">WhatsApp</span>
    </button>
  );

  return (
    <Layout>
      <div className="container py-6 pb-24 sm:pb-6">
        <Link
          href="/shops"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> {t.shops.detail.backToList}
        </Link>

        {listing.status !== "approved" && (
          <div className="mb-6 px-4 py-3 border border-amber-200 bg-amber-50 text-amber-800 text-sm font-medium rounded-xl">
            {listing.status === "pending" ? t.shops.detail.pendingNotice : t.shops.detail.rejectedNotice}
            {listing.status === "rejected" && listing.reject_reason && (
              <span className="block mt-1 font-normal">{t.dashboard.rejectReason}{listing.reject_reason}</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted shadow-sm">
              <img src={images[currentImage]} alt={listing.title} className="w-full h-full object-cover" />
            </div>
            {images.length > 1 && (
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-3">
                <button
                  type="button"
                  onClick={() => setCurrentImage((i) => (i - 1 + images.length) % images.length)}
                  className="w-10 h-10 rounded-full bg-background/80 flex items-center justify-center shadow-lg"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentImage((i) => (i + 1) % images.length)}
                  className="w-10 h-10 rounded-full bg-background/80 flex items-center justify-center shadow-lg"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
            {images.length > 1 && (
              <div className="flex justify-center gap-2 mt-3">
                {images.map((_: string, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentImage(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${i === currentImage ? "bg-primary" : "bg-muted-foreground/30"}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-primary text-primary-foreground font-semibold mb-3">
              {typeLabel}
            </span>
            <h1 className="text-2xl font-black tracking-tight">{listing.title}</h1>
            {listing.monthly_rent && (
              <p className="text-3xl font-black text-primary mt-2">{listing.monthly_rent}</p>
            )}

            <div className="mt-6 space-y-3">
              {factRows.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="min-w-0">
                    {label}: <strong className="break-words-safe">{value}</strong>
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>
                  {t.shops.detail.postedOn}:{" "}
                  <strong>{new Date(listing.created_at).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-SG")}</strong>
                </span>
              </div>
            </div>

            {listing.key_features?.length > 0 && (
              <div className="mt-6">
                <h3 className="font-bold text-sm mb-2">{t.shops.detail.keyFeatures}</h3>
                <div className="flex flex-wrap gap-2">
                  {listing.key_features.map((f) => (
                    <span
                      key={f}
                      className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/15 font-medium"
                    >
                      {featureLabel(f)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 p-5 bg-card border">
              <h3 className="font-bold text-sm mb-2">{t.shops.detail.description}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{listing.description}</p>
            </div>

            <div className="mt-6 p-5 bg-card border">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-1.5">
                <User className="h-4 w-4 text-muted-foreground" /> {t.shops.detail.postedBy}
              </h3>
              <p className="text-sm font-semibold">{listing.seller_name}</p>
              <p className="text-xs text-muted-foreground mt-1">{t.shops.detail.contactHint}</p>
            </div>

            {contactButton && <div className="mt-4 hidden sm:block">{contactButton}</div>}
          </div>
        </div>
      </div>

      {contactButton && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-md border-t sm:hidden z-40">
          {contactButton}
        </div>
      )}

      {loginPromptModal}
    </Layout>
  );
};

export default ShopListingDetail;
