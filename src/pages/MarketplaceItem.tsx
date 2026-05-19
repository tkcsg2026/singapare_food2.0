"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar, Package, Truck, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useFetch } from "@/hooks/useSupabaseData";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { useLoginPrompt } from "@/components/LoginPromptModal";
import { getSupabase } from "@/lib/supabase";

const MarketplaceItemPage = () => {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { data: item, loading } = useFetch<any>(`/api/marketplace/${slug}`, [slug]);
  const [currentImage, setCurrentImage] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [alreadyReported, setAlreadyReported] = useState(false);
  const { user } = useAuth();
  const { t, lang } = useTranslation();
  const { requireLogin, loginPromptModal } = useLoginPrompt();

  useEffect(() => {
    let cancelled = false;
    const checkReport = async () => {
      if (!user?.id || !item?.id || item.error) return;
      try {
        const sb = getSupabase();
        const session = sb ? (await sb.auth.getSession()).data.session : null;
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (session?.access_token) {
          (headers as Record<string, string>).Authorization = `Bearer ${session.access_token}`;
        }
        const res = await fetch(
          `/api/reports?item_type=marketplace_item&item_id=${encodeURIComponent(item.id)}&reporter_id=${encodeURIComponent(user.id)}`,
          { headers },
        );
        if (!res.ok) return;
        const list = await res.json();
        if (!cancelled) setAlreadyReported(Array.isArray(list) && list.length > 0);
      } catch {
        // ignore
      }
    };
    checkReport();
    return () => {
      cancelled = true;
    };
  }, [item?.id, item?.error, user?.id]);

  const handleReport = async () => {
    if (!reportReason || !user || !item?.id) return;
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_type: "marketplace_item",
        item_id: item.id,
        reporter_id: user.id,
        reason: reportReason,
      }),
    });
    setShowReport(false);
    setReportReason("");
    setAlreadyReported(true);
    alert(t.marketplaceItem.reportSent);
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-16 text-center text-muted-foreground">{t.common.loading}</div>
      </Layout>
    );
  }

  if (!item || item.error) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">{t.marketplaceItem.notFound}</p>
          <Link href="/marketplace" className="text-primary hover:underline mt-4 inline-block">
            {t.marketplaceItem.backToList}
          </Link>
        </div>
      </Layout>
    );
  }

  const images = item.images || [item.image];
  const mkt = t.marketplace as {
    areaDisplay?: Record<string, string>;
    conditionDisplay?: Record<string, string>;
    deliveryDisplay?: Record<string, string>;
  };
  const displayTitle = lang === "en" && item.title_en ? item.title_en : item.title;
  const displayDescription = lang === "en" && item.description_en ? item.description_en : item.description;
  const displayArea =
    lang === "en" ? item.area_en?.trim() || mkt.areaDisplay?.[item.area] || item.area : item.area;
  const displayCondition =
    lang === "en"
      ? item.condition_en?.trim() || mkt.conditionDisplay?.[item.condition] || item.condition
      : item.condition;
  const displayDelivery =
    lang === "en"
      ? item.delivery_en?.trim() || mkt.deliveryDisplay?.[item.delivery] || item.delivery
      : item.delivery;

  return (
    <Layout>
      <div className="container py-6 pb-24 sm:pb-6">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> {t.marketplaceItem.backToList}
        </Link>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted shadow-sm">
              <img src={images[currentImage]} alt={item.title} className="w-full h-full object-cover" />
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
            <h1 className="text-2xl font-black tracking-tight">{displayTitle}</h1>
            <p className="text-3xl font-black text-primary mt-2">S${Number(item.price).toLocaleString()}</p>
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>
                  {t.marketplaceItem.condition}: <strong>{displayCondition}</strong>
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {t.marketplaceItem.yearsUsed}:{" "}
                  <strong>
                    {item.years_used}
                    {t.marketplaceItem.years}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>
                  {t.marketplaceItem.area}: <strong>{displayArea}</strong>
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span>
                  {t.marketplaceItem.delivery}: <strong>{displayDelivery}</strong>
                </span>
              </div>
            </div>
            <div className="mt-6 p-5 bg-card border">
              <h3 className="font-bold text-sm mb-2">{t.marketplaceItem.description}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{displayDescription}</p>
            </div>
            <div className="mt-6 p-5 bg-card border">
              <h3 className="font-bold text-sm mb-2">{t.marketplaceItem.seller}</h3>
              <p className="text-sm font-semibold">{item.seller_name}</p>
            </div>
            <div className="mt-4 hidden sm:block">
              {user ? (
                <WhatsAppButton
                  phone={item.seller_whatsapp}
                  message={`Hi, I'm interested in your ${displayTitle} listed on the F&B Portal.`}
                  fullWidth
                  size="lg"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => requireLogin()}
                  className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold text-whatsapp-foreground whatsapp-gradient border-0 hover:opacity-95 transition-all duration-200 min-h-[44px] w-full h-11 px-8 text-base"
                >
                  <span className="relative z-0">WhatsApp</span>
                </button>
              )}
            </div>
            {user && (
              <button
                type="button"
                onClick={() => !alreadyReported && setShowReport(true)}
                disabled={alreadyReported}
                className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive disabled:opacity-60 disabled:pointer-events-none"
              >
                <Flag className="h-3 w-3" /> {t.marketplaceItem.report}
              </button>
            )}
          </div>
        </div>
      </div>

      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setShowReport(false)} />
          <div className="relative bg-background rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold mb-1">{t.marketplaceItem.reportTitle}</h3>
            <p className="text-xs text-muted-foreground mb-3">{t.marketplaceItem.reportEnglishOnly}</p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder={t.marketplaceItem.reportPlaceholder}
              className="w-full h-24 p-3 rounded-xl border bg-background text-sm resize-none"
            />
            <div className="flex gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowReport(false)} className="flex-1 rounded-xl">
                {t.common.cancel}
              </Button>
              <Button onClick={handleReport} className="flex-1 rounded-xl" disabled={!reportReason}>
                {t.marketplaceItem.reportSend}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-md border-t sm:hidden z-40">
        {user ? (
          <WhatsAppButton
            phone={item.seller_whatsapp}
            message={`Hi, I'm interested in your ${displayTitle} listed on the F&B Portal.`}
            fullWidth
            size="lg"
          />
        ) : (
          <button
            type="button"
            onClick={() => requireLogin()}
            className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold text-whatsapp-foreground whatsapp-gradient border-0 hover:opacity-95 transition-all duration-200 min-h-[44px] w-full h-11 px-8 text-base"
          >
            <span className="relative z-0">WhatsApp</span>
          </button>
        )}
      </div>

      {loginPromptModal}
    </Layout>
  );
};

export default MarketplaceItemPage;
