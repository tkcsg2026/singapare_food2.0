"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, X } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { useFetch } from "@/hooks/useSupabaseData";
import { getCategoryDisplayName } from "@/lib/category-display";
import type { CategoryRow } from "@/types/database";

const NewItem = () => {
  const { user, profile, loading: authLoading } = useRequireAuth();
  const { t, lang } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [termsText, setTermsText] = useState("");
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conditions = [
    t.marketplace.conditions["like-new"],
    t.marketplace.conditions.good,
    t.marketplace.conditions.used,
    t.marketplace.conditions["needs-repair"],
  ];
  const areas = [
    t.marketplace.areas.central,
    t.marketplace.areas.east,
    t.marketplace.areas.west,
    t.marketplace.areas.north,
    t.marketplace.areas.south,
  ];
  const { data: marketplaceCategories } = useFetch<CategoryRow[]>("/api/categories?type=marketplace");
  const mpCategories = (marketplaceCategories || []).map((c) => c.value);
  const deliveryOptions = [
    t.marketplace.deliveryOptions.pickup,
    t.marketplace.deliveryOptions.delivery,
    t.marketplace.deliveryOptions.both,
  ];

  const otherCategory = "other";

  const [form, setForm] = useState({
    title: "", category: "kitchen", categoryOther: "", price: "", condition: conditions[0],
    years_used: "0", description: "", area: areas[0], delivery: deliveryOptions[0],
    sellerName: "",
  });

  useEffect(() => {
    if (!mpCategories.length) return;
    if (!mpCategories.includes(form.category)) {
      setForm((p) => ({ ...p, category: mpCategories[0] }));
    }
  }, [mpCategories, form.category]);

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

  const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const invalidFiles = files.filter((f) => !ACCEPTED_IMAGE_TYPES.includes(f.type));
    if (invalidFiles.length > 0) {
      alert(t.newItem.imageFormatError);
    }
    const validFiles = files.filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
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
    setUploadedUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (imageFiles.length === 0) return [];
    setUploadingImages(true);
    const urls: string[] = [];
    for (const file of imageFiles) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const j = await res.json();
        if (j?.url) urls.push(j.url);
      } catch {}
    }
    setUploadingImages(false);
    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !agreed) return;
    setSubmitting(true);

    const finalCategory = form.category === otherCategory && form.categoryOther.trim()
      ? `${otherCategory}:${form.categoryOther.trim()}`
      : form.category;

    const imageUrls = await uploadImages();
    const defaultImage = "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=450&fit=crop";
    const slug = form.title.toLowerCase().replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();

    const body = {
      title: form.title,
      category: finalCategory,
      price: Number(form.price),
      condition: form.condition,
      years_used: Number(form.years_used),
      description: form.description,
      area: form.area,
      delivery: form.delivery,
      slug,
      image: imageUrls[0] || defaultImage,
      images: imageUrls.length > 0 ? imageUrls : [defaultImage],
      seller_id: user.id,
      seller_name: form.sellerName || profile?.name || profile?.username || t.nav.user,
      seller_whatsapp: profile?.whatsapp || "",
    };

    const res = await fetch("/api/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSubmitting(false);
    if (res.ok) {
      alert(t.newItem.successMsg);
      window.location.href = "/dashboard";
    } else {
      alert(t.newItem.errorMsg);
    }
  };

  if (authLoading || !user) {
    return <Layout><div className="container py-16 text-center text-muted-foreground">{t.common.loading}</div></Layout>;
  }

  return (
    <Layout>
      <div className="container max-w-2xl py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 font-medium">
          <ArrowLeft className="h-4 w-4" /> {t.newItem.backToDashboard}
        </Link>
        <h1 className="text-3xl font-black tracking-tight mb-8">{t.newItem.title}</h1>

        <form onSubmit={handleSubmit} className="bg-card border p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.newItem.fieldTitle}</label>
            <input type="text" value={form.title} onChange={(e) => handleChange("title", e.target.value)} className="w-full h-11 px-4 rounded-lg border bg-background text-sm" required />
          </div>

          {/* Category + Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.newItem.fieldCategory}</label>
              <select value={form.category} onChange={(e) => handleChange("category", e.target.value)} className="w-full h-11 px-4 rounded-lg border bg-background text-sm">
                {mpCategories.map((c) => {
                  const row = (marketplaceCategories || []).find((x) => x.value === c);
                  const label = row
                    ? (getCategoryDisplayName(row, lang) || c)
                    : ((t.marketplace as { categories?: Record<string, string> }).categories?.[c] || c);
                  return <option key={c} value={c}>{label}</option>;
                })}
              </select>
              {form.category === otherCategory && (
                <input
                  type="text"
                  value={form.categoryOther}
                  onChange={(e) => handleChange("categoryOther", e.target.value)}
                  placeholder={t.newItem.fieldCategoryOtherPlaceholder}
                  className="mt-2 w-full h-11 px-4 rounded-lg border bg-background text-sm"
                />
              )}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.newItem.fieldPrice}</label>
              <input type="number" value={form.price} onChange={(e) => handleChange("price", e.target.value)} className="w-full h-11 px-4 rounded-lg border bg-background text-sm" required min="0" />
            </div>
          </div>

          {/* Condition + Years Used */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.newItem.fieldCondition}</label>
              <select value={form.condition} onChange={(e) => handleChange("condition", e.target.value)} className="w-full h-11 px-4 rounded-lg border bg-background text-sm">
                {conditions.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.newItem.fieldYearsUsed}</label>
              <input type="number" value={form.years_used} onChange={(e) => handleChange("years_used", e.target.value)} className="w-full h-11 px-4 rounded-lg border bg-background text-sm" required min="0" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.newItem.fieldDescription}</label>
            <textarea value={form.description} onChange={(e) => handleChange("description", e.target.value)} className="w-full h-28 p-4 rounded-lg border bg-background text-sm resize-none" required />
          </div>

          {/* Area + Delivery */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.newItem.fieldArea}</label>
              <select value={form.area} onChange={(e) => handleChange("area", e.target.value)} className="w-full h-11 px-4 rounded-lg border bg-background text-sm">
                {areas.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.newItem.fieldDelivery}</label>
              <select value={form.delivery} onChange={(e) => handleChange("delivery", e.target.value)} className="w-full h-11 px-4 rounded-lg border bg-background text-sm">
                {deliveryOptions.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Seller Name - English only */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.newItem.fieldSeller}</label>
            <input
              type="text"
              value={form.sellerName}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\x00-\x7F]/g, "");
                handleChange("sellerName", v);
              }}
              placeholder={t.newItem.fieldSellerPlaceholder}
              className="w-full h-11 px-4 rounded-lg border bg-background text-sm"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.newItem.fieldImages}</label>
            <p className="text-xs text-muted-foreground mb-2">{t.newItem.fieldImagesHint}</p>
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
                {t.newItem.fieldImages} ({imageFiles.length}/5)
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleImageSelect} />
          </div>

          {/* Terms of Service */}
          {termsText && (
            <div className="bg-muted/50 border rounded-xl p-4">
              <p className="text-xs font-semibold text-foreground mb-2">{t.newItem.termsTitle}</p>
              <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">{termsText}</div>
            </div>
          )}

          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={() => setAgreed(!agreed)} className="rounded border-border accent-primary" />
            {t.newItem.agreeTerms}
          </label>
          <Button type="submit" className="w-full h-12 rounded-xl font-bold text-base" disabled={submitting || !agreed || uploadingImages}>
            {submitting || uploadingImages ? t.newItem.submitting : t.newItem.submit}
          </Button>
        </form>
      </div>
    </Layout>
  );
};

export default NewItem;
