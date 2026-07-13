"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, X } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { getSupabase } from "@/lib/supabase";

const FEATURE_KEYS = [
  "exhaust-hood",
  "gas-supply",
  "fully-fitted-kitchen",
  "outdoor-seating",
  "liquor-licence",
] as const;

const NewShopListing = () => {
  const { user, profile, loading: authLoading } = useRequireAuth();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [termsText, setTermsText] = useState("");
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    listingType: "",
    location: "",
    building: "",
    monthlyRent: "",
    floorSize: "",
    askingPrice: "",
    leaseRemaining: "",
    suitableFor: "",
    otherFeatures: "",
    reason: "",
    description: "",
    contactName: "",
  });
  const [features, setFeatures] = useState<string[]>([]);

  useEffect(() => {
    const fallback = t.legal.termsFallback;
    fetch("/api/settings?key=terms_of_service")
      .then((r) => r.json())
      .then((d) => {
        const v = typeof d?.value === "string" ? d.value.trim() : "";
        setTermsText(v || fallback);
      })
      .catch(() => setTermsText(fallback));
  }, [t.legal.termsFallback]);

  const handleChange = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const toggleFeature = (key: string) =>
    setFeatures((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));

  const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // /api/upload rejects images over 10 MB

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const invalidFiles = files.filter((f) => !ACCEPTED_IMAGE_TYPES.includes(f.type));
    if (invalidFiles.length > 0) {
      alert(t.shops.form.imageFormatError);
    }
    const oversizeFiles = files.filter(
      (f) => ACCEPTED_IMAGE_TYPES.includes(f.type) && f.size > MAX_IMAGE_BYTES,
    );
    if (oversizeFiles.length > 0) {
      alert(t.shops.form.imageTooLargeError);
    }
    const validFiles = files.filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type) && f.size <= MAX_IMAGE_BYTES);
    const remaining = 5 - imageFiles.length;
    const newFiles = validFiles.slice(0, remaining);
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
    setImageFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (imageFiles.length === 0) return [];
    setUploadingImages(true);
    const urls: string[] = [];
    for (const file of imageFiles) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "shops");
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const j = await res.json();
        if (j?.url) urls.push(j.url);
      } catch {
        // Failed uploads are detected by the caller via urls.length
      }
    }
    setUploadingImages(false);
    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !agreed) return;
    setSubmitting(true);
    try {
      const keyFeatures = [
        ...features,
        ...form.otherFeatures
          .split(/[,、，]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ];

      const imageUrls = await uploadImages();
      if (imageFiles.length > 0 && imageUrls.length < imageFiles.length) {
        alert(t.shops.form.imageUploadError);
        return;
      }
      const defaultImage = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=450&fit=crop";
      const slug =
        form.title
          .toLowerCase()
          .replace(/[^a-z0-9぀-ゟ゠-ヿ一-龯]+/g, "-")
          .replace(/^-|-$/g, "") +
        "-" +
        Date.now();

      const body = {
        title: form.title,
        listing_type: form.listingType,
        location: form.location,
        building: form.building,
        monthly_rent: form.monthlyRent,
        floor_size: form.floorSize,
        asking_price: form.askingPrice,
        lease_remaining: form.leaseRemaining,
        suitable_for: form.suitableFor,
        key_features: keyFeatures,
        reason: form.reason,
        description: form.description,
        slug,
        image: imageUrls[0] || defaultImage,
        images: imageUrls.length > 0 ? imageUrls : [defaultImage],
        seller_name: form.contactName || profile?.name || profile?.username || t.nav.user,
        seller_whatsapp: profile?.whatsapp || "",
      };

      // The API derives ownership from the verified token, so send it along
      const sb = getSupabase();
      const session = sb ? (await sb.auth.getSession()).data.session : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch("/api/shop-listings", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        alert(t.shops.form.successMsg);
        window.location.href = "/dashboard";
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err?.code === "SHOP_LISTINGS_NOT_READY" ? t.shops.form.notReadyMsg : t.shops.form.errorMsg);
      }
    } catch {
      alert(t.shops.form.errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return <Layout><div className="container py-16 text-center text-muted-foreground">{t.common.loading}</div></Layout>;
  }

  const inputCls = "w-full h-11 px-4 rounded-lg border bg-background text-sm";

  return (
    <Layout>
      <div className="container max-w-2xl py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 font-medium">
          <ArrowLeft className="h-4 w-4" /> {t.shops.form.backToDashboard}
        </Link>
        <h1 className="text-3xl font-black tracking-tight mb-8">{t.shops.form.title}</h1>

        <form onSubmit={handleSubmit} className="bg-card border p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldTitle}</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder={t.shops.form.fieldTitlePlaceholder}
              className={inputCls}
              required
            />
          </div>

          {/* Listing Type */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldListingType}</label>
            <select
              value={form.listingType}
              onChange={(e) => handleChange("listingType", e.target.value)}
              className={`${inputCls} ${form.listingType ? "" : "text-muted-foreground"}`}
              required
            >
              <option value="" disabled>{t.shops.form.fieldListingTypePlaceholder}</option>
              <option value="takeover" className="text-foreground">{t.shops.types.takeover}</option>
              <option value="rent" className="text-foreground">{t.shops.types.rent}</option>
              <option value="both" className="text-foreground">{t.shops.types.both}</option>
            </select>
          </div>

          {/* Location + Building / Mall */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldLocation}</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => handleChange("location", e.target.value)}
                placeholder={t.shops.form.fieldLocationPlaceholder}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldBuilding}</label>
              <input
                type="text"
                value={form.building}
                onChange={(e) => handleChange("building", e.target.value)}
                placeholder={t.shops.form.fieldBuildingPlaceholder}
                className={inputCls}
              />
            </div>
          </div>

          {/* Monthly Rent + Floor Size */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldMonthlyRent}</label>
              <input
                type="text"
                value={form.monthlyRent}
                onChange={(e) => handleChange("monthlyRent", e.target.value)}
                placeholder={t.shops.form.fieldMonthlyRentPlaceholder}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldFloorSize}</label>
              <input
                type="text"
                value={form.floorSize}
                onChange={(e) => handleChange("floorSize", e.target.value)}
                placeholder={t.shops.form.fieldFloorSizePlaceholder}
                className={inputCls}
              />
            </div>
          </div>

          {/* Asking Price + Lease Remaining */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldAskingPrice}</label>
              <input
                type="text"
                value={form.askingPrice}
                onChange={(e) => handleChange("askingPrice", e.target.value)}
                placeholder={t.shops.form.fieldAskingPricePlaceholder}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldLeaseRemaining}</label>
              <input
                type="text"
                value={form.leaseRemaining}
                onChange={(e) => handleChange("leaseRemaining", e.target.value)}
                placeholder={t.shops.form.fieldLeaseRemainingPlaceholder}
                className={inputCls}
              />
            </div>
          </div>

          {/* Suitable For */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldSuitableFor}</label>
            <input
              type="text"
              value={form.suitableFor}
              onChange={(e) => handleChange("suitableFor", e.target.value)}
              placeholder={t.shops.form.fieldSuitableForPlaceholder}
              className={inputCls}
            />
          </div>

          {/* Key Features */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldKeyFeatures}</label>
            <p className="text-xs text-muted-foreground mb-2">{t.shops.form.fieldKeyFeaturesHint}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURE_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2.5 text-sm cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={features.includes(key)}
                    onChange={() => toggleFeature(key)}
                    className="rounded border-border accent-primary"
                  />
                  {t.shops.features[key]}
                </label>
              ))}
            </div>
            <input
              type="text"
              value={form.otherFeatures}
              onChange={(e) => handleChange("otherFeatures", e.target.value)}
              placeholder={t.shops.form.fieldOtherFeaturePlaceholder}
              className={`${inputCls} mt-2`}
            />
          </div>

          {/* Reason for Transfer (Optional) */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldReason}</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => handleChange("reason", e.target.value)}
              placeholder={t.shops.form.fieldReasonPlaceholder}
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldDescription}</label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder={t.shops.form.fieldDescriptionPlaceholder}
              className="w-full h-32 p-4 rounded-lg border bg-background text-sm resize-none"
              required
            />
          </div>

          {/* Contact Name - English only */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldContactName}</label>
            <input
              type="text"
              value={form.contactName}
              onChange={(e) => {
                // eslint-disable-next-line no-control-regex
                const v = e.target.value.replace(/[^\x00-\x7F]/g, "");
                handleChange("contactName", v);
              }}
              placeholder={t.shops.form.fieldContactNamePlaceholder}
              className={inputCls}
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.shops.form.fieldImages}</label>
            <p className="text-xs text-muted-foreground mb-2">{t.shops.form.fieldImagesHint}</p>
            {imagePreviews.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {imagePreviews.map((src, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-black/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {imageFiles.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 h-11 px-4 rounded-lg border border-dashed border-border bg-background text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <Upload className="h-4 w-4" />
                {t.shops.form.fieldImages} ({imageFiles.length}/5)
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleImageSelect} />
          </div>

          {/* Terms of Service */}
          {termsText && (
            <div className="bg-muted/50 border rounded-xl p-4">
              <p className="text-xs font-semibold text-foreground mb-2">{t.shops.form.termsTitle}</p>
              <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">{termsText}</div>
            </div>
          )}

          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={() => setAgreed(!agreed)} className="rounded border-border accent-primary" />
            {t.shops.form.agreeTerms}
          </label>
          <Button type="submit" className="w-full h-12 rounded-xl font-bold text-base" disabled={submitting || !agreed || uploadingImages}>
            {submitting || uploadingImages ? t.shops.form.submitting : t.shops.form.submit}
          </Button>
        </form>
      </div>
    </Layout>
  );
};

export default NewShopListing;
