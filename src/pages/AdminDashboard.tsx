"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Store, ShoppingBag, CheckCircle, XCircle, Plus, Trash2, Edit2, Link2,
  BarChart3, Tag, Image, AlertTriangle, Shield, Save, Eye, EyeOff, Newspaper, Globe, ExternalLink, FileText, Palette, Users,
  Search, Ban, UserCheck, ClipboardList, Video, MessageCircle, Loader2, Play, Megaphone,
  ArrowUp, ArrowDown,
} from "lucide-react";
import { FONT_OPTIONS, COLOR_OPTIONS, applyTheme } from "@/components/ThemeProvider";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { getSupabase } from "@/lib/supabase";
import { sanitizeWhatsAppDigits } from "@/lib/jobs-whatsapp";
import { inferVideoMimeType, VIDEO_EXTENSIONS, getFileExtension } from "@/lib/video";
import { resolveCategoryDisplayLabels } from "@/lib/category-display";
import { buildDynamicGroups, getGroupLabel } from "@/lib/category-groups";
import type { CategoryGroup } from "@/lib/category-groups";
import { resolveCountryLabel } from "@/lib/country-map";

/** Returns true when a URL clearly points to a video file (by extension). */
function isVideoFileUrl(url: string): boolean {
  if (!url) return false;
  return VIDEO_EXTENSIONS.has(getFileExtension(url.trim()));
}

/**
 * Attempts to extract the first video frame as a JPEG data URL using the
 * browser's Canvas API.  Returns null if the format is unsupported or the
 * operation times out (5 s).
 */
async function generateVideoThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    let resolved = false;
    const finish = (result: string | null) => {
      if (resolved) return;
      resolved = true;
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };

    // 5-second safety timeout
    const tid = setTimeout(() => finish(null), 5000);

    video.onseeked = () => {
      clearTimeout(tid);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) { finish(null); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.75));
      } catch {
        finish(null);
      }
    };

    video.onloadedmetadata = () => {
      // A tiny offset ensures the seeked event fires even on the first frame
      video.currentTime = 0.001;
    };

    video.onerror = () => {
      clearTimeout(tid);
      finish(null);
    };

    video.src = objectUrl;
  });
}

/**
 * Authenticated fetch helper: attaches the current user's Bearer token to
 * every request so admin API routes can verify the caller's identity.
 */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const sb = getSupabase();
  const session = sb ? (await sb.auth.getSession()).data.session : null;
  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(url, { ...options, headers });
}

const AdminDashboard = () => {
  const { user, profile, loading: authLoading } = useRequireAuth(true);
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("suppliers");
  const [pendingCount, setPendingCount] = useState(0);
  const [reportPendingCount, setReportPendingCount] = useState(0);

  useEffect(() => {
    if (!authLoading && user && profile?.role === "admin") {
      fetch("/api/marketplace?status=pending&noFallback=true")
        .then((r) => r.json())
        .then((d) => setPendingCount(Array.isArray(d) ? d.length : 0))
        .catch(() => {});
    }
  }, [authLoading, user, profile]);

  const refreshReportBadge = useCallback(() => {
    if (!user || profile?.role !== "admin") return;
    authFetch("/api/reports")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) =>
        setReportPendingCount(
          Array.isArray(d) ? d.filter((x: { status?: string }) => x.status === "pending").length : 0,
        ),
      )
      .catch(() => setReportPendingCount(0));
  }, [user, profile?.role]);

  useEffect(() => {
    if (!authLoading && user && profile?.role === "admin") refreshReportBadge();
  }, [authLoading, user, profile?.role, refreshReportBadge]);

  const adminTabs = [
    { id: "suppliers",  label: t.admin.tabSuppliers,  icon: Store },
    { id: "users",      label: t.admin.tabUsers,      icon: Users },
    { id: "approvals",  label: t.admin.tabApprovals,  icon: CheckCircle },
    { id: "marketplace", label: t.admin.tabMarketplace, icon: ShoppingBag },
    { id: "news",       label: t.admin.tabNews,       icon: Newspaper },
    { id: "links",      label: t.admin.tabLinks,      icon: Globe },
    { id: "categories", label: t.admin.tabCategories, icon: Tag },
    { id: "about",      label: t.admin.tabAbout,     icon: FileText },
    { id: "jobs",       label: t.admin.tabJobs,      icon: MessageCircle },
    { id: "terms",      label: t.admin.tabTerms,      icon: Shield },
    { id: "privacy",    label: t.admin.tabPrivacy,    icon: Shield },
    { id: "home-video", label: t.admin.tabHomeVideo,   icon: Video },
    { id: "banner",     label: t.admin.tabBanner,      icon: Megaphone },
    { id: "qr",         label: t.admin.tabQR,         icon: Link2 },
    { id: "reports",    label: t.admin.tabReports,    icon: AlertTriangle },
    { id: "analytics",  label: t.admin.tabAnalytics,  icon: BarChart3 },
    { id: "appearance", label: t.admin.tabAppearance,  icon: Palette },
    { id: "audit-log",  label: t.admin.tabAuditLog,   icon: ClipboardList },
  ];

  if (authLoading || !user || profile?.role !== "admin") {
    return <Layout><div className="container py-16 text-center text-muted-foreground">{t.common.loading}</div></Layout>;
  }

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-black tracking-tight">{t.admin.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t.admin.subtitle}</p>
          </div>
        </div>

        <div className="flex gap-8">
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24 space-y-1">
              {adminTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === tab.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <tab.icon className="h-4 w-4" /> {tab.label}
                  {tab.id === "approvals" && pendingCount > 0 && (
                    <span className="ml-auto min-w-[1.25rem] h-5 px-1 flex items-center justify-center text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full">
                      {pendingCount}
                    </span>
                  )}
                  {tab.id === "reports" && reportPendingCount > 0 && (
                    <span className="ml-auto min-w-[1.25rem] h-5 px-1 flex items-center justify-center text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full">
                      {reportPendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="lg:hidden flex gap-2 overflow-x-auto scrollbar-hide pb-4 mb-6 -mx-1 px-1">
              {adminTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-full text-xs font-medium whitespace-nowrap ${
                    activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" /> {tab.label}
                  {tab.id === "approvals" && pendingCount > 0 && (
                    <span className="min-w-[1.125rem] h-[1.125rem] px-0.5 flex items-center justify-center text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full">
                      {pendingCount}
                    </span>
                  )}
                  {tab.id === "reports" && reportPendingCount > 0 && (
                    <span className="min-w-[1.125rem] h-[1.125rem] px-0.5 flex items-center justify-center text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full">
                      {reportPendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === "suppliers" && <SupplierManager />}
            {activeTab === "users" && <UsersManager />}
            {activeTab === "approvals" && <ApprovalQueue onCountChange={setPendingCount} />}
            {activeTab === "marketplace" && <MarketplaceManager />}
            {activeTab === "news" && <NewsManager />}
            {activeTab === "links" && <LinksManager />}
            {activeTab === "categories" && <CategoryManager />}
            {activeTab === "about" && <AboutSiteManager />}
            {activeTab === "jobs" && <JobsManager />}
            {activeTab === "terms" && <TermsManager />}
            {activeTab === "privacy" && <PrivacyManager />}
            {activeTab === "home-video" && <HomeVideoManager />}
            {activeTab === "banner" && <BannerManager />}
            {activeTab === "qr" && <QRManager />}
            {activeTab === "reports" && <ReportManager onReportChanged={refreshReportBadge} />}
            {activeTab === "analytics" && <AnalyticsPanel />}
            {activeTab === "appearance" && <AppearanceManager />}
            {activeTab === "audit-log" && <AuditLogViewer />}
          </div>
        </div>
      </div>
    </Layout>
  );
};

const PLAN_BADGE: Record<string, string> = {
  premium: "bg-amber-100 text-amber-700 border border-amber-300",
  standard: "bg-red-100 text-red-600 border border-red-300",
  basic: "bg-muted text-muted-foreground border border-border",
};
const PLAN_LABEL: Record<string, string> = { premium: "Premium", standard: "Standard", basic: "Basic" };

const AREA_OPTIONS: { value: string; label: string; label_ja: string }[] = [
  { value: "central", label: "Central", label_ja: "中央エリア" },
  { value: "east", label: "East", label_ja: "東部エリア" },
  { value: "west", label: "West", label_ja: "西部エリア" },
  { value: "north", label: "North", label_ja: "北部エリア" },
  { value: "south", label: "South", label_ja: "南部エリア" },
];

function SupplierManager() {
  const { t, lang } = useTranslation();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [productSlug, setProductSlug] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = useState<CategoryGroup[]>([]);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "", name_ja: "", slug: "", category: "", category_ja: "",
    category_2: "", category_2_ja: "", category_3: "", category_3_ja: "",
    area: "central", area_ja: "中央エリア", tags: "", description: "", description_ja: "",
    whatsapp: "", whatsapp_contact_name: "", logo: "", catalog_url: "", image_2: "", image_3: "",
    certifications: "", about: "", about_ja: "", featured: false,
    plan: "basic" as "basic" | "standard" | "premium",
  });

  useEffect(() => { fetchSuppliers(); }, []);
  useEffect(() => {
    Promise.all([
      fetch("/api/categories?type=supplier").then((r) => r.json()),
      fetch("/api/categories?type=supplier-group").then((r) => r.json()),
    ]).then(([cats, groups]) => {
      setAvailableCategories(cats);
      setAvailableGroups(buildDynamicGroups(groups, cats));
    }).catch(() => {});
    fetch("/api/categories?type=tag").then((r) => r.json()).then(setAvailableTags).catch(() => {});
  }, []);

  const fetchSuppliers = async () => {
    // includeHidden=1 makes the API return hidden suppliers when called as admin
    const res = await authFetch("/api/suppliers?includeHidden=1");
    setSuppliers(await res.json());
  };

  /** Toggle the hidden flag (Post / non-Post) for a supplier. */
  const handleToggleHidden = async (s: any) => {
    const next = !s.hidden;
    const confirmMsg = next
      ? (lang === "ja"
          ? `「${s.name_ja || s.name}」を非表示（Post）にしますか？\n一般公開の一覧から消えます。`
          : `Hide "${s.name || s.name_ja}" from public listings?`)
      : (lang === "ja"
          ? `「${s.name_ja || s.name}」を再公開しますか？`
          : `Re-publish "${s.name || s.name_ja}" to public listings?`);
    if (!confirm(confirmMsg)) return;
    const res = await authFetch(`/api/suppliers/${encodeURIComponent(s.slug)}`, {
      method: "PUT",
      body: JSON.stringify({ hidden: next }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(lang === "ja"
        ? `更新に失敗しました。\n${err?.error ?? res.statusText}`
        : `Update failed.\n${err?.error ?? res.statusText}`);
      return;
    }
    fetchSuppliers();
  };

  /** Select a category from the dropdown and auto-fill the matching label_ja */
  const handleCategorySelect = (slot: 1 | 2 | 3, value: string) => {
    const cat = availableCategories.find((c: any) => c.value === value);
    const enKey = slot === 1 ? "category" : slot === 2 ? "category_2" : "category_3";
    const jaKey = slot === 1 ? "category_ja" : slot === 2 ? "category_2_ja" : "category_3_ja";
    setForm((p) => ({ ...p, [enKey]: value, [jaKey]: cat?.label_ja || p[jaKey as keyof typeof p] }));
  };

  /** Select area and auto-fill area_ja */
  const handleAreaSelect = (value: string) => {
    const opt = AREA_OPTIONS.find((a) => a.value === value);
    setForm((p) => ({ ...p, area: value, area_ja: opt?.label_ja ?? p.area_ja }));
  };

  /** Toggle a tag — store label_ja so frontend tagMap displays correctly in both languages.
   *  When removing, strip every alias (value / label / label_ja) of the same tag so legacy
   *  duplicates (e.g. both "Japanese Support" and "日本語対応") are cleared in one click. */
  const toggleTag = (tagValue: string) => {
    const tag = availableTags.find((t: any) => t.value === tagValue);
    const aliases = new Set<string>();
    if (tag) {
      if (tag.value) aliases.add(String(tag.value));
      if (tag.label) aliases.add(String(tag.label));
      if (tag.label_ja) aliases.add(String(tag.label_ja));
    } else {
      aliases.add(tagValue);
    }
    const canonical = (tag?.label_ja || tag?.label || tagValue) as string;
    const current = form.tags.split(",").map((s) => s.trim()).filter(Boolean);
    const isSelected = current.some((c) => aliases.has(c));
    let next: string[];
    if (isSelected) {
      next = current.filter((c) => !aliases.has(c));
    } else {
      next = [...current, canonical];
    }
    next = Array.from(new Set(next));
    setForm((p) => ({ ...p, tags: next.join(", ") }));
  };

  const resetForm = () => {
    setForm({
      name: "", name_ja: "", slug: "", category: "", category_ja: "",
      category_2: "", category_2_ja: "", category_3: "", category_3_ja: "",
      area: "central", area_ja: "中央エリア", tags: "", description: "", description_ja: "",
      whatsapp: "", whatsapp_contact_name: "", logo: "", catalog_url: "", image_2: "", image_3: "",
      certifications: "", about: "", about_ja: "", featured: false, plan: "basic",
    });
    setEditSlug(null);
  };

  const handleEdit = (s: any) => {
    // Map stored tags to a canonical label_ja so form state matches; support legacy value/label.
    // Dedupe so that legacy duplicates collapse to a single entry — otherwise the card would
    // render the same tag twice.
    const tagStrs = Array.from(
      new Set(
        (s.tags || []).map((t: string) => {
          const tag = availableTags.find((at: any) => at.label_ja === t || at.label === t || at.value === t);
          return tag ? (tag.label_ja || tag.label) : t;
        })
      )
    );
    setForm({
      name: s.name || "", name_ja: s.name_ja || "", slug: s.slug, category: s.category || "", category_ja: s.category_ja || "",
      category_2: s.category_2 || "", category_2_ja: s.category_2_ja || "", category_3: s.category_3 || "", category_3_ja: s.category_3_ja || "",
      area: s.area || "central", area_ja: s.area_ja || (AREA_OPTIONS.find((a) => a.value === (s.area || "central"))?.label_ja ?? ""), tags: tagStrs.join(", "),
      // Always fall back to "" so undefined values don't accidentally clear saved text on re-open
      description: s.description ?? "", description_ja: s.description_ja ?? "", whatsapp: s.whatsapp || "",
      whatsapp_contact_name: s.whatsapp_contact_name || "", logo: s.logo || "", catalog_url: s.catalog_url || "", image_2: s.image_2 || "", image_3: s.image_3 || "",
      certifications: (s.certifications || []).join(", "), about: s.about ?? "", about_ja: s.about_ja ?? "", featured: !!s.featured,
      plan: s.plan || "basic",
    });
    setEditSlug(s.slug);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (isSaving) return;
    const slugTrimmed = (form.slug || "").trim();
    const nameTrimmed = (form.name || "").trim();
    const nameJaTrimmed = (form.name_ja || "").trim();
    if (!slugTrimmed) {
      alert((lang === "ja" ? "スラッグは必須です。" : "Slug is required. ") + (t.admin.slugRequiredPlaceholder ?? ""));
      return;
    }
    if (!nameTrimmed && !nameJaTrimmed) {
      alert(lang === "ja" ? "名前（英語または日本語）のいずれかを入力してください。" : "Please enter either name (EN) or name (JA).");
      return;
    }
    setIsSaving(true);
    try {
      const body = {
        ...form,
        slug: slugTrimmed,
        name: nameTrimmed || form.name,
        name_ja: nameJaTrimmed || form.name_ja,
        tags: Array.from(new Set(form.tags.split(",").map((tt) => tt.trim()).filter(Boolean))),
        certifications: form.certifications.split(",").map((c) => c.trim()).filter(Boolean),
      };

      const res = editSlug
        ? await authFetch(`/api/suppliers/${editSlug}`, { method: "PUT", body: JSON.stringify(body) })
        : await authFetch("/api/suppliers", { method: "POST", body: JSON.stringify(body) });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(lang === "ja"
          ? `保存に失敗しました。\n${err?.error ?? res.statusText}`
          : `Save failed.\n${err?.error ?? res.statusText}`);
        return;
      }

      setShowForm(false);
      resetForm();
      fetchSuppliers();
    } catch (e) {
      alert(lang === "ja" ? "ネットワークエラーが発生しました。" : "Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!confirm(t.admin.deleteSupplierConfirm)) return;
    const res = await authFetch(`/api/suppliers/${encodeURIComponent(slug)}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(lang === "ja"
        ? `削除に失敗しました。\n${err?.error ?? res.statusText}`
        : `Delete failed.\n${err?.error ?? res.statusText}`);
      return;
    }
    fetchSuppliers();
  };

  const filteredSuppliers = suppliers.filter((s: any) => {
    if (!supplierSearch.trim()) return true;
    const q = supplierSearch.toLowerCase().trim();
    const name = (s.name || "").toLowerCase();
    const nameJa = (s.name_ja || "").toLowerCase();
    const slug = (s.slug || "").toLowerCase();
    const cat = [s.category, s.category_2, s.category_3, s.category_ja, s.category_2_ja, s.category_3_ja].join(" ").toLowerCase();
    const area = ((s.area || "") + (s.area_ja || "")).toLowerCase();
    const tags = (s.tags || []).join(" ").toLowerCase();
    return name.includes(q) || nameJa.includes(q) || slug.includes(q) || cat.includes(q) || area.includes(q) || tags.includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-xl font-bold">{t.admin.supplierManagement}</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              placeholder={lang === "ja" ? "サプライヤーを検索（名前・カテゴリ・エリア等）" : "Search suppliers (name, category, area…)"}
              className="h-10 pl-9 pr-3 rounded-lg border bg-background text-sm w-56 placeholder:text-muted-foreground"
            />
          </div>
          <Button onClick={() => { resetForm(); setShowForm(!showForm); }} className="rounded-xl gap-2">
            <Plus className="h-4 w-4" /> {showForm ? t.admin.close : t.admin.add}
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InputField label={t.admin.nameEn} value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} required />
            <InputField label={t.admin.nameJa} value={form.name_ja} onChange={(v) => setForm((p) => ({ ...p, name_ja: v }))} required />
          </div>
          <InputField label={t.admin.slug} value={form.slug} onChange={(v) => setForm((p) => ({ ...p, slug: v }))} required placeholder={t.admin.slugRequiredPlaceholder} />
          {/* Category 1 — select from CategoryManager */}
          <p className="text-xs text-muted-foreground -mt-2">
            {lang === "ja" ? "※ JA未設定 = カテゴリーに日本語ラベルが未登録です。カテゴリー管理タブで編集できます。" : "※ JA未設定 = Category has no Japanese label. Edit in Category Management tab."}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.admin.category1}</label>
              <select value={form.category} onChange={(e) => handleCategorySelect(1, e.target.value)} className="h-11 px-4 rounded-lg border bg-background text-sm w-full">
                <option value="">—</option>
                {availableGroups.map((group) => {
                  const opts = group.children.map((v) => availableCategories.find((c: any) => c.value === v)).filter(Boolean);
                  if (opts.length === 0) return null;
                  return (
                    <optgroup key={group.key} label={getGroupLabel(group, lang)}>
                      {opts.map((c: any) => <option key={c.value} value={c.value}>{lang === "ja" ? (c.label_ja || c.label) : c.label}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.admin.category1Ja}</label>
              <input value={form.category_ja} onChange={(e) => setForm((p) => ({ ...p, category_ja: e.target.value }))} placeholder={availableCategories.find((c: any) => c.value === form.category)?.label_ja ?? ""} className="h-11 px-4 rounded-lg border bg-background text-sm w-full" />
            </div>
          </div>
          {/* Category 2 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.admin.category2}</label>
              <select value={form.category_2} onChange={(e) => handleCategorySelect(2, e.target.value)} className="h-11 px-4 rounded-lg border bg-background text-sm w-full">
                <option value="">—</option>
                {availableGroups.map((group) => {
                  const opts = group.children.map((v) => availableCategories.find((c: any) => c.value === v)).filter(Boolean);
                  if (opts.length === 0) return null;
                  return (
                    <optgroup key={group.key} label={getGroupLabel(group, lang)}>
                      {opts.map((c: any) => <option key={c.value} value={c.value}>{lang === "ja" ? (c.label_ja || c.label) : c.label}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.admin.category2Ja}</label>
              <input value={form.category_2_ja} onChange={(e) => setForm((p) => ({ ...p, category_2_ja: e.target.value }))} placeholder={availableCategories.find((c: any) => c.value === form.category_2)?.label_ja ?? ""} className="h-11 px-4 rounded-lg border bg-background text-sm w-full" />
            </div>
          </div>
          {/* Category 3 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.admin.category3}</label>
              <select value={form.category_3} onChange={(e) => handleCategorySelect(3, e.target.value)} className="h-11 px-4 rounded-lg border bg-background text-sm w-full">
                <option value="">—</option>
                {availableGroups.map((group) => {
                  const opts = group.children.map((v) => availableCategories.find((c: any) => c.value === v)).filter(Boolean);
                  if (opts.length === 0) return null;
                  return (
                    <optgroup key={group.key} label={getGroupLabel(group, lang)}>
                      {opts.map((c: any) => <option key={c.value} value={c.value}>{lang === "ja" ? (c.label_ja || c.label) : c.label}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.admin.category3Ja}</label>
              <input value={form.category_3_ja} onChange={(e) => setForm((p) => ({ ...p, category_3_ja: e.target.value }))} placeholder={availableCategories.find((c: any) => c.value === form.category_3)?.label_ja ?? ""} className="h-11 px-4 rounded-lg border bg-background text-sm w-full" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.admin.area}</label>
            <select value={form.area} onChange={(e) => handleAreaSelect(e.target.value)} className="h-11 px-4 rounded-lg border bg-background text-sm w-full">
              {AREA_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>{lang === "ja" ? a.label_ja : a.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">{form.area_ja}</p>
          </div>
          {/* Tags — multi-select from category management (type=tag). Stored as label_ja for correct JA/EN display on frontend. */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.admin.tags}</label>
            {availableTags.length > 0 ? (
              <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-background">
                {availableTags.map((tag: any) => {
                  const selected = form.tags.split(",").map((s) => s.trim()).some((t) => t === tag.label_ja || t === tag.label || t === tag.value);
                  return (
                    <button key={tag.value} type="button" onClick={() => toggleTag(tag.value)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${selected ? "bg-primary text-white border-primary" : "bg-muted border-border text-muted-foreground hover:border-primary hover:text-primary"}`}>
                      {lang === "ja" ? (tag.label_ja || tag.label) : tag.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <InputField label="" value={form.tags} onChange={(v) => setForm((p) => ({ ...p, tags: v }))} />
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {lang === "ja"
                ? "※ 日本語ラベル（label_ja）で保存されます。サイト表示時に言語切り替えが正しく反映されます。"
                : "※ Saved as Japanese label (label_ja) so site display switches correctly by language."}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{lang === "ja" ? "説明（英語・カード用）" : "Description (EN, for cards)"}</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="w-full h-20 p-3 rounded-lg border bg-background text-sm resize-none" placeholder={lang === "ja" ? "カードに表示する短い説明" : "Short description for cards"} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{lang === "ja" ? "説明（日本語・カード用）" : "Description (JA, for cards)"}</label>
            <textarea value={form.description_ja} onChange={(e) => setForm((p) => ({ ...p, description_ja: e.target.value }))} className="w-full h-20 p-3 rounded-lg border bg-background text-sm resize-none" placeholder={lang === "ja" ? "カードに表示する短い説明" : "Short description for cards"} />
          </div>
          <InputField label="WhatsApp" value={form.whatsapp} onChange={(v) => setForm((p) => ({ ...p, whatsapp: v }))} />
          <InputField label={t.admin.contactNameWhatsApp} value={form.whatsapp_contact_name} onChange={(v) => setForm((p) => ({ ...p, whatsapp_contact_name: v }))} />
          <ImageField label={t.admin.image1} value={form.logo} onChange={(v) => setForm((p) => ({ ...p, logo: v }))} hint={t.admin.imageHint} uploadLabel={t.admin.imageUploadOrUrl} />
          <InputField label={t.admin.catalogUrl} value={form.catalog_url} onChange={(v) => setForm((p) => ({ ...p, catalog_url: v }))} placeholder="https://..." />
          <ImageField label={t.admin.image2} value={form.image_2} onChange={(v) => setForm((p) => ({ ...p, image_2: v }))} hint={t.admin.imageHint} uploadLabel={t.admin.imageUploadOrUrl} />
          <ImageField label={t.admin.image3} value={form.image_3} onChange={(v) => setForm((p) => ({ ...p, image_3: v }))} hint={t.admin.imageHint} uploadLabel={t.admin.imageUploadOrUrl} />
          <InputField
            label={lang === "ja" ? `${t.admin.certifications}（英語入力）` : `${t.admin.certifications} (English input)`}
            value={form.certifications}
            onChange={(v) => setForm((p) => ({ ...p, certifications: v }))}
          />
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.admin.aboutEn}</label>
            <textarea value={form.about} onChange={(e) => setForm((p) => ({ ...p, about: e.target.value }))} className="w-full h-20 p-3 rounded-lg border bg-background text-sm resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.admin.aboutJa}</label>
            <textarea value={form.about_ja} onChange={(e) => setForm((p) => ({ ...p, about_ja: e.target.value }))} className="w-full h-20 p-3 rounded-lg border bg-background text-sm resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.admin.planLabel}</label>
            <select
              value={form.plan}
              onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value as "basic" | "standard" | "premium" }))}
              className="h-11 px-4 rounded-lg border bg-background text-sm w-full"
            >
              <option value="basic">{t.admin.planBasic}</option>
              <option value="standard">{t.admin.planStandard}</option>
              <option value="premium">{t.admin.planPremium}</option>
            </select>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="rounded-xl gap-2">
            <Save className="h-4 w-4" /> {isSaving ? (lang === "ja" ? "保存中…" : "Saving…") : (editSlug ? t.admin.update : t.admin.create)}
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-3">
        {lang === "ja" ? `${filteredSuppliers.length}件 / ${suppliers.length}件中` : `${filteredSuppliers.length} of ${suppliers.length}`}
      </p>
      <div className="space-y-3">
        {filteredSuppliers.map((s: any) => (
          <div key={s.id}>
            <div className={`bg-card border p-4 space-y-3 ${s.hidden ? "opacity-70 ring-1 ring-amber-300/60" : ""}`}>
              {/* Row 1: image + text */}
              <div className="flex items-start gap-3 min-w-0">
                <img src={s.logo} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-bold text-sm break-words">{lang === "ja" ? s.name_ja : s.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${PLAN_BADGE[s.plan || "basic"]}`}>
                      {PLAN_LABEL[s.plan || "basic"]}
                    </span>
                    {s.hidden && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        <EyeOff className="h-3 w-3" /> {lang === "ja" ? "非表示 (Post)" : "Hidden (Post)"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground break-words">{
                    (lang === "ja"
                      ? [s.category_ja, s.category_2_ja, s.category_3_ja]
                      : [
                          (t.suppliers as { categories?: Record<string, string> }).categories?.[s.category] ?? s.category,
                          (t.suppliers as { categories?: Record<string, string> }).categories?.[s.category_2] ?? s.category_2,
                          (t.suppliers as { categories?: Record<string, string> }).categories?.[s.category_3] ?? s.category_3,
                        ]
                    ).filter(Boolean).join(" · ") || "—"
                  } · {lang === "ja" ? s.area_ja : ((t.suppliers as { areas?: Record<string, string> }).areas?.[s.area] ?? s.area)} · {s.views} {t.admin.analytics.viewsLabel} · {(s.whatsapp_clicks ?? 0)} {t.admin.analytics.whatsappTapsShort}</p>
                </div>
              </div>
              {/* Row 2: action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setProductSlug(productSlug === s.slug ? null : s.slug)}>
                  <ShoppingBag className="h-3 w-3 mr-1" /> {t.admin.manageProducts}
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => handleEdit(s)}><Edit2 className="h-3 w-3" /></Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`rounded-xl ${s.hidden ? "text-amber-700" : ""}`}
                  onClick={() => handleToggleHidden(s)}
                  title={s.hidden ? (lang === "ja" ? "再公開する" : "Show on public site") : (lang === "ja" ? "非表示にする (Post)" : "Hide from public site (Post)")}
                >
                  {s.hidden ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                  {s.hidden ? (lang === "ja" ? "再公開" : "Unhide") : (lang === "ja" ? "非表示" : "Hide")}
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl text-destructive" onClick={() => handleDelete(s.slug)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            {productSlug === s.slug && <ProductManager slug={s.slug} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersManager() {
  const { t, lang } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", username: "", password: "", role: "user", company: "", whatsapp: "", avatar_url: "" });
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    role: "user",
    whatsapp: "",
    company: "",
    banned: false,
    avatar_url: "",
    linkedSupplierId: "",
  });
  const [banLoading, setBanLoading] = useState<string | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<{ id: string; name: string; name_ja: string }[]>([]);

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    authFetch("/api/suppliers")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: unknown) => {
        if (!Array.isArray(d)) return;
        setSupplierOptions(
          d.map((s: { id: string; name: string; name_ja: string }) => ({ id: s.id, name: s.name, name_ja: s.name_ja })),
        );
      })
      .catch(() => setSupplierOptions([]));
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await authFetch("/api/users");
      if (!res.ok) { setUsers([]); return; }
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { setUsers([]); }
  };

  const clearForm = () => {
    setForm({
      name: "",
      email: "",
      username: "",
      role: "user",
      whatsapp: "",
      company: "",
      banned: false,
      avatar_url: "",
      linkedSupplierId: "",
    });
    setEditingId(null);
  };

  const handleEdit = (u: any) => {
    const rep = u.supplier_representatives;
    let linkedSupplierId = "";
    if (rep) {
      linkedSupplierId = Array.isArray(rep)
        ? (rep[0]?.supplier_id ?? "")
        : (rep.supplier_id ?? "");
    }
    setForm({
      name: u.name ?? "",
      email: u.email ?? "",
      username: u.username ?? "",
      role: u.role ?? "user",
      whatsapp: u.whatsapp ?? "",
      company: u.company ?? "",
      banned: !!u.banned,
      avatar_url: u.avatar_url ?? "",
      linkedSupplierId,
    });
    setEditingId(u.id);
  };

  const handleSave = async () => {
    if (!editingId) return;
    const payload = {
      ...form,
      linkedSupplierId: form.linkedSupplierId.trim() || null,
    };
    const res = await authFetch(`/api/users/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err?.error ?? res.statusText); return; }
    clearForm(); fetchUsers();
  };

  const handleBanToggle = async (u: any) => {
    const newBanned = !u.banned;
    const msg = newBanned
      ? (lang === "ja" ? `「${u.name || u.email}」を停止しますか？` : `Suspend "${u.name || u.email}"?`)
      : (lang === "ja" ? `「${u.name || u.email}」の停止を解除しますか？` : `Reactivate "${u.name || u.email}"?`);
    if (!confirm(msg)) return;
    setBanLoading(u.id);
    try {
      const res = await authFetch(`/api/users/${u.id}`, { method: "PUT", body: JSON.stringify({ banned: newBanned }) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err?.error ?? res.statusText); }
      else fetchUsers();
    } finally { setBanLoading(null); }
  };

  const handleDelete = async (id: string, label?: string) => {
    const msg = lang === "ja"
      ? `「${label || id}」を完全に削除しますか？\nこの操作は取り消せません。`
      : `Permanently delete "${label || id}"?\nThis cannot be undone.`;
    if (!confirm(msg)) return;
    const res = await authFetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err?.error ?? res.statusText); return; }
    if (editingId === id) clearForm();
    fetchUsers();
  };

  const handleAddUser = async () => {
    setAddError("");
    if (!(addForm.name || "").trim() || !(addForm.email || "").trim() || !(addForm.username || "").trim() || (addForm.password || "").length < 8) {
      setAddError(lang === "ja" ? "必須項目を入力してください（パスワードは8文字以上）" : "All fields required. Password must be 8+ characters."); return;
    }
    setAddLoading(true);
    try {
      const res = await authFetch("/api/auth/register", { method: "POST", body: JSON.stringify(addForm) });
      const data = await res.json();
      if (!res.ok || data.error) { setAddError(data.error ?? res.statusText); return; }
      setShowAddForm(false);
      setAddForm({ name: "", email: "", username: "", password: "", role: "user", company: "", whatsapp: "", avatar_url: "" });
      fetchUsers();
    } catch { setAddError(lang === "ja" ? "ネットワークエラー" : "Network error."); }
    finally { setAddLoading(false); }
  };

  const formatDate = (s: string) => {
    try { return new Date(s).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-SG", { year: "numeric", month: "short", day: "numeric" }); }
    catch { return s || "—"; }
  };

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.username || "").toLowerCase().includes(q) ||
      (u.company || "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">{t.admin.usersManagement}</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full font-medium">
            {users.length}
          </span>
        </div>
        <Button size="sm" className="rounded-xl gap-1" onClick={() => { setShowAddForm((v) => !v); setAddError(""); }}>
          <Plus className="h-4 w-4" /> {showAddForm ? t.admin.close : t.admin.add}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{t.admin.usersManagementDesc}</p>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={lang === "ja" ? "名前・メール・ユーザー名で検索…" : "Search by name, email, or username…"}
          className="w-full h-10 pl-9 pr-4 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Add user form */}
      {showAddForm && (
        <div className="bg-muted/50 border rounded-xl p-5 mb-6 space-y-4">
          <h3 className="font-semibold">{t.admin.addUser}</h3>
          {addError && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{addError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label={t.admin.userName} value={addForm.name} onChange={(v) => setAddForm((p) => ({ ...p, name: v }))} required />
            <InputField label={t.admin.userEmail} value={addForm.email} onChange={(v) => setAddForm((p) => ({ ...p, email: v }))} required />
            <InputField label={t.admin.userUsername} value={addForm.username} onChange={(v) => setAddForm((p) => ({ ...p, username: v }))} required />
            <InputField label={t.admin.userPassword} value={addForm.password} onChange={(v) => setAddForm((p) => ({ ...p, password: v }))} required placeholder="8+ characters" />
            <InputField label={t.admin.userCompany} value={addForm.company} onChange={(v) => setAddForm((p) => ({ ...p, company: v }))} />
            <InputField label={t.admin.userWhatsApp} value={addForm.whatsapp} onChange={(v) => setAddForm((p) => ({ ...p, whatsapp: v }))} />
            <div className="sm:col-span-2">
              <ImageField label={t.admin.userAvatar} value={addForm.avatar_url} onChange={(v) => setAddForm((p) => ({ ...p, avatar_url: v }))} hint={t.admin.imageHint} uploadLabel={t.admin.imageUploadOrUrl} folder="avatars" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t.admin.userRole}</label>
              <select value={addForm.role} onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value }))} className="h-11 px-4 rounded-lg border bg-background text-sm">
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="rounded-xl" onClick={handleAddUser} disabled={addLoading}>{addLoading ? (lang === "ja" ? "作成中..." : "Creating...") : t.admin.create}</Button>
            <Button variant="outline" className="rounded-xl" onClick={() => { setShowAddForm(false); setAddError(""); }}>{t.admin.close}</Button>
          </div>
        </div>
      )}

      {/* Edit user form */}
      {editingId && (
        <div className="bg-muted/50 border rounded-xl p-5 mb-6 space-y-4">
          <h3 className="font-semibold">{t.admin.edit}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label={t.admin.userName} value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} required />
            <InputField label={t.admin.userEmail} value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} required />
            <InputField label={t.admin.userUsername} value={form.username} onChange={(v) => setForm((p) => ({ ...p, username: v }))} />
            <InputField label={t.admin.userWhatsApp} value={form.whatsapp} onChange={(v) => setForm((p) => ({ ...p, whatsapp: v }))} />
            <InputField label={t.admin.userCompany} value={form.company} onChange={(v) => setForm((p) => ({ ...p, company: v }))} />
            <div className="sm:col-span-2">
              <ImageField label={t.admin.userAvatar} value={form.avatar_url} onChange={(v) => setForm((p) => ({ ...p, avatar_url: v }))} hint={t.admin.imageHint} uploadLabel={t.admin.imageUploadOrUrl} folder="avatars" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t.admin.userRole}</label>
              <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className="h-11 px-4 rounded-lg border bg-background text-sm">
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium">{t.admin.linkedSupplierLabel}</label>
              <p className="text-xs text-muted-foreground">{t.admin.linkedSupplierHint}</p>
              <select
                value={form.linkedSupplierId}
                onChange={(e) => setForm((p) => ({ ...p, linkedSupplierId: e.target.value }))}
                className="h-11 px-4 rounded-lg border bg-background text-sm"
              >
                <option value="">—</option>
                {supplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {lang === "ja" ? (s.name_ja || s.name) : (s.name || s.name_ja)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="user-banned" checked={form.banned} onChange={(e) => setForm((p) => ({ ...p, banned: e.target.checked }))} className="accent-primary" />
              <label htmlFor="user-banned" className="text-sm font-medium">{t.admin.userBanned}</label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="rounded-xl">{t.admin.save}</Button>
            <Button variant="outline" onClick={clearForm} className="rounded-xl">{t.admin.close}</Button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left py-3 px-3 font-semibold">{t.admin.userName}</th>
              <th className="text-left py-3 px-3 font-semibold">{t.admin.userEmail}</th>
              <th className="text-left py-3 px-3 font-semibold hidden sm:table-cell">{t.admin.userRole}</th>
              <th className="text-left py-3 px-3 font-semibold hidden md:table-cell">{t.admin.userRegisteredAt}</th>
              <th className="py-3 px-3 text-right" />
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u: any) => (
              <tr key={u.id} className={`border-b last:border-0 transition-colors ${u.banned ? "bg-destructive/5" : "hover:bg-muted/20"}`}>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      : <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">{(u.name || "?").slice(0, 1).toUpperCase()}</div>
                    }
                    <div className="min-w-0">
                      <p className="font-medium truncate">{u.name || "—"}</p>
                      {u.username && <p className="text-xs text-muted-foreground truncate">@{u.username}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 text-sm">
                  <span className="break-all">{u.email || "—"}</span>
                </td>
                <td className="py-3 px-3 hidden sm:table-cell">
                  <div className="flex flex-wrap gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{u.role}</span>
                    {u.banned && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-destructive/10 text-destructive font-medium">
                        {lang === "ja" ? "停止中" : "Suspended"}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3 hidden md:table-cell text-muted-foreground text-xs whitespace-nowrap">{formatDate(u.created_at)}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1 justify-end">
                    {/* Quick suspend / reactivate */}
                    <Button
                      variant="outline"
                      size="sm"
                      className={`rounded-lg h-8 w-8 p-0 ${u.banned ? "text-green-600 hover:bg-green-50 hover:border-green-300" : "text-amber-600 hover:bg-amber-50 hover:border-amber-300"}`}
                      onClick={() => handleBanToggle(u)}
                      disabled={banLoading === u.id}
                      title={u.banned ? (lang === "ja" ? "停止解除" : "Reactivate") : (lang === "ja" ? "停止" : "Suspend")}
                    >
                      {u.banned ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                    </Button>
                    {/* Edit */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg h-8 w-8 p-0"
                      onClick={() => handleEdit(u)}
                      title={lang === "ja" ? "編集" : "Edit"}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    {/* Permanent delete */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:border-destructive/40"
                      onClick={() => handleDelete(u.id, u.name || u.email)}
                      title={lang === "ja" ? "完全削除" : "Delete permanently"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {search.trim()
            ? (lang === "ja" ? "検索結果がありません。" : "No users match your search.")
            : t.admin.noUsers}
        </p>
      )}
    </div>
  );
}

const PRODUCT_STORAGE_TEMP_VALUES = ["Room temperature", "Chilled", "Frozen"] as const;

/** Map legacy free-text / "Fresh" to canonical dropdown values for storage & temperature. */
function normalizeProductStorageOrTemp(raw: string | undefined | null): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (s === "Fresh") return "Room temperature";
  if ((PRODUCT_STORAGE_TEMP_VALUES as readonly string[]).includes(s)) return s;
  if (/冷凍/i.test(s) || /^frozen$/i.test(s)) return "Frozen";
  if (/冷蔵|chilled/i.test(s)) return "Chilled";
  if (/常温|^fresh$|room\s*temperature/i.test(s)) return "Room temperature";
  return "";
}

function ProductManager({ slug }: { slug: string }) {
  const { t, lang } = useTranslation();
  const formatProductListStorageTemp = (v: string | undefined) => {
    const raw = (v || "").trim();
    if (!raw) return "";
    const c = raw === "Fresh" ? "Room temperature" : raw;
    if (c === "Room temperature") return t.admin.productTemperatureRoom;
    if (c === "Chilled") return t.admin.productTemperatureChilled;
    if (c === "Frozen") return t.admin.productTemperatureFrozen;
    return raw;
  };
  const [products, setProducts] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [nameError, setNameError] = useState("");
  const nameFieldRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    name: "", name_en: "", image: "", moq: "",
    country_of_origin: "", country_of_origin_en: "", weight: "", quantity: "",
    size_w: "", size_d: "", size_h: "", size_unit: "cm",
    storage_condition: "", temperature: "", video_url: "",
    price: "", description: "",
  });

  useEffect(() => { fetchProducts(); }, [slug]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`/api/suppliers/${encodeURIComponent(slug)}/products`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    }
  };

  const clearForm = () => {
    setForm({ name: "", name_en: "", image: "", moq: "", country_of_origin: "", country_of_origin_en: "", weight: "", quantity: "", size_w: "", size_d: "", size_h: "", size_unit: "cm", storage_condition: "", temperature: "", video_url: "", price: "", description: "" });
    setEditingId(null);
    setNameError("");
  };

  const handleEdit = (p: any) => {
    setForm({
      name: p.name ?? "",
      name_en: p.name_en ?? "",
      image: p.image ?? "",
      moq: p.moq ?? "",
      country_of_origin: p.country_of_origin ?? "",
      country_of_origin_en: p.country_of_origin_en ?? "",
      weight: p.weight ?? "",
      quantity: p.quantity ?? "",
      size_w: p.size_w ?? "",
      size_d: p.size_d ?? "",
      size_h: p.size_h ?? "",
      size_unit: p.size_unit ?? "cm",
      storage_condition: normalizeProductStorageOrTemp(p.storage_condition),
      temperature: normalizeProductStorageOrTemp(p.temperature),
      video_url: p.video_url ?? "",
      price: p.price ?? "",
      description: p.description ?? "",
    });
    setEditingId(p.id);
  };

  const handleSubmit = async () => {
    if (!(form.name || "").trim()) {
      setNameError(t.common.requiredField);
      nameFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setNameError("");
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, ...form } : form;
      const res = await authFetch(`/api/suppliers/${encodeURIComponent(slug)}/products`, {
        method,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(lang === "ja"
          ? `保存に失敗しました。\n${err?.error ?? res.statusText}`
          : `Save failed.\n${err?.error ?? res.statusText}`);
        return;
      }
      clearForm();
      fetchProducts();
    } catch {
      alert(lang === "ja" ? "ネットワークエラーが発生しました。" : "Network error. Please try again.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.admin.deleteProductConfirm)) return;
    const res = await authFetch(`/api/suppliers/${encodeURIComponent(slug)}/products`, {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(lang === "ja"
        ? `削除に失敗しました。\n${err?.error ?? res.statusText}`
        : `Delete failed.\n${err?.error ?? res.statusText}`);
      return;
    }
    if (editingId === id) clearForm();
    fetchProducts();
  };

  /** Swap a product with its previous / next sibling so the admin can curate
   *  the order shown on the public site. */
  const handleMove = async (id: string, direction: "up" | "down") => {
    const res = await authFetch(`/api/suppliers/${encodeURIComponent(slug)}/products`, {
      method: "PATCH",
      body: JSON.stringify({ id, direction }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(lang === "ja"
        ? `並び替えに失敗しました。\n${err?.error ?? res.statusText}`
        : `Reorder failed.\n${err?.error ?? res.statusText}`);
      return;
    }
    fetchProducts();
  };

  return (
    <div className="mt-2 bg-muted/50 border p-3 sm:p-4 space-y-4 overflow-x-hidden">
      <h3 className="text-sm font-bold">{t.admin.productManagement}</h3>

      {/* Row 1: Name (JA) + Name (EN) */}
      <div ref={nameFieldRef} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InputField
          label={t.admin.productName}
          value={form.name}
          onChange={(v) => { setForm((p) => ({ ...p, name: v })); if (v.trim()) setNameError(""); }}
          required
          error={nameError}
        />
        <InputField label={t.admin.productNameEn} value={form.name_en} onChange={(v) => setForm((p) => ({ ...p, name_en: v }))} />
      </div>

      {/* Row 2: Image (full width on mobile) */}
      <ImageField label={t.admin.productImage} value={form.image} onChange={(v) => setForm((p) => ({ ...p, image: v }))} hint={t.admin.productImageHint ?? t.admin.imageHint} uploadLabel={t.admin.imageUploadOrUrl} folder="products" />

      {/* Row 2b: Video */}
      <div>
        <label className="text-sm font-medium block mb-1.5">
          <span className="inline-flex items-center gap-1.5"><Video className="h-3.5 w-3.5" />{t.admin.productVideo}</span>
        </label>
        {videoUploading ? (
          <div className="mb-1.5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>
                {uploadProgress === null || uploadProgress === 0
                  ? (lang === "ja" ? "準備中…" : "Preparing…")
                  : uploadProgress >= 100
                    ? (lang === "ja" ? "完了処理中…" : "Finalizing…")
                    : (lang === "ja" ? `アップロード中… ${uploadProgress}%` : `Uploading… ${uploadProgress}%`)}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-1.5 rounded-full transition-[width] duration-200"
                style={{ width: `${uploadProgress ?? 0}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center mb-1.5">
            <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors hover:bg-muted">
              <Video className="h-3.5 w-3.5" />
              {lang === "ja" ? "動画ファイルをアップロード" : "Upload video file"}
              <input
                type="file"
                accept="video/*,.mov,.qt,.3gp,.3g2,.mkv,.avi,.wmv,.m4v,.flv,.mpeg,.mpg,.ts,.m2ts,.mts,.ogv,.mxf"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setVideoUploading(true);
                  setUploadProgress(0);
                  try {
                    if (file.size > 200 * 1024 * 1024) {
                      alert(lang === "ja" ? "動画サイズは200MB以下にしてください。" : "Video size must be 200 MB or less.");
                      return;
                    }

                    // Step 1 — generate a JPEG thumbnail from the first video frame
                    // (runs in parallel with getting the signed URL; no blocking).
                    const [thumbDataUrl, signRes] = await Promise.all([
                      generateVideoThumbnail(file),
                      fetch("/api/upload/signed", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          fileName: file.name,
                          fileType: file.type,
                          fileSize: file.size,
                          folder: "videos",
                        }),
                      }),
                    ]);

                    if (!signRes.ok) {
                      const j = await signRes.json().catch(() => ({}));
                      throw new Error(
                        j?.error ||
                        (lang === "ja"
                          ? `署名付きURLの取得に失敗 (${signRes.status})`
                          : `Failed to prepare upload (${signRes.status}) — check that the videos bucket exists in Supabase and SUPABASE_SERVICE_ROLE_KEY is set in Vercel`)
                      );
                    }
                    const signed = await signRes.json();

                    // Step 2 — if we captured a thumbnail and the image field is empty,
                    // upload the thumbnail as a JPEG and use it as the product image.
                    if (thumbDataUrl) {
                      try {
                        const thumbBlob = await fetch(thumbDataUrl).then((r) => r.blob());
                        const thumbFile = new File([thumbBlob], "thumbnail.jpg", { type: "image/jpeg" });
                        const thumbSignRes = await fetch("/api/upload/signed", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            fileName: "thumbnail.jpg",
                            fileType: "image/jpeg",
                            fileSize: thumbFile.size,
                            folder: "products",
                          }),
                        });
                        if (thumbSignRes.ok) {
                          const thumbSigned = await thumbSignRes.json();
                          await new Promise<void>((res, rej) => {
                            const x = new XMLHttpRequest();
                            x.addEventListener("load", () => (x.status >= 200 && x.status < 300 ? res() : rej()));
                            x.addEventListener("error", rej);
                            x.open("PUT", thumbSigned.signedUrl);
                            x.setRequestHeader("Content-Type", "image/jpeg");
                            x.send(thumbFile);
                          });
                          // Set thumbnail as product image only if no image is set yet
                          setForm((prev) => ({ ...prev, image: prev.image || thumbSigned.publicUrl }));
                        }
                      } catch { /* thumbnail upload is best-effort; never block video upload */ }
                    }

                    // Step 3 — upload the video directly to Supabase via XHR with progress.
                    const contentType = inferVideoMimeType({
                      fileType: signed.contentType || file.type,
                      fileName: file.name,
                    });

                    await new Promise<void>((resolve, reject) => {
                      const xhr = new XMLHttpRequest();
                      xhr.upload.addEventListener("progress", (ev) => {
                        if (ev.lengthComputable) {
                          setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
                        }
                      });
                      xhr.addEventListener("load", () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                          resolve();
                        } else {
                          let msg = `HTTP ${xhr.status}`;
                          try {
                            const b = JSON.parse(xhr.responseText);
                            msg = b?.error || b?.message || msg;
                          } catch { /* ignore parse errors */ }
                          reject(new Error(msg));
                        }
                      });
                      xhr.addEventListener("error", () =>
                        reject(new Error(lang === "ja" ? "ネットワークエラー" : "Network error during upload"))
                      );
                      xhr.open("PUT", signed.signedUrl);
                      xhr.setRequestHeader("Content-Type", contentType);
                      xhr.send(file);
                    });

                    setForm((prev) => ({ ...prev, video_url: signed.publicUrl }));
                  } catch (err: any) {
                    alert(
                      (lang === "ja" ? "アップロードに失敗しました:\n" : "Upload failed:\n") +
                      (err?.message || String(err))
                    );
                  } finally {
                    setVideoUploading(false);
                    setUploadProgress(null);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            <span className="text-xs text-muted-foreground">{lang === "ja" ? "または" : "or"}</span>
          </div>
        )}
        <input
          type="url"
          value={form.video_url}
          onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
          placeholder={t.admin.productVideoUrlPlaceholder}
          className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">{t.admin.productVideoHint}</p>
        {form.video_url && (
          <div className="mt-2">
            <VideoPreview url={form.video_url} />
          </div>
        )}
      </div>

      {/* Row 3: Origin (JA/EN) + Weight + Quantity + MOQ + Price */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <InputField label={t.admin.productCountryOfOrigin} value={form.country_of_origin} onChange={(v) => setForm((p) => ({ ...p, country_of_origin: v }))} />
        <InputField label={t.admin.productCountryOfOriginEn} value={form.country_of_origin_en} onChange={(v) => setForm((p) => ({ ...p, country_of_origin_en: v }))} />
        <InputField label={t.admin.productWeight} value={form.weight} onChange={(v) => setForm((p) => ({ ...p, weight: v }))} />
        <InputField label={t.admin.productQuantity} value={form.quantity} onChange={(v) => setForm((p) => ({ ...p, quantity: v }))} />
        <InputField label={lang === "ja" ? "MOQ" : "MOQ"} value={form.moq} onChange={(v) => setForm((p) => ({ ...p, moq: v }))} placeholder={lang === "ja" ? "例: 1kg〜" : "e.g. 1kg"} />
        <InputField label={lang === "ja" ? "価格" : "Price"} value={form.price} onChange={(v) => setForm((p) => ({ ...p, price: v }))} placeholder={lang === "ja" ? "例: S$10.00 / kg" : "e.g. S$10.00 / kg"} />
      </div>

      {/* Row 3b: Dimensions W × D × H */}
      <div>
        <label className="text-sm font-medium block mb-1.5">{t.admin.productDimensions}</label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t.admin.productDimensionsW}</span>
            <input type="text" value={form.size_w} onChange={(e) => setForm((p) => ({ ...p, size_w: e.target.value }))} placeholder="—" className="w-20 h-10 px-2 rounded-lg border bg-background text-sm text-center" />
          </div>
          <span className="text-muted-foreground font-bold">×</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t.admin.productDimensionsD}</span>
            <input type="text" value={form.size_d} onChange={(e) => setForm((p) => ({ ...p, size_d: e.target.value }))} placeholder="—" className="w-20 h-10 px-2 rounded-lg border bg-background text-sm text-center" />
          </div>
          <span className="text-muted-foreground font-bold">×</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t.admin.productDimensionsH}</span>
            <input type="text" value={form.size_h} onChange={(e) => setForm((p) => ({ ...p, size_h: e.target.value }))} placeholder="—" className="w-20 h-10 px-2 rounded-lg border bg-background text-sm text-center" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t.admin.productDimensionsUnit}</span>
            <select value={form.size_unit} onChange={(e) => setForm((p) => ({ ...p, size_unit: e.target.value }))} className="h-10 px-2 rounded-lg border bg-background text-sm">
              <option value="cm">cm</option>
              <option value="mm">mm</option>
              <option value="m">m</option>
              <option value="inch">inch</option>
            </select>
          </div>
        </div>
      </div>

      {/* Row 4: Storage + Temperature (same canonical values: Room temperature / Chilled / Frozen) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{t.admin.productStorageCondition}</label>
          <select
            value={form.storage_condition}
            onChange={(e) => setForm((p) => ({ ...p, storage_condition: e.target.value }))}
            className="h-12 px-3 rounded-lg border bg-background text-sm"
          >
            <option value="">—</option>
            <option value="Room temperature">{t.admin.productTemperatureRoom}</option>
            <option value="Chilled">{t.admin.productTemperatureChilled}</option>
            <option value="Frozen">{t.admin.productTemperatureFrozen}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{t.admin.productTemperature}</label>
          <select
            value={form.temperature}
            onChange={(e) => setForm((p) => ({ ...p, temperature: e.target.value }))}
            className="h-12 px-3 rounded-lg border bg-background text-sm"
          >
            <option value="">—</option>
            <option value="Room temperature">{t.admin.productTemperatureRoom}</option>
            <option value="Chilled">{t.admin.productTemperatureChilled}</option>
            <option value="Frozen">{t.admin.productTemperatureFrozen}</option>
          </select>
        </div>
      </div>

      {/* Row 5: Description */}
      <div>
        <label className="text-sm font-medium block mb-1.5">
          {lang === "ja" ? "商品説明" : "Description"}
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          rows={3}
          placeholder={lang === "ja" ? "商品の簡単な説明を入力してください。" : "Enter a brief description of the product."}
          className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="rounded-xl gap-2 h-12 text-base" onClick={handleSubmit}>
          {editingId ? (lang === "ja" ? "更新" : "Update") : <><Plus className="h-4 w-4" /> {t.admin.addProduct}</>}
        </Button>
        {editingId && (
          <Button variant="outline" className="rounded-xl h-12" onClick={clearForm}>
            {lang === "ja" ? "キャンセル" : "Cancel"}
          </Button>
        )}
      </div>

      {!Array.isArray(products) || products.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.admin.noProducts}</p>
      ) : (
        <div className="space-y-2">
          {products.map((p: any) => (
            <div key={p.id} className="flex items-center gap-3 bg-card border p-3">
              <div className="relative flex-shrink-0">
                {(() => {
                  const rawImg = (p.image || "").trim();
                  const imgIsVideo = isVideoFileUrl(rawImg);
                  const videoSrc = imgIsVideo ? rawImg : (p.video_url || "").trim();
                  const imageSrc = imgIsVideo ? "" : rawImg;

                  if (imageSrc) {
                    return (
                      <img
                        src={imageSrc}
                        alt=""
                        className="w-12 h-12 rounded object-cover"
                        referrerPolicy="no-referrer"
                      />
                    );
                  }
                  if (videoSrc) {
                    return (
                      <div className="w-12 h-12 rounded bg-gray-900 relative overflow-hidden">
                        <video
                          src={videoSrc}
                          muted
                          playsInline
                          preload="metadata"
                          className="absolute inset-0 w-full h-full object-cover opacity-80"
                          onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.001; }}
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="h-3.5 w-3.5 text-white fill-white" />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                      <Image className="h-5 w-5 text-muted-foreground" />
                    </div>
                  );
                })()}
                {(p.video_url || isVideoFileUrl((p.image || "").trim())) && (
                  <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5" title={lang === "ja" ? "動画あり" : "Has video"}>
                    <Video className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{p.name}</p>
                {p.name_en && <p className="text-xs text-muted-foreground truncate">{p.name_en}</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {p.temperature && <span className="text-xs font-medium text-primary">{formatProductListStorageTemp(p.temperature)}</span>}
                  {(() => {
                    const origin = resolveCountryLabel({ ja: p.country_of_origin, en: p.country_of_origin_en, lang });
                    return origin ? <span className="text-xs text-muted-foreground">{origin}</span> : null;
                  })()}
                  {p.weight && <span className="text-xs text-muted-foreground">{p.weight}</span>}
                  {p.quantity && <span className="text-xs text-muted-foreground">{p.quantity}</span>}
                  {(p.size_w || p.size_d || p.size_h) && (
                    <span className="text-xs text-muted-foreground">
                      {[p.size_w, p.size_d, p.size_h].filter(Boolean).join(" × ")}{p.size_unit ? ` ${p.size_unit}` : ""}
                    </span>
                  )}
                  {p.storage_condition && <span className="text-xs text-muted-foreground">{formatProductListStorageTemp(p.storage_condition)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {(() => {
                  const idx = products.findIndex((row: any) => row.id === p.id);
                  const isFirst = idx <= 0;
                  const isLast = idx === products.length - 1;
                  return (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-10 w-10 p-0 disabled:opacity-40"
                        onClick={() => handleMove(p.id, "up")}
                        disabled={isFirst}
                        title={lang === "ja" ? "上へ移動" : "Move up"}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-10 w-10 p-0 disabled:opacity-40"
                        onClick={() => handleMove(p.id, "down")}
                        disabled={isLast}
                        title={lang === "ja" ? "下へ移動" : "Move down"}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </>
                  );
                })()}
                <Button variant="outline" size="sm" className="rounded-lg h-10 w-10 p-0" onClick={() => handleEdit(p)} title={lang === "ja" ? "編集" : "Edit"}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg text-destructive flex-shrink-0 h-10 w-10 p-0" onClick={() => handleDelete(p.id)} title={lang === "ja" ? "削除" : "Delete"}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalQueue({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { t } = useTranslation();

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    const res = await fetch("/api/marketplace?status=pending&noFallback=true");
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setItems(list);
    onCountChange?.(list.length);
  };

  const handleApprove = async (slug: string) => {
    await fetch(`/api/marketplace/${slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "approved" }) });
    fetchItems();
  };

  const handleReject = async (slug: string) => {
    await fetch(`/api/marketplace/${slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "rejected", reject_reason: rejectReason }) });
    setRejectId(null);
    setRejectReason("");
    fetchItems();
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">{t.admin.approvalQueueTitle}</h2>
      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p>{t.admin.approvalEmpty}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item: any) => (
            <div key={item.id} className="bg-card border p-5">
              <div className="flex gap-4">
                <img src={item.image} alt="" className="w-20 h-20 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm">{item.title}</h3>
                  <p className="text-lg font-black text-primary">S${Number(item.price).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.seller_name} · {item.area} · {item.condition}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" className="rounded-xl gap-1" onClick={() => handleApprove(item.slug)}>
                    <CheckCircle className="h-3 w-3" /> {t.admin.approvalApprove}
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl gap-1 text-destructive" onClick={() => setRejectId(item.id)}>
                    <XCircle className="h-3 w-3" /> {t.admin.approvalReject}
                  </Button>
                </div>
              </div>
              {rejectId === item.id && (
                <div className="mt-4 space-y-1.5">
                  <p className="text-xs text-muted-foreground">{t.admin.approvalRejectLabel}</p>
                  <div className="flex gap-2">
                    <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t.admin.approvalRejectPlaceholder} className="flex-1 h-10 px-3 rounded-lg border bg-background text-sm" />
                    <Button size="sm" className="rounded-xl" onClick={() => handleReject(item.slug)}>{t.admin.approvalSend}</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MarketplaceManager() {
  const { t, lang } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const EMPTY_FORM = {
    title: "", title_en: "",
    slug: "", price: "", image: "",
    area: "", area_en: "",
    condition: "", condition_en: "",
    years_used: "0",
    description: "", description_en: "",
    category: "",
    seller_name: "", seller_whatsapp: "",
    delivery: "", delivery_en: "",
    status: "approved" as "approved" | "pending" | "rejected",
  };
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    const res = await fetch("/api/marketplace?all=true");
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
  };

  const resetForm = () => { setForm(EMPTY_FORM); setEditSlug(null); };

  const handleEdit = (item: any) => {
    setForm({
      title: item.title ?? "",
      title_en: item.title_en ?? "",
      slug: item.slug ?? "",
      price: String(item.price ?? ""),
      image: item.image ?? "",
      area: item.area ?? "",
      area_en: item.area_en ?? "",
      condition: item.condition ?? "",
      condition_en: item.condition_en ?? "",
      years_used: String(item.years_used ?? 0),
      description: item.description ?? "",
      description_en: item.description_en ?? "",
      category: item.category ?? "",
      seller_name: item.seller_name ?? "",
      seller_whatsapp: item.seller_whatsapp ?? "",
      delivery: item.delivery ?? "",
      delivery_en: item.delivery_en ?? "",
      status: item.status ?? "pending",
    });
    setEditSlug(item.slug);
    setShowForm(true);
  };

  const handleSave = async () => {
    const titleTrimmed = (form.title || "").trim();
    const slugTrimmed = (form.slug || "").trim();
    const priceNum = Number(form.price);
    if (!titleTrimmed) {
      alert(lang === "ja" ? "タイトル（日本語）は必須です。" : "Title (JA) is required.");
      return;
    }
    if (!slugTrimmed) {
      alert(lang === "ja" ? "スラッグは必須です。" : "Slug is required.");
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      alert(lang === "ja" ? "価格を正しく入力してください。" : "Please enter a valid price.");
      return;
    }
    const body = { ...form, title: titleTrimmed, slug: slugTrimmed, price: priceNum, years_used: Number(form.years_used) };
    if (editSlug) {
      await fetch(`/api/marketplace/${editSlug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setShowForm(false);
    resetForm();
    fetchItems();
  };

  const handleDelete = async (slug: string) => {
    if (!confirm(lang === "ja" ? `「${slug}」を削除しますか？` : `Delete "${slug}"?`)) return;
    await authFetch(`/api/marketplace/${encodeURIComponent(slug)}`, { method: "DELETE" });
    fetchItems();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "marketplace");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    if (json.url) setForm((p) => ({ ...p, image: json.url }));
    setImageUploading(false);
  };

  const label = (en: string, ja: string) => lang === "ja" ? ja : en;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">{t.admin.tabMarketplace}</h2>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> {showForm ? t.admin.close : t.admin.add}
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InputField label={label("Title (JA)", "タイトル（日本語）")} value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} required />
            <InputField label={label("Title (EN)", "タイトル（英語）")} value={form.title_en} onChange={(v) => setForm((p) => ({ ...p, title_en: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label={label("Slug (URL key)", "スラッグ（URLキー）")} value={form.slug} onChange={(v) => setForm((p) => ({ ...p, slug: v }))} required placeholder={t.admin.slugRequiredPlaceholder} />
            <InputField label={label("Price (SGD)", "価格（SGD）")} value={form.price} onChange={(v) => setForm((p) => ({ ...p, price: v }))} type="number" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label={label("Area (JA)", "エリア（日本語）")} value={form.area} onChange={(v) => setForm((p) => ({ ...p, area: v }))} />
            <InputField label={label("Area (EN)", "エリア（英語）")} value={form.area_en} onChange={(v) => setForm((p) => ({ ...p, area_en: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label={label("Condition (JA)", "状態（日本語）")} value={form.condition} onChange={(v) => setForm((p) => ({ ...p, condition: v }))} />
            <InputField label={label("Condition (EN)", "状態（英語）")} value={form.condition_en} onChange={(v) => setForm((p) => ({ ...p, condition_en: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label={label("Delivery (JA)", "配送方法（日本語）")} value={form.delivery} onChange={(v) => setForm((p) => ({ ...p, delivery: v }))} />
            <InputField label={label("Delivery (EN)", "配送方法（英語）")} value={form.delivery_en} onChange={(v) => setForm((p) => ({ ...p, delivery_en: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label={label("Years Used", "使用年数")} value={form.years_used} onChange={(v) => setForm((p) => ({ ...p, years_used: v }))} type="number" />
            <InputField label={label("Category", "カテゴリー")} value={form.category} onChange={(v) => setForm((p) => ({ ...p, category: v }))} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{label("Description (JA)", "説明（日本語）")}</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="w-full h-20 p-3 rounded-lg border bg-background text-sm resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">
              {label("Description (EN)", "説明（英語）")}
              <span className="ml-2 text-[10px] font-normal text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded-full">
                {label("English only", "英語のみ入力")}
              </span>
            </label>
            <textarea
              value={form.description_en}
              onChange={(e) => {
                // Strip any non-Latin characters (CJK, Arabic, etc.) in real time
                const filtered = e.target.value.replace(/[\u3000-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF\u0400-\u04FF\u0600-\u06FF]/g, "");
                setForm((p) => ({ ...p, description_en: filtered }));
              }}
              placeholder="Describe the item in English…"
              className="w-full h-20 p-3 rounded-lg border bg-background text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label={label("Seller Name", "出品者名")} value={form.seller_name} onChange={(v) => setForm((p) => ({ ...p, seller_name: v }))} />
            <InputField label="WhatsApp" value={form.seller_whatsapp} onChange={(v) => setForm((p) => ({ ...p, seller_whatsapp: v }))} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{label("Image", "画像")}</label>
            <div className="flex gap-3 items-center">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm" />
              {imageUploading && <span className="text-xs text-muted-foreground">{label("Uploading…", "アップロード中…")}</span>}
            </div>
            {form.image && <img src={form.image} alt="" className="mt-2 h-24 rounded-lg object-cover" />}
            <InputField label={label("or Image URL", "または画像URL")} value={form.image} onChange={(v) => setForm((p) => ({ ...p, image: v }))} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{label("Status", "ステータス")}</label>
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as any }))} className="h-10 px-3 rounded-lg border bg-background text-sm w-full">
              <option value="approved">{label("Approved", "承認済み")}</option>
              <option value="pending">{label("Pending", "審査中")}</option>
              <option value="rejected">{label("Rejected", "却下")}</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} className="rounded-xl gap-2"><Save className="h-4 w-4" />{t.admin.save}</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }} className="rounded-xl">{t.admin.close}</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>{label("No items found.", "アイテムがありません。")}</p>
          </div>
        )}
        {items.map((item: any) => (
          <div key={item.id ?? item.slug} className="bg-card border p-4 flex gap-4 items-center">
            {item.image && <img src={item.image} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{lang === "en" && item.title_en ? item.title_en : item.title}</p>
              <p className="text-xs text-muted-foreground">S${Number(item.price).toLocaleString()} · {lang === "en" && item.area_en ? item.area_en : item.area} · {lang === "en" && item.condition_en ? item.condition_en : item.condition}</p>
              <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${item.status === "approved" ? "bg-green-100 text-green-700" : item.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                {item.status === "approved" ? label("Approved", "承認済み") : item.status === "rejected" ? label("Rejected", "却下") : label("Pending", "審査中")}
              </span>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={() => handleEdit(item)}>
                <Edit2 className="h-3 w-3" /> {t.admin.edit}
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl gap-1 text-destructive" onClick={() => handleDelete(item.slug)}>
                <Trash2 className="h-3 w-3" /> {t.admin.delete}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsManager() {
  const [articles, setArticles] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [form, setForm] = useState({
    title: "", title_ja: "", slug: "", excerpt: "", excerpt_ja: "", content: "", content_ja: "",
    image: "", category: "industry", author: "", published: true, published_at: "",
  });

  useEffect(() => { fetchArticles(); }, []);

  const fetchArticles = async () => {
    const res = await authFetch("/api/news?all=true");
    if (!res.ok) {
      setArticles([]);
      return;
    }
    setArticles(await res.json());
  };

  const resetForm = () => {
    setForm({ title: "", title_ja: "", slug: "", excerpt: "", excerpt_ja: "", content: "", content_ja: "", image: "", category: "industry", author: "", published: true, published_at: "" });
    setEditSlug(null);
  };

  const handleSave = async () => {
    const titleTrimmed = (form.title || "").trim();
    const titleJaTrimmed = (form.title_ja || "").trim();
    const slugTrimmed = (form.slug || "").trim();
    if (!titleTrimmed && !titleJaTrimmed) {
      alert(lang === "ja" ? "タイトル（英語または日本語）のいずれかを入力してください。" : "Please enter either Title (EN) or Title (JA).");
      return;
    }
    if (!slugTrimmed) {
      alert(lang === "ja" ? "スラッグは必須です。" : "Slug is required.");
      return;
    }
    const body: Record<string, unknown> = { ...form, title: titleTrimmed || form.title, title_ja: titleJaTrimmed || form.title_ja, slug: slugTrimmed };
    body.published_at = form.published_at ? new Date(form.published_at).toISOString() : null;
    const res = editSlug
      ? await authFetch(`/api/news/${editSlug}`, { method: "PUT", body: JSON.stringify(body) })
      : await authFetch("/api/news", { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as any));
      alert((lang === "ja" ? "記事の保存に失敗しました: " : "Failed to save article: ") + (err?.error || `HTTP ${res.status}`));
      return;
    }
    setShowForm(false);
    resetForm();
    fetchArticles();
  };

  const handleEdit = (a: any) => {
    const pub = a.published_at ? new Date(a.published_at).toISOString().slice(0, 16) : "";
    setForm({
      title: a.title, title_ja: a.title_ja, slug: a.slug, excerpt: a.excerpt, excerpt_ja: a.excerpt_ja,
      content: a.content, content_ja: a.content_ja, image: a.image, category: a.category, author: a.author, published: a.published,
      published_at: pub,
    });
    setEditSlug(a.slug);
    setShowForm(true);
  };

  const handleDelete = async (slug: string) => {
    if (!confirm(t.admin.deleteConfirm)) return;
    await authFetch(`/api/news/${slug}`, { method: "DELETE" });
    fetchArticles();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("folder", "news");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setForm((p) => ({ ...p, image: data.url }));
      else throw new Error(data.error || "Upload failed");
    } catch (err) {
      console.error(err);
    } finally {
      setImageUploading(false);
      e.target.value = "";
    }
  };

  const { t, lang } = useTranslation();
  const categoryOptions = ["industry", "regulation", "trend", "event"];
  const categoryLabels: Record<string, { en: string; ja: string }> = {
    industry: { en: "Industry", ja: "業界ニュース" },
    regulation: { en: "Regulation", ja: "規制・法律" },
    trend: { en: "Trend", ja: "トレンド" },
    event: { en: "Event", ja: "イベント" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{t.admin.tabNews}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{articles.length} {lang === "ja" ? "件" : "articles"}</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> {showForm ? t.admin.close : t.admin.add}
        </Button>
      </div>
      {showForm && (
        <div className="bg-card border p-6 mb-6 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">
            {editSlug ? (lang === "ja" ? "記事を編集" : "Edit Article") : (lang === "ja" ? "新規記事を追加" : "Add New Article")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label={lang === "ja" ? "タイトル（英語）" : "Title (English)"} value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} required />
            <InputField label={lang === "ja" ? "タイトル（日本語）" : "Title (Japanese)"} value={form.title_ja} onChange={(v) => setForm((p) => ({ ...p, title_ja: v }))} required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label={lang === "ja" ? "抜粋（英語）" : "Excerpt (English)"} value={form.excerpt} onChange={(v) => setForm((p) => ({ ...p, excerpt: v }))} />
            <InputField label={lang === "ja" ? "抜粋（日本語）" : "Excerpt (Japanese)"} value={form.excerpt_ja} onChange={(v) => setForm((p) => ({ ...p, excerpt_ja: v }))} />
          </div>
          <InputField label={lang === "ja" ? "スラッグ（URL）" : "Slug (URL)"} value={form.slug} onChange={(v) => setForm((p) => ({ ...p, slug: v }))} required placeholder={t.admin.slugRequiredPlaceholder} />
          <div>
            <label className="text-sm font-medium block mb-1.5">{lang === "ja" ? "画像" : "Image"}</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                id="news-image-upload"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setImageUploading(true);
                  try {
                    const fd = new FormData();
                    fd.set("file", f);
                    fd.set("folder", "news");
                    const res = await fetch("/api/upload", { method: "POST", body: fd });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Upload failed");
                    setForm((p) => ({ ...p, image: data.url }));
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setImageUploading(false);
                    e.target.value = "";
                  }
                }}
              />
              <label htmlFor="news-image-upload">
                <Button type="button" variant="outline" size="sm" className="rounded-xl gap-2 cursor-pointer" disabled={imageUploading} asChild>
                  <span>
                    <Image className="h-4 w-4" />
                    {imageUploading ? (lang === "ja" ? "アップロード中..." : "Uploading...") : (lang === "ja" ? "画像をアップロード" : "Upload image")}
                  </span>
                </Button>
              </label>
              <span className="text-xs text-muted-foreground">{(lang === "ja" ? "または" : "or")}</span>
            </div>
            <InputField label={lang === "ja" ? "画像URL" : "Image URL"} value={form.image} onChange={(v) => setForm((p) => ({ ...p, image: v }))} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">{lang === "ja" ? "カテゴリー" : "Category"}</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full h-11 px-3 rounded-lg border bg-background text-sm"
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{lang === "ja" ? categoryLabels[c].ja : categoryLabels[c].en}</option>
                ))}
              </select>
            </div>
            <InputField label={lang === "ja" ? "著者" : "Author"} value={form.author} onChange={(v) => setForm((p) => ({ ...p, author: v }))} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{lang === "ja" ? "表示日付（管理者設定）" : "Display Date (admin override)"}</label>
            <input
              type="datetime-local"
              value={form.published_at}
              onChange={(e) => setForm((p) => ({ ...p, published_at: e.target.value }))}
              className="w-full h-11 px-3 rounded-lg border bg-background text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {lang === "ja" ? "空欄の場合は作成日時を表示します。" : "Leave empty to use creation date."}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{lang === "ja" ? "本文（英語）" : "Content (English)"}</label>
            <textarea value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} rows={4} className="w-full p-3 rounded-lg border bg-background text-sm resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{lang === "ja" ? "本文（日本語）" : "Content (Japanese)"}</label>
            <textarea value={form.content_ja} onChange={(e) => setForm((p) => ({ ...p, content_ja: e.target.value }))} rows={4} className="w-full p-3 rounded-lg border bg-background text-sm resize-none" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.published} onChange={() => setForm((p) => ({ ...p, published: !p.published }))} className="accent-primary" />
            {lang === "ja" ? "公開する" : "Publish"}
          </label>
          <div className="flex gap-3">
            <Button onClick={handleSave} className="rounded-xl gap-2">
              <Save className="h-4 w-4" /> {editSlug ? t.admin.update : t.admin.create}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }} className="rounded-xl">
              {t.admin.close}
            </Button>
          </div>
        </div>
      )}
      {articles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{lang === "ja" ? "記事がまだありません" : "No articles yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a: any) => (
            <div key={a.id} className="bg-card border p-4 flex items-center gap-4">
              {a.image && (
                <img src={a.image} alt="" className="w-16 h-12 rounded-lg object-cover flex-shrink-0 hidden sm:block" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{lang === "ja" ? (a.title_ja || a.title) : (a.title || a.title_ja)}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${a.published ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {a.published ? (lang === "ja" ? "公開中" : "Published") : (lang === "ja" ? "下書き" : "Draft")}
                  </span>
                  <span className="text-[10px] tag-badge">{lang === "ja" ? (categoryLabels[a.category]?.ja ?? a.category) : (categoryLabels[a.category]?.en ?? a.category)}</span>
                  <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-SG")}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => handleEdit(a)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl text-destructive hover:bg-destructive/10" onClick={() => handleDelete(a.slug)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryManager() {
  const { t, lang } = useTranslation();
  const [categories, setCategories] = useState<any[]>([]);
  const [newCat, setNewCat] = useState({ type: "supplier", value: "", label: "", label_ja: "", sort_order: 0, parent_group: "" });
  const [addError, setAddError] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<{ id: string; label: string; label_ja: string; parent_group?: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Group management state
  const [newGroup, setNewGroup] = useState({ value: "", label: "", label_ja: "", sort_order: 0 });
  const [addGroupError, setAddGroupError] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<{ id: string; label: string; label_ja: string; sort_order: number } | null>(null);
  const [editGroupSaving, setEditGroupSaving] = useState(false);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    const res = await fetch("/api/categories");
    setCategories(await res.json());
  };

  const groupRows = categories.filter((c: any) => c.type === "supplier-group").sort((a: any, b: any) => a.sort_order - b.sort_order);
  const supplierRows = categories.filter((c: any) => c.type === "supplier").sort((a: any, b: any) => a.sort_order - b.sort_order);

  // --- Category CRUD ---
  const handleAdd = async () => {
    const valueTrimmed = (newCat.value || "").trim();
    const labelTrimmed = (newCat.label || "").trim();
    setAddError(null);
    if (!valueTrimmed) {
      setAddError(lang === "ja" ? "値（ENキー）は必須です。" : "Value (EN key) is required.");
      return;
    }
    if (!labelTrimmed) {
      setAddError(lang === "ja" ? "ラベル（EN）は必須です。" : "Label (EN) is required.");
      return;
    }
    if (newCat.type === "supplier" && !newCat.parent_group) {
      setAddError(lang === "ja" ? "カテゴリーグループを選択してください。" : "Please select a category group.");
      return;
    }
    const res = await authFetch("/api/categories", {
      method: "POST",
      body: JSON.stringify({ ...newCat, value: valueTrimmed, label: labelTrimmed }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setAddError(err?.error ?? (lang === "ja" ? "追加に失敗しました。データベース設定をご確認ください。" : "Failed to add category. Please check your database configuration."));
      return;
    }
    setNewCat({ type: "supplier", value: "", label: "", label_ja: "", sort_order: 0, parent_group: "" });
    fetchCategories();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.admin.deleteConfirm)) return;
    try {
      const res = await authFetch(`/api/categories?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error ?? (lang === "ja" ? "削除に失敗しました。" : "Delete failed."));
        return;
      }
    } catch {
      alert(lang === "ja" ? "削除に失敗しました。" : "Delete failed.");
      return;
    }
    fetchCategories();
  };

  const handleEditSave = async () => {
    if (!editingCat) return;
    setEditSaving(true);
    const body: Record<string, unknown> = { label: editingCat.label, label_ja: editingCat.label_ja };
    if (typeof editingCat.parent_group === "string") body.parent_group = editingCat.parent_group;
    const res = await authFetch(`/api/categories?id=${editingCat.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setEditSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error ?? (lang === "ja" ? "更新に失敗しました。" : "Update failed."));
      return;
    }
    setEditingCat(null);
    fetchCategories();
  };

  // --- Group CRUD ---
  const handleAddGroup = async () => {
    const valueTrimmed = (newGroup.value || "").trim();
    const labelTrimmed = (newGroup.label || "").trim();
    setAddGroupError(null);
    if (!valueTrimmed) {
      setAddGroupError(lang === "ja" ? "値（ENキー）は必須です。" : "Value (EN key) is required.");
      return;
    }
    if (!labelTrimmed) {
      setAddGroupError(lang === "ja" ? "ラベル（EN）は必須です。" : "Label (EN) is required.");
      return;
    }
    const res = await authFetch("/api/categories", {
      method: "POST",
      body: JSON.stringify({ type: "supplier-group", value: valueTrimmed, label: labelTrimmed, label_ja: newGroup.label_ja.trim(), sort_order: newGroup.sort_order }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setAddGroupError(err?.error ?? (lang === "ja" ? "追加に失敗しました。" : "Failed to add group."));
      return;
    }
    setNewGroup({ value: "", label: "", label_ja: "", sort_order: 0 });
    fetchCategories();
  };

  const handleEditGroupSave = async () => {
    if (!editingGroup) return;
    setEditGroupSaving(true);
    const res = await authFetch(`/api/categories?id=${editingGroup.id}`, {
      method: "PATCH",
      body: JSON.stringify({ label: editingGroup.label, label_ja: editingGroup.label_ja, sort_order: editingGroup.sort_order }),
    });
    setEditGroupSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error ?? (lang === "ja" ? "更新に失敗しました。" : "Update failed."));
      return;
    }
    setEditingGroup(null);
    fetchCategories();
  };

  const typeLabels: Record<string, string> = {
    supplier: t.admin.typeSupplier,
    marketplace: t.admin.typeMarketplace,
    news: t.admin.typeNews,
    tag: lang === "ja" ? "タグ（サプライヤー用）" : "Tags (for suppliers)",
  };

  const CategoryBadge = ({ c }: { c: any }) => {
    const { enLabel, jaLabel } = resolveCategoryDisplayLabels(c);
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm border border-border/50">
        <span className="font-medium">{enLabel} <span className="text-[10px] font-normal text-muted-foreground">EN</span></span>
        {jaLabel
          ? <span className="text-muted-foreground text-xs">/ {jaLabel} <span className="text-[10px]">JA</span></span>
          : <span className="text-[10px] text-amber-500 font-medium">JA未設定</span>
        }
        <span className="text-xs text-muted-foreground">({c.value})</span>
        <button
          onClick={() => setEditingCat({ id: c.id, label: enLabel, label_ja: jaLabel, parent_group: c.parent_group || "" })}
          className="text-muted-foreground hover:text-primary ml-0.5"
          title={lang === "ja" ? "編集" : "Edit"}
        >
          <Edit2 className="h-3 w-3" />
        </button>
        <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">{t.admin.categoryManagement}</h2>

      {/* ── Supplier Category Groups ── */}
      <div className="bg-card border p-5 mb-6 rounded-xl">
        <h3 className="text-sm font-bold mb-4">{lang === "ja" ? "サプライヤー カテゴリーグループ" : "Supplier Category Groups"}</h3>

        {/* Existing groups with their children */}
        <div className="space-y-4 mb-5">
          {groupRows.map((g: any) => {
            const children = supplierRows.filter((c: any) => (c.parent_group || "") === g.value);
            return (
              <div key={g.id} className="border rounded-lg p-3 bg-background">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-sm">{g.label}</span>
                  {g.label_ja && <span className="text-xs text-muted-foreground">/ {g.label_ja}</span>}
                  <span className="text-xs text-muted-foreground">({g.value})</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {lang === "ja" ? `順序: ${g.sort_order}` : `Order: ${g.sort_order}`}
                  </span>
                  <button
                    onClick={() => setEditingGroup({ id: g.id, label: g.label, label_ja: g.label_ja || "", sort_order: g.sort_order })}
                    className="text-muted-foreground hover:text-primary ml-auto"
                    title={lang === "ja" ? "編集" : "Edit"}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (children.length > 0) {
                        alert(lang === "ja"
                          ? "このグループには子カテゴリーがあるため削除できません。先に子カテゴリーを移動または削除してください。"
                          : "Cannot delete this group because it has child categories. Move or delete them first.");
                        return;
                      }
                      handleDelete(g.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {children.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pl-2">
                    {children.map((c: any) => <CategoryBadge key={c.id} c={c} />)}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pl-2 italic">
                    {lang === "ja" ? "カテゴリーなし" : "No categories"}
                  </p>
                )}
              </div>
            );
          })}
          {/* Ungrouped supplier categories */}
          {(() => {
            const ungrouped = supplierRows.filter((c: any) => !c.parent_group || !groupRows.some((g: any) => g.value === c.parent_group));
            if (ungrouped.length === 0) return null;
            return (
              <div className="border rounded-lg p-3 bg-background border-amber-300">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-sm text-amber-600">{lang === "ja" ? "未分類" : "Ungrouped"}</span>
                </div>
                <div className="flex flex-wrap gap-2 pl-2">
                  {ungrouped.map((c: any) => <CategoryBadge key={c.id} c={c} />)}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Add new group form */}
        <div className="border-t pt-4">
          <h4 className="text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">
            {lang === "ja" ? "新しいグループを追加" : "Add New Group"}
          </h4>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-medium block mb-1">{t.admin.valueLabel} (EN key) <span className="text-destructive">*</span></label>
              <input value={newGroup.value} onChange={(e) => setNewGroup((p) => ({ ...p, value: e.target.value }))} className="h-10 px-3 rounded-lg border bg-background text-sm w-36" placeholder={lang === "ja" ? "例: tech-pos" : "e.g. tech-pos"} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">{t.admin.labelLabel} (EN) <span className="text-destructive">*</span></label>
              <input value={newGroup.label} onChange={(e) => setNewGroup((p) => ({ ...p, label: e.target.value }))} className="h-10 px-3 rounded-lg border bg-background text-sm w-40" placeholder={lang === "ja" ? "例: Tech & POS" : "e.g. Tech & POS"} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">{lang === "ja" ? "ラベル（JA）" : "Label (JA)"}</label>
              <input value={newGroup.label_ja} onChange={(e) => setNewGroup((p) => ({ ...p, label_ja: e.target.value }))} className="h-10 px-3 rounded-lg border bg-background text-sm w-36" placeholder="例: テクノロジー" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">{lang === "ja" ? "表示順" : "Order"}</label>
              <input type="number" value={newGroup.sort_order} onChange={(e) => setNewGroup((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))} className="h-10 px-3 rounded-lg border bg-background text-sm w-20" />
            </div>
            <Button onClick={handleAddGroup} size="sm" className="rounded-xl"><Plus className="h-4 w-4" /></Button>
          </div>
          {addGroupError && <p className="text-sm text-destructive mt-2">{addGroupError}</p>}
        </div>
      </div>

      {/* ── Add new category form ── */}
      <div className="bg-card border p-5 mb-6 rounded-xl">
        <h3 className="text-sm font-bold mb-3">{lang === "ja" ? "新規カテゴリー追加" : "Add New Category"}</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium block mb-1">{t.admin.typeLabel}</label>
            <select value={newCat.type} onChange={(e) => setNewCat((p) => ({ ...p, type: e.target.value, parent_group: "" }))} className="h-10 px-3 rounded-lg border bg-background text-sm">
              <option value="supplier">{t.admin.typeSupplier}</option>
              <option value="marketplace">{t.admin.typeMarketplace}</option>
              <option value="news">{t.admin.typeNews}</option>
              <option value="tag">{lang === "ja" ? "タグ" : "Tag"}</option>
            </select>
          </div>
          {newCat.type === "supplier" && (
            <div>
              <label className="text-xs font-medium block mb-1">{lang === "ja" ? "グループ" : "Group"} <span className="text-destructive">*</span></label>
              <select value={newCat.parent_group} onChange={(e) => setNewCat((p) => ({ ...p, parent_group: e.target.value }))} className="h-10 px-3 rounded-lg border bg-background text-sm">
                <option value="">— {lang === "ja" ? "選択してください" : "Select"} —</option>
                {groupRows.map((g: any) => (
                  <option key={g.value} value={g.value}>{lang === "ja" ? (g.label_ja || g.label) : g.label}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium block mb-1">{t.admin.valueLabel} (EN key) <span className="text-destructive">*</span></label>
            <input value={newCat.value} onChange={(e) => setNewCat((p) => ({ ...p, value: e.target.value }))} className="h-10 px-3 rounded-lg border bg-background text-sm w-32" placeholder={lang === "ja" ? "例: pos_system" : "e.g. pos_system"} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">{t.admin.labelLabel} (EN) <span className="text-destructive">*</span></label>
            <input value={newCat.label} onChange={(e) => setNewCat((p) => ({ ...p, label: e.target.value }))} className="h-10 px-3 rounded-lg border bg-background text-sm w-36" placeholder={lang === "ja" ? "例: POS System" : "e.g. POS System"} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">{lang === "ja" ? "ラベル（日本語）" : "Label (JA)"}</label>
            <input value={newCat.label_ja} onChange={(e) => setNewCat((p) => ({ ...p, label_ja: e.target.value }))} className="h-10 px-3 rounded-lg border bg-background text-sm w-36" placeholder="例: POSシステム" />
          </div>
          <Button onClick={handleAdd} size="sm" className="rounded-xl"><Plus className="h-4 w-4" /></Button>
        </div>
        {addError && <p className="text-sm text-destructive mt-2">{addError}</p>}
        <p className="text-xs text-muted-foreground mt-2">
          {lang === "ja"
            ? "※ ラベル（JA）を入力することで、日本語表示時にカテゴリー名が切り替わります。"
            : "※ Fill in Label (JA) so the category name switches when viewing in Japanese."}
        </p>
      </div>

      {/* Edit category label modal */}
      {editingCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setEditingCat(null)} />
          <div className="relative bg-background rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-bold text-base">{lang === "ja" ? "カテゴリーラベルを編集" : "Edit Category Labels"}</h3>
            <div>
              <label className="text-xs font-medium block mb-1">Label (EN) <span className="text-destructive">*</span></label>
              <input
                value={editingCat.label}
                onChange={(e) => setEditingCat((p) => p ? { ...p, label: e.target.value } : p)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                placeholder="e.g. POS System"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Label (JA) — {lang === "ja" ? "日本語ラベル" : "Japanese label"}</label>
              <input
                value={editingCat.label_ja}
                onChange={(e) => setEditingCat((p) => p ? { ...p, label_ja: e.target.value } : p)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                placeholder="例: POSシステム"
              />
            </div>
            {typeof editingCat.parent_group === "string" && (
              <div>
                <label className="text-xs font-medium block mb-1">{lang === "ja" ? "所属グループ" : "Parent Group"}</label>
                <select
                  value={editingCat.parent_group}
                  onChange={(e) => setEditingCat((p) => p ? { ...p, parent_group: e.target.value } : p)}
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                >
                  <option value="">— {lang === "ja" ? "未分類" : "Ungrouped"} —</option>
                  {groupRows.map((g: any) => (
                    <option key={g.value} value={g.value}>{lang === "ja" ? (g.label_ja || g.label) : g.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button onClick={handleEditSave} disabled={editSaving} className="rounded-xl flex-1">
                <Save className="h-4 w-4 mr-1.5" />{editSaving ? t.common.saving : (lang === "ja" ? "保存" : "Save")}
              </Button>
              <Button variant="outline" onClick={() => setEditingCat(null)} className="rounded-xl">{lang === "ja" ? "キャンセル" : "Cancel"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit group modal */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setEditingGroup(null)} />
          <div className="relative bg-background rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-bold text-base">{lang === "ja" ? "グループを編集" : "Edit Group"}</h3>
            <div>
              <label className="text-xs font-medium block mb-1">Label (EN) <span className="text-destructive">*</span></label>
              <input
                value={editingGroup.label}
                onChange={(e) => setEditingGroup((p) => p ? { ...p, label: e.target.value } : p)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                placeholder="e.g. Tech & POS"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Label (JA)</label>
              <input
                value={editingGroup.label_ja}
                onChange={(e) => setEditingGroup((p) => p ? { ...p, label_ja: e.target.value } : p)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                placeholder="例: テクノロジー"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">{lang === "ja" ? "表示順" : "Display Order"}</label>
              <input
                type="number"
                value={editingGroup.sort_order}
                onChange={(e) => setEditingGroup((p) => p ? { ...p, sort_order: Number(e.target.value) || 0 } : p)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleEditGroupSave} disabled={editGroupSaving} className="rounded-xl flex-1">
                <Save className="h-4 w-4 mr-1.5" />{editGroupSaving ? t.common.saving : (lang === "ja" ? "保存" : "Save")}
              </Button>
              <Button variant="outline" onClick={() => setEditingGroup(null)} className="rounded-xl">{lang === "ja" ? "キャンセル" : "Cancel"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Other category types (tag, marketplace, news) ── */}
      {["tag", "marketplace", "news"].map((type) => (
        <div key={type} className="mb-6">
          <h3 className="font-bold text-sm mb-3">{typeLabels[type] ?? type}</h3>
          <div className="flex flex-wrap gap-2">
            {categories.filter((c: any) => c.type === type).map((c: any) => (
              <CategoryBadge key={c.id} c={c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export type AboutSiteContent = {
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

const DEFAULT_ABOUT: AboutSiteContent = {};

function AboutSiteManager() {
  const { t, lang } = useTranslation();
  const [form, setForm] = useState<AboutSiteContent>(DEFAULT_ABOUT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings?key=about_site")
      .then((r) => r.json())
      .then((d) => {
        if (d?.value) {
          try {
            const parsed = typeof d.value === "string" ? JSON.parse(d.value) : d.value;
            setForm({ ...DEFAULT_ABOUT, ...parsed });
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await authFetch("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ key: "about_site", value: JSON.stringify(form) }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">{t.admin.tabAbout}</h2>
      <p className="text-sm text-muted-foreground mb-6">
        {lang === "ja"
          ? "「このサイトについて」ページのヒーロー・紹介文・画像を編集できます。空欄の場合はデフォルトの表示になります。"
          : "Edit the About page hero, introduction text, and images. Leave blank to use default content."}
      </p>
      <div className="bg-card border p-6 max-w-2xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Hero title (EN)</label>
            <textarea value={form.hero_title_en ?? ""} onChange={(e) => setForm((p) => ({ ...p, hero_title_en: e.target.value }))} placeholder={t.about.heroTitle} rows={2} className="w-full p-3 rounded-lg border bg-background text-sm resize-none" />
            <p className="text-xs text-muted-foreground mt-1">Enterキーで改行できます / Press Enter to add a line break</p>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Hero title (JA)</label>
            <textarea value={form.hero_title_ja ?? ""} onChange={(e) => setForm((p) => ({ ...p, hero_title_ja: e.target.value }))} placeholder="つながる。取引する。成長する。" rows={2} className="w-full p-3 rounded-lg border bg-background text-sm resize-none" />
            <p className="text-xs text-muted-foreground mt-1">Enterキーで改行できます / Press Enter to add a line break</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Hero subtitle (EN)</label>
            <textarea value={form.hero_sub_en ?? ""} onChange={(e) => setForm((p) => ({ ...p, hero_sub_en: e.target.value }))} placeholder={t.about.heroSub} rows={2} className="w-full p-3 rounded-lg border bg-background text-sm resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Hero subtitle (JA)</label>
            <textarea value={form.hero_sub_ja ?? ""} onChange={(e) => setForm((p) => ({ ...p, hero_sub_ja: e.target.value }))} placeholder="シンガポールのF&B業界向け…" rows={2} className="w-full p-3 rounded-lg border bg-background text-sm resize-none" />
          </div>
        </div>
        <div>
          <ImageField
            label="Hero image"
            value={form.hero_image ?? ""}
            onChange={(v) => setForm((p) => ({ ...p, hero_image: v }))}
            hint={lang === "ja" ? "推奨サイズ：横1440px × 縦600px（16:7比率）、JPG/PNG、2MB以下" : "Recommended: 1440 × 600 px (16:7 ratio), JPG/PNG, under 2 MB"}
            uploadLabel={t.admin.imageUploadOrUrl}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Intro paragraph (EN)</label>
            <textarea value={form.intro_text_en ?? ""} onChange={(e) => setForm((p) => ({ ...p, intro_text_en: e.target.value }))} placeholder="Optional intro below hero" rows={3} className="w-full p-3 rounded-lg border bg-background text-sm resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Intro paragraph (JA)</label>
            <textarea value={form.intro_text_ja ?? ""} onChange={(e) => setForm((p) => ({ ...p, intro_text_ja: e.target.value }))} placeholder="任意の紹介文" rows={3} className="w-full p-3 rounded-lg border bg-background text-sm resize-none" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">
            Feature images (1–4)
            <span className="text-xs font-normal text-muted-foreground ml-2">
              {lang === "ja" ? "推奨サイズ：横800px × 縦600px（4:3）、JPG/PNG、2MB以下" : "Recommended: 800 × 600 px (4:3), JPG/PNG, under 2 MB"}
            </span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {([1, 2, 3, 4] as const).map((i) => (
              <ImageField
                key={i}
                label={`Feature ${i}`}
                value={(form as Record<string, string>)[`feature_image_${i}`] ?? ""}
                onChange={(v) => setForm((p) => ({ ...p, [`feature_image_${i}`]: v }))}
                hint={lang === "ja" ? `特集画像 ${i}（推奨：800×600px）` : `Feature image ${i} (recommended: 800×600 px)`}
                uploadLabel={t.admin.imageUploadOrUrl}
              />
            ))}
          </div>
        </div>

        {/* Feature section text (01–04) */}
        <div>
          <label className="text-sm font-medium block mb-3">
            {lang === "ja" ? "特集テキスト（01〜04）— 空白でデフォルト表示" : "Feature text (01–04) — leave blank to use default"}
          </label>
          <div className="space-y-6">
            {([1, 2, 3, 4] as const).map((i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-muted-foreground">0{i}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Title (EN)</label>
                    <input value={(form as any)[`feature${i}_title_en`] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [`feature${i}_title_en`]: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-background text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Title (JA)</label>
                    <input value={(form as any)[`feature${i}_title_ja`] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [`feature${i}_title_ja`]: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-background text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Description (EN)</label>
                    <textarea value={(form as any)[`feature${i}_desc_en`] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [`feature${i}_desc_en`]: e.target.value }))} rows={2} className="w-full p-2 rounded-lg border bg-background text-sm resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Description (JA)</label>
                    <textarea value={(form as any)[`feature${i}_desc_ja`] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [`feature${i}_desc_ja`]: e.target.value }))} rows={2} className="w-full p-2 rounded-lg border bg-background text-sm resize-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} className="rounded-xl gap-2" disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? t.common.saving : t.common.save}
          </Button>
          {saved && <span className="text-sm text-emerald-600 font-medium">{lang === "ja" ? "保存しました" : "Saved"}</span>}
        </div>
      </div>
    </div>
  );
}

function JobsManager() {
  const { t, lang } = useTranslation();
  const [whatsAppDigits, setWhatsAppDigits] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notices, setNotices] = useState<any[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings?key=jobs_whatsapp")
      .then((r) => r.json())
      .then((d) => {
        const v = typeof d?.value === "string" ? d.value : "";
        setWhatsAppDigits(sanitizeWhatsAppDigits(v));
      })
      .catch(() => {});
    fetch("/api/settings?key=social_instagram_url")
      .then((r) => r.json())
      .then((d) => {
        const v = typeof d?.value === "string" ? d.value.trim() : "";
        setInstagramUrl(v);
      })
      .catch(() => {});
  }, []);

  const loadNotices = async () => {
    setLoadingNotices(true);
    try {
      const res = await authFetch("/api/job-notices?includeDeleted=0&limit=50");
      const rows = await res.json().catch(() => []);
      setNotices(Array.isArray(rows) ? rows : []);
    } catch {
      setNotices([]);
    } finally {
      setLoadingNotices(false);
    }
  };

  useEffect(() => {
    loadNotices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ key: "jobs_whatsapp", value: whatsAppDigits }),
      });
      const res2 = await authFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ key: "social_instagram_url", value: instagramUrl.trim() }),
      });
      if (!res.ok || !res2.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError(err?.error ?? (lang === "ja" ? "保存に失敗しました。" : "Save failed."));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setSaveError(lang === "ja" ? "ネットワークエラーが発生しました。" : "Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">{t.admin.tabJobs}</h2>
      <div className="bg-card border p-6 max-w-2xl space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1.5">{t.admin.jobsWhatsAppLabel}</label>
          <input
            value={whatsAppDigits}
            onChange={(e) => setWhatsAppDigits(sanitizeWhatsAppDigits(e.target.value))}
            placeholder={t.admin.jobsWhatsAppPlaceholder}
            className="w-full h-11 px-4 rounded-lg border bg-background text-sm"
            inputMode="numeric"
          />
          <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line">{t.admin.jobsWhatsAppHint}</p>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">
            {lang === "ja" ? "Instagram URL（FOLLOW US 用）" : "Instagram URL (for FOLLOW US)"}
          </label>
          <input
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="https://www.instagram.com/your-account/"
            className="w-full h-11 px-4 rounded-lg border bg-background text-sm"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleSave} className="rounded-xl gap-2" disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? t.common.saving : t.common.save}
          </Button>
          {saved && <span className="text-sm text-emerald-600 font-medium">{t.admin.jobsSaved}</span>}
          {saveError && <span className="text-sm text-destructive font-medium">{saveError}</span>}
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold">{t.admin.jobsModerationTitle}</h3>
          <Button variant="outline" onClick={loadNotices} disabled={loadingNotices} className="rounded-xl">
            {loadingNotices ? t.common.loading : t.admin.jobsRefresh}
          </Button>
        </div>
        <div className="bg-card border rounded-xl overflow-hidden">
          {notices.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">{t.admin.jobsNoNotices}</div>
          ) : (
            <div className="divide-y">
              {notices.map((n) => (
                <div key={n.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full border font-bold bg-emerald-50 border-emerald-200 text-emerald-700">
                        {t.admin.jobsStatusActive}
                      </span>
                      <span className="text-sm font-bold truncate">{n.title}</span>
                      {n.company && <span className="text-xs text-muted-foreground truncate">— {n.company}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap break-words line-clamp-4">
                      {n.description}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="destructive"
                      className="rounded-xl"
                      disabled={deleteBusyId === n.id}
                      onClick={async () => {
                        if (!confirm(lang === "ja" ? "この求人を削除しますか？" : "Delete this job notice?")) return;
                        setDeleteBusyId(n.id);
                        try {
                          const res = await authFetch(`/api/job-notices?id=${encodeURIComponent(n.id)}`, {
                            method: "DELETE",
                          });
                          if (res.ok) await loadNotices();
                        } finally {
                          setDeleteBusyId(null);
                        }
                      }}
                    >
                      {t.admin.jobsDelete}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TermsManager() {
  const [termsText, setTermsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { t, lang } = useTranslation();

  useEffect(() => {
    fetch("/api/settings?key=terms_of_service")
      .then((r) => r.json())
      .then((d) => setTermsText(d?.value ?? ""))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ key: "terms_of_service", value: termsText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError(err?.error ?? (lang === "ja" ? "保存に失敗しました。" : "Save failed. Please check your database configuration."));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setSaveError(lang === "ja" ? "ネットワークエラーが発生しました。" : "Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">{t.admin.tabTerms}</h2>
      <div className="bg-card border p-6 max-w-2xl">
        <label className="text-sm font-medium block mb-1.5">{t.admin.termsLabel}</label>
        <textarea
          value={termsText}
          onChange={(e) => setTermsText(e.target.value)}
          rows={12}
          className="w-full p-3 rounded-lg border bg-background text-sm resize-y font-mono mb-4"
          placeholder="Enter terms of service content here..."
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleSave} className="rounded-xl gap-2" disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? t.common.saving : t.admin.termsSave}
          </Button>
          {saved && <span className="text-sm text-emerald-600 font-medium">{t.admin.termsSaved}</span>}
          {saveError && <span className="text-sm text-destructive font-medium">{saveError}</span>}
        </div>
        {termsText && (
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs font-semibold text-muted-foreground mb-2">{lang === "ja" ? "プレビュー" : "Preview"}</p>
            <div className="prose prose-sm max-w-none text-foreground max-h-48 overflow-y-auto bg-muted/30 rounded-lg p-3">
              {termsText.split("\n").map((line, i) =>
                line.trim() === "" ? <br key={i} /> : <p key={i} className="mb-2 text-xs leading-relaxed text-muted-foreground">{line}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PrivacyManager() {
  const [privacyText, setPrivacyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { t, lang } = useTranslation();

  useEffect(() => {
    fetch("/api/settings?key=privacy_policy")
      .then((r) => r.json())
      .then((d) => setPrivacyText(d?.value ?? ""))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ key: "privacy_policy", value: privacyText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError(err?.error ?? (lang === "ja" ? "保存に失敗しました。" : "Save failed. Please check your database configuration."));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setSaveError(lang === "ja" ? "ネットワークエラーが発生しました。" : "Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">{t.admin.tabPrivacy}</h2>
      <div className="bg-card border p-6 max-w-2xl">
        <label className="text-sm font-medium block mb-1.5">{t.admin.privacyLabel}</label>
        <textarea
          value={privacyText}
          onChange={(e) => setPrivacyText(e.target.value)}
          rows={16}
          className="w-full p-3 rounded-lg border bg-background text-sm resize-y font-mono mb-4"
          placeholder="Enter privacy policy content here..."
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleSave} className="rounded-xl gap-2" disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? t.common.saving : t.admin.privacySave}
          </Button>
          {saved && <span className="text-sm text-emerald-600 font-medium">{t.admin.privacySaved}</span>}
          {saveError && <span className="text-sm text-destructive font-medium">{saveError}</span>}
        </div>
        {privacyText && (
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs font-semibold text-muted-foreground mb-2">{lang === "ja" ? "プレビュー" : "Preview"}</p>
            <div className="prose prose-sm max-w-none text-foreground max-h-48 overflow-y-auto bg-muted/30 rounded-lg p-3">
              {privacyText.split("\n").map((line, i) =>
                line.trim() === "" ? <br key={i} /> : <p key={i} className="mb-2 text-xs leading-relaxed text-muted-foreground">{line}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HomeVideoManager() {
  const { t, lang } = useTranslation();
  const tv = (t.admin as any).homeVideo;
  const [videoUrl, setVideoUrl] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings?key=promo_video_url")
      .then((r) => r.json())
      .then((d) => {
        const v = d?.value || "";
        setVideoUrl(v);
        setInputUrl(v);
      });
  }, []);

  const handleSave = async (url: string) => {
    setSaving(true);
    await authFetch("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ key: "promo_video_url", value: url }),
    });
    setVideoUrl(url);
    setInputUrl(url);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const signRes = await authFetch("/api/upload/signed", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size, folder: "videos" }),
      });
      if (!signRes.ok) throw new Error("Upload setup failed");
      const signed = await signRes.json();
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        });
        xhr.addEventListener("load", () => {
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`));
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.open("PUT", signed.signedUrl);
        xhr.setRequestHeader("Content-Type", signed.contentType);
        xhr.setRequestHeader("x-upsert", "true");
        xhr.send(file);
      });
      await handleSave(signed.publicUrl);
    } catch (e: any) {
      alert(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const getYouTubeId = (url: string) => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  };
  const ytId = videoUrl ? getYouTubeId(videoUrl) : null;
  const isVideoFile = videoUrl && !ytId;

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">{tv.title}</h2>
      <p className="text-sm text-muted-foreground mb-6">{tv.description}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">{tv.currentLabel}</h3>
          {videoUrl ? (
            ytId ? (
              <div className="aspect-video rounded-xl overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="aspect-video rounded-xl overflow-hidden bg-black">
                <video src={videoUrl} controls className="w-full h-full object-contain" />
              </div>
            )
          ) : (
            <div className="aspect-video rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 bg-muted/40">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <Play className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center px-4">{tv.noVideo}</p>
            </div>
          )}
          {videoUrl && (
            <button
              type="button"
              onClick={() => handleSave("")}
              className="mt-3 text-xs text-destructive hover:underline"
            >
              {tv.remove}
            </button>
          )}
        </div>

        {/* Settings */}
        <div className="bg-card border rounded-xl p-5 space-y-5">
          {/* YouTube URL */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{tv.youtubeLabel}</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder={tv.youtubePlaceholder}
                className="flex-1 h-10 px-3 rounded-lg border bg-background text-sm"
              />
              <button
                type="button"
                disabled={saving || inputUrl === videoUrl}
                onClick={() => handleSave(inputUrl.trim())}
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saved ? tv.saved : saving ? "…" : tv.save}
              </button>
            </div>
          </div>

          {/* Upload */}
          <div>
            <label className="text-sm font-medium block mb-1.5">{tv.uploadLabel}</label>
            {uploading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {uploadProgress !== null && uploadProgress > 0
                  ? `${uploadProgress}%`
                  : lang === "ja" ? "準備中…" : "Preparing…"}
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border bg-muted hover:bg-muted/80 transition-colors text-sm font-medium">
                <Video className="h-4 w-4 text-muted-foreground" />
                {lang === "ja" ? "ファイルを選択" : "Choose video file"}
                <input
                  type="file"
                  accept="video/*,.mp4,.mov,.webm,.avi"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {lang === "ja" ? "最大200MB。MP4推奨。" : "Max 200 MB. MP4 recommended."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function QRManager() {
  const [redirectUrl, setRedirectUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const { t, lang } = useTranslation();

  useEffect(() => {
    fetch("/api/settings?key=qr_redirect_url").then((r) => r.json()).then((d) => setRedirectUrl(d?.value || "/suppliers"));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await authFetch("/api/settings", { method: "PUT", body: JSON.stringify({ key: "qr_redirect_url", value: redirectUrl }) });
    setSaving(false);
    alert(t.admin.qrSaved);
  };

  const presets = [
    { value: "/suppliers", label: lang === "ja" ? "サプライヤー一覧" : "Supplier Directory" },
    { value: "/marketplace", label: lang === "ja" ? "マーケットプレイス" : "Marketplace" },
    { value: "/about", label: lang === "ja" ? "このサイトについて" : "About Page" },
    { value: "/register", label: lang === "ja" ? "新規登録ページ" : "Registration Page" },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">{t.admin.qrTitle}</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: QR Code preview + download */}
        <div className="bg-card border rounded-xl p-6 flex flex-col items-center">
          <h3 className="text-sm font-semibold mb-4 self-start">{t.admin.qrPreviewTitle}</h3>
          <div className="bg-white rounded-xl p-4 shadow-sm border mb-4">
            <img src="/QR.png?v=2" alt="QR Code" className="w-48 h-48 sm:w-56 sm:h-56 object-contain" />
          </div>
          <p className="text-xs text-muted-foreground text-center mb-3">
            {t.admin.qrPointsTo}
          </p>
          <a
            href="/QR.png?v=2"
            download="TheKitchenConnection-QR.png"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            {t.admin.qrDownload}
          </a>
        </div>

        {/* Right: Redirect URL settings */}
        <div className="bg-card border rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-2">{t.admin.qrSettingsTitle}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t.admin.qrDescription}
          </p>

          <label className="text-sm font-medium block mb-1.5">{t.admin.qrRedirectLabel}</label>
          <input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} placeholder="/suppliers or https://..." className="w-full h-11 px-4 rounded-lg border bg-background text-sm mb-3" />

          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">{t.admin.qrQuickSelect}</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setRedirectUrl(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    redirectUrl === p.value
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-muted/50 border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} className="rounded-xl gap-2" disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? t.admin.qrSaving : t.admin.qrSave}
          </Button>

          <div className="mt-5 border-t pt-4">
            <h4 className="text-xs font-semibold mb-2">{t.admin.qrHowTitle}</h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <span className="font-bold text-primary shrink-0">1.</span>
                <span>{t.admin.qrHow1}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary shrink-0">2.</span>
                <span>{t.admin.qrHow2}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary shrink-0">3.</span>
                <span>{t.admin.qrHow3}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportManager({ onReportChanged }: { onReportChanged?: () => void }) {
  const [reports, setReports] = useState<any[]>([]);
  const [itemMeta, setItemMeta] = useState<Record<string, { title: string; slug?: string }>>({});
  const { t, lang } = useTranslation();

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    const res = await authFetch("/api/reports");
    if (!res.ok) {
      setReports([]);
      return;
    }
    setReports(await res.json());
  };

  const handleStatus = async (id: string, _status: string) => {
    // Delete the report from the database so it disappears from the list
    await authFetch(`/api/reports?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await fetchReports();
    onReportChanged?.();
  };

  const handleDeleteItem = async (r: any) => {
    if (!confirm(t.admin.reportDeleteConfirm)) return;
    if (r.item_type === "marketplace_item" && r.item_id) {
      const itemRes = await fetch(`/api/marketplace/${encodeURIComponent(r.item_id)}?byId=true`);
      if (itemRes.ok) {
        const item = await itemRes.json();
        if (item?.id) {
          await authFetch(`/api/marketplace/${encodeURIComponent(item.id)}?byId=true`, { method: "DELETE" });
        } else if (item?.slug) {
          await authFetch(`/api/marketplace/${encodeURIComponent(item.slug)}`, { method: "DELETE" });
        }
      }
    }
    // Delete the report from the database
    await authFetch(`/api/reports?id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
    await fetchReports();
    onReportChanged?.();
    alert(t.admin.reportNotifyMsg);
  };

  useEffect(() => {
    let cancelled = false;
    const loadItemMeta = async () => {
      const marketReports = reports.filter((r) => r.item_type === "marketplace_item" && r.item_id);
      if (marketReports.length === 0) {
        if (!cancelled) setItemMeta({});
        return;
      }
      const entries = await Promise.all(
        marketReports.map(async (r) => {
          try {
            const res = await fetch(`/api/marketplace/${encodeURIComponent(r.item_id)}?byId=true`);
            if (!res.ok) return [r.item_id, { title: lang === "ja" ? "（削除済みまたは不明）" : "(deleted or unknown)" }] as const;
            const item = await res.json();
            return [r.item_id, { title: item?.title || item?.slug || r.item_id, slug: item?.slug }] as const;
          } catch {
            return [r.item_id, { title: r.item_id }] as const;
          }
        }),
      );
      if (!cancelled) setItemMeta(Object.fromEntries(entries));
    };
    loadItemMeta();
    return () => {
      cancelled = true;
    };
  }, [reports, lang]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">{t.admin.reportManagerTitle}</h2>
      {reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><p>{t.admin.reportEmpty}</p></div>
      ) : (
        <div className="space-y-3">
          {reports.map((r: any) => (
            <div key={r.id} className="bg-card border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{r.item_type} · {new Date(r.created_at).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-SG")}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "pending" ? "bg-yellow-100 text-yellow-700" : r.status === "reviewed" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>{r.status}</span>
              </div>
              <p className="text-sm font-medium mb-0.5">{r.item_type} · ID: {r.item_id}</p>
              {r.item_type === "marketplace_item" && itemMeta[r.item_id] && (
                <p className="text-xs text-primary mb-1">
                  {lang === "ja" ? "対象アイテム: " : "Target item: "}
                  {itemMeta[r.item_id].slug ? (
                    <a href={`/marketplace/${itemMeta[r.item_id].slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {itemMeta[r.item_id].title}
                    </a>
                  ) : (
                    itemMeta[r.item_id].title
                  )}
                </p>
              )}
              <p className="text-sm text-muted-foreground">{r.reason}</p>
              {r.status === "pending" && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button size="sm" className="rounded-xl" onClick={() => handleStatus(r.id, "reviewed")}>{t.admin.reportReviewed}</Button>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => handleStatus(r.id, "dismissed")}>{t.admin.reportDismiss}</Button>
                  {r.item_type === "marketplace_item" && (
                    <Button variant="outline" size="sm" className="rounded-xl text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => handleDeleteItem(r)}>
                      <Trash2 className="h-3 w-3 mr-1" /> {t.admin.reportDelete}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyticsPanel() {
  const { t, lang } = useTranslation();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [monthlyVisits, setMonthlyVisits] = useState<{ month: string; visits: number }[]>([]);
  const [monthlySupplierViews, setMonthlySupplierViews] = useState<{ month: string; views: number }[]>([]);
  const [monthlyMarketplaceViews, setMonthlyMarketplaceViews] = useState<{ month: string; views: number }[]>([]);
  const [monthlyWhatsappTaps, setMonthlyWhatsappTaps] = useState<{ month: string; clicks: number }[]>([]);
  const [monthlySupplierReportRows, setMonthlySupplierReportRows] = useState<
    { supplier_id: string; slug: string; name: string; name_ja: string; views: number; whatsapp: number }[]
  >([]);
  const [topMarketplaceItems, setTopMarketplaceItems] = useState<{ slug: string; views: number }[]>([]);
  const [pvMonths, setPvMonths] = useState(6);
  const [svMonths, setSvMonths] = useState(6);
  const [mvMonths, setMvMonths] = useState(6);
  const [wcMonths, setWcMonths] = useState(6);
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [expandSupplierChart, setExpandSupplierChart] = useState(false);
  const [expandSupplierWaChart, setExpandSupplierWaChart] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const nonce = Date.now();
    authFetch(`/api/admin/suppliers?_=${nonce}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSuppliers)
      .catch(() => setSuppliers([]));
    fetch(`/api/marketplace?status=approved&_=${nonce}`)
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {});
  }, [refreshTick]);

  useEffect(() => {
    const nonce = Date.now();
    fetch(`/api/analytics/pageview?months=${pvMonths}&_=${nonce}`)
      .then((r) => r.json()).then(setMonthlyVisits).catch(() => {});
  }, [pvMonths, refreshTick]);

  useEffect(() => {
    const nonce = Date.now();
    fetch(`/api/analytics/supplier-views?months=${svMonths}&_=${nonce}`)
      .then((r) => r.json()).then(setMonthlySupplierViews).catch(() => {});
  }, [svMonths, refreshTick]);

  useEffect(() => {
    const nonce = Date.now();
    fetch(`/api/analytics/supplier-whatsapp-click?months=${wcMonths}&_=${nonce}`)
      .then((r) => r.json())
      .then(setMonthlyWhatsappTaps)
      .catch(() => {});
  }, [wcMonths, refreshTick]);

  useEffect(() => {
    const nonce = Date.now();
    fetch(`/api/analytics/marketplace-views?months=${mvMonths}&_=${nonce}`)
      .then((r) => r.json())
      .then((d) => {
        setMonthlyMarketplaceViews(d.monthly ?? []);
        setTopMarketplaceItems(d.topItems ?? []);
      })
      .catch(() => {});
  }, [mvMonths, refreshTick]);

  useEffect(() => {
    const nonce = Date.now();
    fetch(`/api/analytics/supplier-monthly-report?month=${encodeURIComponent(reportMonth)}&_=${nonce}`)
      .then((r) => r.json())
      .then((d) => setMonthlySupplierReportRows(Array.isArray(d?.rows) ? d.rows : []))
      .catch(() => setMonthlySupplierReportRows([]));
  }, [reportMonth, refreshTick]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRefreshTick((v) => v + 1);
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  const monthOptions = [3, 6, 12];
  const monthlyReportTotals = monthlySupplierReportRows.reduce(
    (acc, row: any) => ({
      views: acc.views + (row.views || 0),
      whatsapp: acc.whatsapp + (Number(row.whatsapp) || 0),
    }),
    { views: 0, whatsapp: 0 },
  );
  const formatMonth = (key: string) => {
    const [y, m] = key.split("-");
    return lang === "ja" ? `${y}年${parseInt(m)}月` : new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en", { month: "short", year: "2-digit" });
  };
  const exportMonthlyReportCsv = () => {
    const header = ["month", "supplier_slug", "supplier_name", "views", "whatsapp_taps"];
    const lines = monthlySupplierReportRows.map((row: any) => {
      const displayName = lang === "ja" ? (row.name_ja || row.name) : (row.name || row.name_ja);
      const safeName = String(displayName ?? "").replaceAll("\"", "\"\"");
      return [reportMonth, row.slug, `"${safeName}"`, String(row.views ?? 0), String(Number(row.whatsapp) || 0)].join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supplier-monthly-report-${reportMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10">
      <h2 className="text-xl font-bold">{t.admin.analytics.title}</h2>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="bg-card border p-5 text-center">
          <p className="text-3xl font-black text-primary">{suppliers.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.admin.analytics.suppliersCount}</p>
        </div>
        <div className="bg-card border p-5 text-center">
          <p className="text-3xl font-black text-accent">{items.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.admin.analytics.marketplaceCount}</p>
        </div>
        <div className="bg-card border p-5 text-center">
          <p className="text-3xl font-black text-secondary">{suppliers.reduce((a: number, s: any) => a + (s.views || 0), 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.admin.analytics.totalViews}</p>
        </div>
        <div className="bg-card border p-5 text-center">
          <p className="text-3xl font-black text-primary">{monthlyMarketplaceViews.reduce((a, d) => a + d.views, 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.admin.analytics.totalMarketplaceViews}</p>
        </div>
        <div className="bg-card border p-5 text-center col-span-2 md:col-span-1 xl:col-span-1">
          <p className="text-3xl font-black text-emerald-600">
            {suppliers.reduce((a: number, s: any) => a + (Number(s.whatsapp_clicks) || 0), 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{t.admin.analytics.totalWhatsappTaps}</p>
        </div>
      </div>

      {/* ── Monthly site visits chart ── */}
      <div className="bg-card border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm">{t.admin.analytics.monthlyVisits}</h3>
          <div className="flex gap-1">
            {monthOptions.map((m) => (
              <button key={m} onClick={() => setPvMonths(m)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${pvMonths === m ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                {m}{lang === "ja" ? "ヶ月" : "mo"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyVisits.map((d) => ({ ...d, month: formatMonth(d.month) }))} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [v.toLocaleString(), t.admin.analytics.visitsLabel]} />
              <Line type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t.admin.analytics.monthlyVisitsNote}</p>
      </div>

      {/* ── Monthly supplier views chart ── */}
      <div className="bg-card border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm">{t.admin.analytics.monthlySupplierViews}</h3>
          <div className="flex gap-1">
            {monthOptions.map((m) => (
              <button key={m} onClick={() => setSvMonths(m)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${svMonths === m ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                {m}{lang === "ja" ? "ヶ月" : "mo"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlySupplierViews.map((d) => ({ ...d, month: formatMonth(d.month) }))} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [v.toLocaleString(), t.admin.analytics.viewsLabel]} />
              <Line type="monotone" dataKey="views" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t.admin.analytics.monthlySupplierViewsNote}</p>
      </div>

      {/* ── Supplier monthly report table (per supplier) ── */}
      <div className="bg-card border p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-bold text-sm">{t.admin.analytics.supplierMonthlyReportTitle}</h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">{t.admin.analytics.monthLabel}</label>
            <input
              type="month"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="h-9 px-3 rounded-lg border bg-background text-sm"
            />
            <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={exportMonthlyReportCsv}>
              {t.admin.analytics.exportCsv}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{t.admin.analytics.supplierMonthlyReportNote}</p>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left py-2.5 px-3 font-semibold">{t.admin.analytics.supplierLabel}</th>
                <th className="text-right py-2.5 px-3 font-semibold">{t.admin.analytics.monthlyViewsLabel}</th>
                <th className="text-right py-2.5 px-3 font-semibold">{t.admin.analytics.monthlyWhatsappLabel}</th>
              </tr>
            </thead>
            <tbody>
              {monthlySupplierReportRows.map((row: any) => (
                <tr key={row.supplier_id} className="border-b last:border-0">
                  <td className="py-2.5 px-3">
                    <a href={`/suppliers/${row.slug}`} className="hover:underline">
                      {lang === "ja" ? (row.name_ja || row.name) : (row.name || row.name_ja)}
                    </a>
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold tabular-nums">
                    {row.views.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-emerald-700">
                    {(Number(row.whatsapp) || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/30 border-t">
                <td className="py-2.5 px-3 font-semibold">TOTAL</td>
                <td className="py-2.5 px-3 text-right font-bold tabular-nums">{monthlyReportTotals.views.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right font-bold tabular-nums text-emerald-700">{monthlyReportTotals.whatsapp.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Monthly WhatsApp taps (supplier listings) ── */}
      <div className="bg-card border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm">{t.admin.analytics.monthlyWhatsappTaps}</h3>
          <div className="flex gap-1">
            {monthOptions.map((m) => (
              <button key={m} onClick={() => setWcMonths(m)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${wcMonths === m ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                {m}{lang === "ja" ? "ヶ月" : "mo"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyWhatsappTaps.map((d) => ({ ...d, month: formatMonth(d.month) }))} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} label={{ value: t.admin.analytics.xAxisMonth, position: "insideBottom", offset: -4 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} label={{ value: t.admin.analytics.yAxisCount, angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={(v: number) => [v.toLocaleString(), t.admin.analytics.whatsappTapsLabel]} />
              <Line type="monotone" dataKey="clicks" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t.admin.analytics.monthlyWhatsappTapsNote}</p>
      </div>

      {/* ── Monthly marketplace item views chart ── */}
      <div className="bg-card border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm">{t.admin.analytics.monthlyMarketplaceViews}</h3>
          <div className="flex gap-1">
            {monthOptions.map((m) => (
              <button key={m} onClick={() => setMvMonths(m)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${mvMonths === m ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                {m}{lang === "ja" ? "ヶ月" : "mo"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyMarketplaceViews.map((d) => ({ ...d, month: formatMonth(d.month) }))} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [v.toLocaleString(), t.admin.analytics.viewsLabel]} />
              <Line type="monotone" dataKey="views" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t.admin.analytics.monthlyMarketplaceViewsNote}</p>
      </div>

      {/* ── Top marketplace items by views ── */}
      <div>
        <h3 className="font-bold text-sm mb-1">{t.admin.analytics.topMarketplaceItems}</h3>
        <p className="text-xs text-muted-foreground mb-3">{t.admin.analytics.marketplaceCumulativeNote}</p>
        {topMarketplaceItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.admin.noProducts}</p>
        ) : (
          <>
            <div className="h-52 w-full max-w-xl mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={topMarketplaceItems.slice(0, 5).map((i) => {
                    const item = items.find((it: any) => it.slug === i.slug);
                    return { name: item ? (lang === "ja" ? (item.title_ja || item.title) : (item.title || item.title_ja)) : i.slug, views: i.views };
                  })}
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number) => [value.toLocaleString(), t.admin.analytics.viewsLabel]} />
                  <Bar dataKey="views" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {topMarketplaceItems.slice(0, 5).map((i) => {
                const item = items.find((it: any) => it.slug === i.slug);
                const displayTitle = item ? (lang === "ja" ? (item.title_ja || item.title) : (item.title || item.title_ja)) : i.slug;
                return (
                  <div key={i.slug} className="flex items-center gap-3 bg-card border p-3">
                    {item?.image && <img src={item.image} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{displayTitle}</p></div>
                    <p className="text-sm font-bold text-accent">{i.views.toLocaleString()} {t.admin.analytics.viewsLabel}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Plan breakdown ── */}
      <div>
        <h3 className="font-bold text-sm mb-3">{t.admin.analytics.planBreakdown}</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {(["premium", "standard", "basic"] as const).map((plan) => (
            <div key={plan} className={`rounded-2xl p-4 text-center border ${PLAN_BADGE[plan]}`}>
              <p className="text-2xl font-black">{suppliers.filter((s: any) => (s.plan || "basic") === plan).length}</p>
              <p className="text-xs font-semibold mt-1">{PLAN_LABEL[plan]}</p>
            </div>
          ))}
        </div>
        <div className="h-44 w-full max-w-md">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { plan: PLAN_LABEL.premium, count: suppliers.filter((s: any) => (s.plan || "basic") === "premium").length },
                { plan: PLAN_LABEL.standard, count: suppliers.filter((s: any) => (s.plan || "basic") === "standard").length },
                { plan: PLAN_LABEL.basic, count: suppliers.filter((s: any) => (s.plan || "basic") === "basic").length },
              ]}
              margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
            >
              <XAxis dataKey="plan" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [value, t.admin.analytics.suppliersCount]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                <Cell fill="#FF2636" />
                <Cell fill="hsl(var(--primary))" />
                <Cell fill="hsl(var(--muted-foreground))" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top suppliers by cumulative views ── */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-2 mb-1">
          <h3 className="font-bold text-sm">{t.admin.analytics.topByViews}</h3>
          <button
            type="button"
            onClick={() => setExpandSupplierChart((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {expandSupplierChart
              ? lang === "ja"
                ? "グラフを上位5社のみ表示"
                : "Show top 5 in chart"
              : lang === "ja"
                ? "全社をグラフに表示"
                : "Show all suppliers in chart"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{t.admin.analytics.cumulativeNote}</p>
        <div className={`w-full max-w-xl mb-4 ${expandSupplierChart ? "h-[min(70vh,28rem)]" : "h-52"}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={[...suppliers]
                .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
                .slice(0, expandSupplierChart ? undefined : 5)
                .map((s: any) => ({ name: lang === "ja" ? (s.name_ja || s.name) : (s.name || s.name_ja), views: s.views || 0 }))}
              margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
            >
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: number) => [value.toLocaleString(), t.admin.analytics.viewsLabel]} />
              <Bar dataKey="views" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
          {[...suppliers].sort((a: any, b: any) => (b.views || 0) - (a.views || 0)).map((s: any) => (
            <div key={s.id} className="flex items-center gap-3 bg-card border p-3">
              <img src={s.logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
              <div className="flex-1"><p className="text-sm font-semibold">{lang === "ja" ? (s.name_ja || s.name) : (s.name || s.name_ja)}</p></div>
              <div className="flex flex-col items-end text-right gap-0.5 shrink-0">
                <p className="text-sm font-bold text-primary">{(s.views || 0).toLocaleString()} {t.admin.analytics.viewsLabel}</p>
                <p className="text-xs text-muted-foreground font-medium">
                  {(Number(s.whatsapp_clicks) || 0).toLocaleString()} {t.admin.analytics.whatsappTapsShort}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Top suppliers by WhatsApp taps (cumulative) ── */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-2 mb-1">
          <h3 className="font-bold text-sm">{t.admin.analytics.topByWhatsapp}</h3>
          <button
            type="button"
            onClick={() => setExpandSupplierWaChart((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {expandSupplierWaChart
              ? lang === "ja"
                ? "グラフを上位5社のみ表示"
                : "Show top 5 in chart"
              : lang === "ja"
                ? "全社をグラフに表示"
                : "Show all suppliers in chart"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{t.admin.analytics.whatsappCumulativeNote}</p>
        <div className={`w-full max-w-xl mb-4 ${expandSupplierWaChart ? "h-[min(70vh,28rem)]" : "h-52"}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={[...suppliers]
                .sort((a: any, b: any) => (Number(b.whatsapp_clicks) || 0) - (Number(a.whatsapp_clicks) || 0))
                .slice(0, expandSupplierWaChart ? undefined : 5)
                .map((s: any) => ({
                  name: lang === "ja" ? (s.name_ja || s.name) : (s.name || s.name_ja),
                  taps: Number(s.whatsapp_clicks) || 0,
                }))}
              margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
            >
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: number) => [value.toLocaleString(), t.admin.analytics.whatsappTapsLabel]} />
              <Bar dataKey="taps" fill="#059669" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
          {[...suppliers]
            .sort((a: any, b: any) => (Number(b.whatsapp_clicks) || 0) - (Number(a.whatsapp_clicks) || 0))
            .map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 bg-card border p-3">
                <img src={s.logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
                <div className="flex-1"><p className="text-sm font-semibold">{lang === "ja" ? (s.name_ja || s.name) : (s.name || s.name_ja)}</p></div>
                <div className="flex flex-col items-end text-right gap-0.5 shrink-0">
                  <p className="text-sm font-bold text-emerald-600">
                    {(Number(s.whatsapp_clicks) || 0).toLocaleString()} {t.admin.analytics.whatsappTapsLabel}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {(s.views || 0).toLocaleString()} {t.admin.analytics.viewsLabel}
                  </p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function AppearanceManager() {
  const { t, lang } = useTranslation();
  const [fontKey, setFontKey]   = useState("inter");
  const [colorKey, setColorKey] = useState("red");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((rows: { key: string; value: string }[]) => {
        const f = rows.find((r) => r.key === "site_font");
        const c = rows.find((r) => r.key === "site_color");
        if (f?.value) setFontKey(f.value);
        if (c?.value) setColorKey(c.value);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        authFetch("/api/settings", { method: "PUT", body: JSON.stringify({ key: "site_font", value: fontKey }) }),
        authFetch("/api/settings", { method: "PUT", body: JSON.stringify({ key: "site_color", value: colorKey }) }),
      ]);
      applyTheme(fontKey, colorKey);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const selectedColor = COLOR_OPTIONS.find((c) => c.key === colorKey) ?? COLOR_OPTIONS[0];

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold">{t.admin.tabAppearance}</h2>

      {/* ── Font picker ── */}
      <div className="bg-card border p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <span className="text-lg">🔤</span>
          {lang === "ja" ? "フォント設定" : "Font Settings"}
        </h3>
        <p className="text-sm text-muted-foreground mb-5">
          {lang === "ja"
            ? "サイト全体に適用されるフォントを選択してください。"
            : "Choose the font applied across the whole site."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFontKey(f.key)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                fontKey === f.key
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              <p className="font-semibold text-sm" style={{ fontFamily: f.css }}>
                {lang === "ja" ? f.labelJa : f.labelEn}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: f.css }}>
                {lang === "ja" ? "あいうえお ABCdef 123" : "ABCdef 123 — The quick brown fox"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Color picker ── */}
      <div className="bg-card border p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <span className="text-lg">🎨</span>
          {lang === "ja" ? "メインカラー設定" : "Primary Color Settings"}
        </h3>
        <p className="text-sm text-muted-foreground mb-5">
          {lang === "ja"
            ? "ヘッダー・ボタン・アクセントカラーとして使われる色を選択してください。"
            : "Choose the accent color used for the header, buttons, and highlights."}
        </p>
        <div className="flex flex-wrap gap-4">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColorKey(c.key)}
              title={lang === "ja" ? c.labelJa : c.labelEn}
              className={`relative w-14 h-14 rounded-2xl border-4 transition-all hover:scale-105 ${
                colorKey === c.key ? "border-foreground scale-110 shadow-lg" : "border-transparent"
              }`}
              style={{ backgroundColor: c.hex }}
            >
              {colorKey === c.key && (
                <span className="absolute inset-0 flex items-center justify-center text-white font-black text-lg">✓</span>
              )}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          {lang === "ja" ? `選択中: ${selectedColor.labelJa}` : `Selected: ${selectedColor.labelEn}`}
        </p>
      </div>

      {/* ── Live preview ── */}
      <div className="bg-card border p-6">
        <h3 className="font-bold mb-4">
          {lang === "ja" ? "プレビュー" : "Preview"}
        </h3>
        <div
          style={{
            fontFamily: FONT_OPTIONS.find((f) => f.key === fontKey)?.css,
            "--preview-color": selectedColor.hex,
          } as React.CSSProperties}
          className="space-y-3 p-4 rounded-xl border bg-background"
        >
          <p className="text-2xl font-bold" style={{ color: selectedColor.hex }}>
            {lang === "ja" ? "F&Bポータル・シンガポール" : "F&B Portal Singapore"}
          </p>
          <p className="text-base">
            {lang === "ja"
              ? "信頼できるサプライヤーを見つけ、すぐにつながり、スマートに取引しましょう。"
              : "Find trusted suppliers, connect instantly, trade smart."}
          </p>
          <div className="flex gap-3">
            <span className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: selectedColor.hex }}>
              {lang === "ja" ? "詳細を見る" : "View Details"}
            </span>
            <span className="px-4 py-2 rounded-xl text-sm font-semibold border-2" style={{ borderColor: selectedColor.hex, color: selectedColor.hex }}>
              {lang === "ja" ? "お問い合わせ" : "Contact"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Save button ── */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2 px-6">
          <Save className="h-4 w-4" />
          {saving
            ? (lang === "ja" ? "保存中…" : "Saving…")
            : (lang === "ja" ? "設定を保存" : "Save Settings")}
        </Button>
        {saved && (
          <p className="text-sm text-green-600 font-medium">
            {lang === "ja" ? "保存しました ✓ — 変更はすぐに反映されます。" : "Saved ✓ — Changes applied immediately."}
          </p>
        )}
      </div>
    </div>
  );
}

function LinksManager() {
  const { lang } = useTranslation();
  const [links, setLinks] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const emptyForm = {
    name: "", name_ja: "", description: "", description_ja: "",
    url: "", icon: "🔗", bg_image: "", category: "government", sort_order: 0, active: true,
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchLinks(); }, []);

  const fetchLinks = async () => {
    const res = await fetch("/api/links?includeInactive=true");
    if (res.ok) setLinks(await res.json());
  };

  const resetForm = () => { setForm(emptyForm); setEditId(null); };

  const handleEdit = (l: any) => {
    setForm({
      name: l.name || "", name_ja: l.name_ja || "",
      description: l.description || "", description_ja: l.description_ja || "",
      url: l.url || "", icon: l.icon || "🔗",
      bg_image: l.bg_image || l.bgImage || "",
      category: l.category || "government",
      sort_order: l.sort_order ?? 0,
      active: l.active !== false,
    });
    setEditId(l.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.url) return;
    const body = { ...form, sort_order: Number(form.sort_order) };
    if (editId) {
      await fetch("/api/links", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editId, ...body }) });
    } else {
      await fetch("/api/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setShowForm(false);
    resetForm();
    fetchLinks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(lang === "ja" ? "このリンクを削除しますか？" : "Delete this link?")) return;
    await fetch(`/api/links?id=${id}`, { method: "DELETE" });
    fetchLinks();
  };

  const categoryOptions = ["government", "association", "platform", "resource"];
  const categoryLabel = (c: string) => ({ government: "Government", association: "Association", platform: "Platform", resource: "Resource" }[c] ?? c);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{lang === "ja" ? "リンク管理" : "Links Manager"}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{links.length} {lang === "ja" ? "件" : "links"}</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> {showForm ? (lang === "ja" ? "閉じる" : "Close") : (lang === "ja" ? "追加" : "Add")}
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border p-6 mb-6 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground">
            {editId ? (lang === "ja" ? "リンクを編集" : "Edit Link") : (lang === "ja" ? "新規リンクを追加" : "Add New Link")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label={lang === "ja" ? "名前（英語）" : "Name (English)"} value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
            <InputField label={lang === "ja" ? "名前（日本語）" : "Name (Japanese)"} value={form.name_ja} onChange={(v) => setForm((p) => ({ ...p, name_ja: v }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label={lang === "ja" ? "説明（英語）" : "Description (English)"} value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} />
            <InputField label={lang === "ja" ? "説明（日本語）" : "Description (Japanese)"} value={form.description_ja} onChange={(v) => setForm((p) => ({ ...p, description_ja: v }))} />
          </div>
          <InputField label="URL" value={form.url} onChange={(v) => setForm((p) => ({ ...p, url: v }))} placeholder="https://..." />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InputField label={lang === "ja" ? "アイコン（絵文字）" : "Icon (emoji)"} value={form.icon} onChange={(v) => setForm((p) => ({ ...p, icon: v }))} placeholder="🔗" />
            <div>
              <label className="text-sm font-medium block mb-1.5">{lang === "ja" ? "カテゴリー" : "Category"}</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full h-11 px-3 rounded-lg border bg-background text-sm"
              >
                {categoryOptions.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
              </select>
            </div>
            <InputField label={lang === "ja" ? "表示順" : "Sort Order"} value={String(form.sort_order)} onChange={(v) => setForm((p) => ({ ...p, sort_order: Number(v) || 0 }))} placeholder="0" />
            <div className="flex flex-col justify-end pb-0.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer h-11">
                <input type="checkbox" checked={form.active} onChange={() => setForm((p) => ({ ...p, active: !p.active }))} className="accent-primary w-4 h-4" />
                {lang === "ja" ? "表示する" : "Active"}
              </label>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{lang === "ja" ? "背景画像URL" : "Background Image URL"}</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={form.bg_image}
                onChange={(e) => setForm((p) => ({ ...p, bg_image: e.target.value }))}
                placeholder="https://images.unsplash.com/..."
                className="flex-1 h-11 px-4 rounded-lg border bg-background text-sm"
              />
              {form.bg_image && (
                <img src={form.bg_image} alt="" className="w-16 h-11 rounded-lg object-cover border flex-shrink-0" />
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSave} className="rounded-xl gap-2">
              <Save className="h-4 w-4" /> {editId ? (lang === "ja" ? "更新" : "Update") : (lang === "ja" ? "作成" : "Create")}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }} className="rounded-xl">
              {lang === "ja" ? "キャンセル" : "Cancel"}
            </Button>
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{lang === "ja" ? "リンクがまだありません" : "No links yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((l: any) => (
            <div key={l.id} className="bg-card border p-4 flex items-center gap-4">
              {l.bg_image || l.bgImage ? (
                <img src={l.bg_image || l.bgImage} alt="" className="w-16 h-12 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl flex-shrink-0">{l.icon}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{lang === "ja" ? (l.name_ja || l.name) : l.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${l.active !== false ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {l.active !== false ? (lang === "ja" ? "表示中" : "Active") : (lang === "ja" ? "非表示" : "Hidden")}
                  </span>
                  <span className="text-[10px] tag-badge">{categoryLabel(l.category)}</span>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-0.5 hover:underline truncate max-w-[200px]">
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />{l.url}
                  </a>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => handleEdit(l)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl text-destructive hover:bg-destructive/10" onClick={() => handleDelete(l.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/**
 * Renders a small inline preview of a video URL.
 * Detects YouTube / Vimeo embeds and falls back to a native <video> player.
 */
function VideoPreview({ url }: { url: string }) {
  if (!url) return null;
  const videoType = inferVideoMimeType({ url });
  const [loadFailed, setLoadFailed] = useState(false);

  // YouTube
  const ytMatch =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/) ||
    url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
  if (ytMatch) {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${ytMatch[1]}`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        <iframe
          src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
          allow="autoplay; fullscreen"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="aspect-video w-full rounded-lg bg-black/95 text-white/80 flex flex-col items-center justify-center gap-2 px-4">
        <span className="text-sm text-center">Preview unavailable in this browser.</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2 text-white/70">
          Open video in new tab ↗
        </a>
      </div>
    );
  }

  // Direct video file — no crossOrigin so Supabase storage CORS doesn't block playback
  return (
    <video
      controls
      playsInline
      preload="metadata"
      onError={() => setLoadFailed(true)}
      className="w-full rounded-lg bg-black"
      style={{ maxHeight: "240px" }}
    >
      <source src={url} type={videoType} />
      <source src={url} />
    </video>
  );
}

/**
 * ImageField uploads files directly to Supabase Storage using a signed URL
 * obtained from /api/upload/signed.  The file bytes never pass through the
 * Vercel serverless function, so there is no 4.5 MB body-size limit to hit.
 */
function ImageField({
  label,
  value,
  onChange,
  hint,
  uploadLabel,
  folder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
  uploadLabel: string;
  folder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const { lang } = useTranslation();

  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-2 items-center">
        {uploading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span>
              {progress === null || progress === 0
                ? (lang === "ja" ? "準備中…" : "Preparing…")
                : progress >= 100
                  ? (lang === "ja" ? "完了処理中…" : "Finalizing…")
                  : `${progress}%`}
            </span>
          </div>
        ) : (
          <>
            <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors hover:bg-muted">
              {lang === "ja" ? "ファイルを選択" : "Choose File"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setProgress(0);
                  try {
                    // Step 1 — get a signed upload URL from the server
                    const signRes = await fetch("/api/upload/signed", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        folder: folder || "products",
                      }),
                    });
                    if (!signRes.ok) {
                      const j = await signRes.json().catch(() => ({}));
                      throw new Error(j?.error || `Upload setup failed (${signRes.status})`);
                    }
                    const signed = await signRes.json();

                    // Step 2 — PUT directly to Supabase (no Vercel body-size limit)
                    await new Promise<void>((resolve, reject) => {
                      const xhr = new XMLHttpRequest();
                      xhr.upload.addEventListener("progress", (ev) => {
                        if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
                      });
                      xhr.addEventListener("load", () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                          resolve();
                        } else {
                          let msg = `HTTP ${xhr.status}`;
                          try { const b = JSON.parse(xhr.responseText); msg = b?.error || b?.message || msg; } catch { /* ignore */ }
                          reject(new Error(msg));
                        }
                      });
                      xhr.addEventListener("error", () =>
                        reject(new Error(lang === "ja" ? "ネットワークエラー" : "Upload network error"))
                      );
                      // Use signedUrl returned by the Supabase SDK — it is the correct
                      // absolute URL and avoids any manual URL construction bugs.
                      xhr.open("PUT", signed.signedUrl);
                      xhr.setRequestHeader("Content-Type", signed.contentType || file.type);
                      xhr.send(file);
                    });

                    onChange(signed.publicUrl);
                  } catch (err: any) {
                    alert(
                      (lang === "ja" ? "アップロードに失敗しました:\n" : "Upload failed:\n") +
                      (err?.message || String(err))
                    );
                  } finally {
                    setUploading(false);
                    setProgress(null);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            <span className="text-xs text-muted-foreground">{uploadLabel}</span>
          </>
        )}
      </div>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
        className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm"
      />
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text", required, error }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; error?: string }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full h-11 px-4 rounded-lg border bg-background text-sm ${error ? "border-destructive ring-1 ring-destructive" : ""}`}
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// ── Scrolling Banner Manager ──────────────────────────────────────────────────
function BannerManager() {
  const { lang } = useTranslation();
  const [textEn, setTextEn] = useState("");
  const [textJa, setTextJa] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [speed, setSpeed] = useState(35);
  const [textColor, setTextColor] = useState<"red" | "black">("red");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/scrolling-banner")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setTextEn(d.text_en ?? "");
          setTextJa(d.text_ja ?? "");
          setIsActive(Boolean(d.is_active));
          setSpeed(d.speed ?? 35);
          setTextColor(d.text_color === "black" ? "black" : "red");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await authFetch("/api/scrolling-banner", {
        method: "PUT",
        body: JSON.stringify({ text_en: textEn, text_ja: textJa, is_active: isActive, speed, text_color: textColor }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } finally {
      setSaving(false);
    }
  };

  const isJa = lang === "ja";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          {isJa ? "スクロールバナー管理" : "Scrolling Banner"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isJa
            ? "ナビゲーションバー直下に表示される横スクロールテキストバナーを管理します。"
            : "Manage the horizontal scrolling text ticker shown directly below the navigation bar."}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground animate-pulse py-6 text-center">
          {isJa ? "読み込み中…" : "Loading…"}
        </p>
      ) : (
        <div className="space-y-5">
          {/* Active toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
            <div>
              <p className="font-medium text-sm">{isJa ? "バナーを表示する" : "Show Banner"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isJa ? "オフにするとバナーは非表示になります。" : "Toggle off to hide the banner sitewide."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive ? "bg-primary" : "bg-muted-foreground/30"
              }`}
              aria-pressed={isActive}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* English text */}
          <div>
            <label className="text-sm font-medium block mb-1.5">
              {isJa ? "英語テキスト" : "English Text"}
            </label>
            <textarea
              value={textEn}
              onChange={(e) => setTextEn(e.target.value)}
              rows={3}
              placeholder="Your Singapore F&B network — Sign up free to discover suppliers, jobs, marketplace & news"
              className="w-full px-4 py-3 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Japanese text */}
          <div>
            <label className="text-sm font-medium block mb-1.5">
              {isJa ? "日本語テキスト" : "Japanese Text"}
            </label>
            <textarea
              value={textJa}
              onChange={(e) => setTextJa(e.target.value)}
              rows={3}
              placeholder="シンガポール飲食ネットワーク — 無料登録でサプライヤー・求人・取引・ニュースを発見"
              className="w-full px-4 py-3 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Text color */}
          <div>
            <label className="text-sm font-medium block mb-1.5">
              {isJa ? "文字色" : "Text Color"}
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTextColor("red")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  textColor === "red"
                    ? "border-red-500 bg-red-50 text-red-600 shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-red-300"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-red-500 inline-block flex-shrink-0" />
                {isJa ? "赤" : "Red"}
              </button>
              <button
                type="button"
                onClick={() => setTextColor("black")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  textColor === "black"
                    ? "border-gray-800 bg-gray-50 text-gray-900 shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-gray-400"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-gray-900 inline-block flex-shrink-0" />
                {isJa ? "黒" : "Black"}
              </button>
            </div>
          </div>

          {/* Speed */}
          <div>
            <label className="text-sm font-medium block mb-1.5">
              {isJa ? `スクロール速度: ${speed}秒` : `Scroll Speed: ${speed}s`}
            </label>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{isJa ? "速い (10秒)" : "Fast (10s)"}</span>
              <span>{isJa ? "遅い (90秒)" : "Slow (90s)"}</span>
            </div>
          </div>

          {/* Preview */}
          {(textEn || textJa) && (
            <div>
              <p className="text-sm font-medium mb-2">{isJa ? "プレビュー" : "Preview"}</p>
              <div
                className="w-full overflow-hidden rounded-lg flex items-center border bg-white"
                style={{ height: "36px" }}
              >
                <div
                  className="inline-flex shrink-0"
                  style={{ animation: `marquee-scroll ${speed}s linear infinite`, willChange: "transform" }}
                >
                  {[0, 1].map((i) => (
                    <span
                      key={i}
                      className="text-[13px] font-medium tracking-wide whitespace-nowrap px-8"
                      style={{ color: textColor === "black" ? "#111111" : "#e53e3e" }}
                    >
                      {(isJa ? textJa : textEn) || (isJa ? textEn : textJa)}
                      &nbsp;&nbsp;&nbsp;—&nbsp;&nbsp;&nbsp;
                      {(isJa ? textJa : textEn) || (isJa ? textEn : textJa)}
                      &nbsp;&nbsp;&nbsp;—&nbsp;&nbsp;&nbsp;
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {isJa ? "保存中…" : "Saving…"}</>
            ) : saved ? (
              <><CheckCircle className="h-4 w-4" /> {isJa ? "保存しました！" : "Saved!"}</>
            ) : (
              <><Save className="h-4 w-4" /> {isJa ? "保存" : "Save"}</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Audit Log Viewer ─────────────────────────────────────────────────────────
function AuditLogViewer() {
  const { lang } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/admin/audit-log");
        if (!res.ok) {
          setError(lang === "ja" ? "ログの取得に失敗しました。" : "Failed to load audit log.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      } catch {
        setError(lang === "ja" ? "ネットワークエラーが発生しました。" : "Network error.");
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDt = (s: string) => {
    try {
      return new Date(s).toLocaleString(lang === "ja" ? "ja-JP" : "en-SG", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return s; }
  };

  type ActionMeta = { en: string; ja: string; color: string };
  const ACTION_META: Record<string, ActionMeta> = {
    delete_user: { en: "User deleted",     ja: "ユーザー削除",  color: "text-destructive" },
    update_user: { en: "User updated",     ja: "ユーザー更新",  color: "text-amber-600" },
    ban_user:    { en: "User suspended",   ja: "ユーザー停止",  color: "text-orange-500" },
    unban_user:  { en: "User reactivated", ja: "停止解除",      color: "text-green-600" },
    delete_marketplace_item: { en: "Marketplace listing removed", ja: "売買投稿の削除", color: "text-destructive" },
    delete_supplier: { en: "Supplier deleted", ja: "サプライヤー削除", color: "text-destructive" },
    delete_job_notice: { en: "Job notice deleted", ja: "求人の削除", color: "text-destructive" },
    delete_seeker_notice: { en: "Seeker notice deleted", ja: "求職の削除", color: "text-destructive" },
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-bold">{lang === "ja" ? "監査ログ" : "Audit Log"}</h2>
        {!loading && <span className="text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full font-medium">{logs.length}</span>}
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {lang === "ja" ? "管理者による操作履歴（最新200件）" : "Record of admin actions — last 200 entries"}
      </p>

      {loading && (
        <p className="text-sm text-muted-foreground text-center py-10 animate-pulse">
          {lang === "ja" ? "読み込み中…" : "Loading…"}
        </p>
      )}

      {!loading && error && (
        <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {!loading && !error && logs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">
          {lang === "ja" ? "ログがまだありません。" : "No audit log entries yet."}
        </p>
      )}

      {!loading && !error && logs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-3 px-3 font-semibold whitespace-nowrap">{lang === "ja" ? "日時" : "Time"}</th>
                <th className="text-left py-3 px-3 font-semibold">{lang === "ja" ? "操作" : "Action"}</th>
                <th className="text-left py-3 px-3 font-semibold hidden sm:table-cell">{lang === "ja" ? "対象" : "Target"}</th>
                <th className="text-left py-3 px-3 font-semibold hidden md:table-cell">{lang === "ja" ? "実施者" : "Admin"}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => {
                const meta: ActionMeta = ACTION_META[log.action] ?? { en: log.action, ja: log.action, color: "text-foreground" };
                const adminName = (log.admin as any)?.name || (log.admin as any)?.email || "—";
                return (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">{formatDt(log.created_at)}</td>
                    <td className={`py-2.5 px-3 text-xs font-semibold ${meta.color}`}>{lang === "ja" ? meta.ja : meta.en}</td>
                    <td className="py-2.5 px-3 text-xs hidden sm:table-cell break-all max-w-[220px]">{log.detail || log.target_id || "—"}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground hidden md:table-cell">{adminName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
