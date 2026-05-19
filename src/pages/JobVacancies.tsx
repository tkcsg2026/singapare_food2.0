"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Briefcase, CheckCircle2, ChevronDown, ChevronUp, ClipboardList,
  ListOrdered, MapPin, MessageCircle, RefreshCw, Plus, Trash2, User, X, Edit2,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { sanitizeWhatsAppDigits } from "@/lib/jobs-whatsapp";
import { getSupabase } from "@/lib/supabase";

type PostType = "job" | "seeker";
type EmploymentKey = "fullTime" | "partTime" | "contract" | "temp" | "intern";
type RoleKey = "kitchen" | "service" | "management" | "ops" | "delivery" | "other";
type RegionKey = "central" | "east" | "west" | "north" | "northEast" | "islandwide" | "other";
type CompensationKey =
  | "negotiate"
  | "range1800_2500"
  | "range2500_4000"
  | "range4000plus"
  | "commission"
  | "undisclosed";
type ExperienceKey = "entry" | "y1_2" | "y3_5" | "y5plus";
type EligibilityKey = "scPr" | "open" | "inDesc";

interface JobNotice {
  id: string;
  created_by?: string | null;
  post_type?: PostType;
  title: string;
  company?: string;
  employment?: string;
  role_category?: string;
  region?: string;
  compensation?: string;
  experience?: string;
  eligibility?: string;
  description?: string;
  image?: string;
  created_at: string;
  status: string;
}

const WA_MAX = 3800;
const HERO_IMAGE = "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1600&q=80";
/** Characters threshold AND line threshold — whichever is exceeded first shows Read more */
const SHORT_CHARS = 160;
const SHORT_LINES = 5;

function optLabel(record: Record<string, string>, key: string): string {
  return record[key] ?? key;
}

/** True when the text should be clipped — checks both character count and newline count */
function isLongText(text: string): boolean {
  if (text.length > SHORT_CHARS) return true;
  if (text.split("\n").length > SHORT_LINES) return true;
  return false;
}

/** Clip the text to SHORT_CHARS chars or SHORT_LINES lines, whichever comes first */
function clipText(text: string): string {
  const byChar = text.length > SHORT_CHARS ? `${text.slice(0, SHORT_CHARS)}…` : null;
  const lines = text.split("\n");
  const byLines =
    lines.length > SHORT_LINES ? `${lines.slice(0, SHORT_LINES).join("\n")}…` : null;
  if (byChar && byLines) return byChar.length < byLines.length ? byChar : byLines;
  return byChar ?? byLines ?? text;
}

// ── Card component ────────────────────────────────────────────────────────────
function JobListingCard({
  notice,
  j,
  phoneDigits,
  canDelete,
  canEdit,
  showAdminDelete,
  onDelete,
  onEdit,
  onAdminDelete,
}: {
  notice: JobNotice;
  j: ReturnType<typeof useTranslation>["t"]["jobs"];
  phoneDigits: string;
  canDelete: boolean;
  canEdit: boolean;
  showAdminDelete: boolean;
  onDelete: (id: string) => void;
  onEdit: (notice: JobNotice) => void;
  onAdminDelete: (id: string) => void;
}) {
  const deletePostBtnClass =
    "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-red-800/40 bg-red-600 text-black hover:bg-red-700 hover:text-black transition-colors";
  const [expanded, setExpanded] = useState(false);
  const desc = notice.description ?? "";
  const long = isLongText(desc);
  const isSeeker = notice.post_type === "seeker";

  const badges = [
    notice.employment ? optLabel(j.employmentOpts, notice.employment) : null,
    notice.region ? optLabel(j.regionOpts, notice.region) : null,
    notice.compensation ? optLabel(j.compensationOpts, notice.compensation) : null,
    notice.experience ? optLabel(j.experienceOpts, notice.experience) : null,
    notice.eligibility ? optLabel(j.eligibilityOpts, notice.eligibility) : null,
  ].filter(Boolean) as string[];

  const waText = [
    isSeeker ? "[F&B Portal — 求職者]" : `[${j.msgHeader}]`,
    `${j.msgTitle}: ${notice.title}`,
    notice.company ? `${j.msgCompany}: ${notice.company}` : null,
    `${j.msgType}: ${optLabel(j.employmentOpts, notice.employment ?? "")}`,
    `${j.msgCategory}: ${optLabel((j.roleOpts ?? {}) as Record<string, string>, notice.role_category ?? "")}`,
    `${j.msgRegion}: ${optLabel(j.regionOpts, notice.region ?? "")}`,
    `${j.msgPay}: ${optLabel(j.compensationOpts, notice.compensation ?? "")}`,
    "",
    desc,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-3 transition-shadow hover:shadow-md">
      {notice.image && !isSeeker && (
        <div className="w-full rounded-xl overflow-hidden">
          <img
            src={notice.image}
            alt={notice.company || notice.title}
            className="w-full h-40 object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="min-w-0">
          {isSeeker && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-400/25 text-blue-600 mb-1">
              <User className="h-2.5 w-2.5" />
              {j.seekerLabel ?? "求職者"}
            </span>
          )}
          <h3 className="font-bold text-base leading-snug truncate">{notice.title}</h3>
          {notice.company && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{notice.company}</p>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0 pt-0.5">
          {j.postedAt}: {new Date(notice.created_at).toLocaleDateString()}
        </span>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/8 border border-primary/15 text-primary"
            >
              {i === 0 && <Briefcase className="h-3 w-3 opacity-70" />}
              {i === 1 && <MapPin className="h-3 w-3 opacity-70" />}
              {b}
            </span>
          ))}
        </div>
      )}

      {desc && (
        <div className="text-sm text-muted-foreground leading-relaxed">
          <p className="whitespace-pre-wrap break-words">
            {expanded || !long ? desc : clipText(desc)}
          </p>
          {long && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {expanded ? (
                <><ChevronUp className="h-3.5 w-3.5" />{j.collapseDesc}</>
              ) : (
                <><ChevronDown className="h-3.5 w-3.5" />{j.expandDesc}</>
              )}
            </button>
          )}
        </div>
      )}

      {(phoneDigits.length >= 8 || canDelete || showAdminDelete) && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {phoneDigits.length >= 8 && (
            <a
              href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(waText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#1a9e4d] hover:bg-[#25D366]/20 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {isSeeker ? (j.contactSeekerWA ?? "WhatsApp で連絡") : j.applyViaWA}
            </a>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(notice)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5 shrink-0" />
              {j.myPostEdit ?? "Edit my post"}
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={() => onDelete(notice.id)} className={deletePostBtnClass}>
              <Trash2 className="h-3.5 w-3.5 shrink-0 text-black" />
              {j.myPostDelete ?? "Delete my post"}
            </button>
          )}
          {showAdminDelete && (
            <button type="button" onClick={() => onAdminDelete(notice.id)} className={deletePostBtnClass}>
              <Trash2 className="h-3.5 w-3.5 shrink-0 text-black" />
              {j.adminDeleteListing ?? "Remove listing (admin)"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Posting form (shared for job / seeker) ────────────────────────────────────
function PostForm({
  postType,
  j,
  initial,
  onSuccess,
  onClose,
}: {
  postType: PostType;
  j: ReturnType<typeof useTranslation>["t"]["jobs"];
  /** When provided, the form starts in *edit* mode and updates the row. */
  initial?: JobNotice | null;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const { lang } = useTranslation();
  const isSeeker = postType === "seeker";
  const isEdit = Boolean(initial?.id);

  // Pre-fill from `initial` when editing. Falls back to sensible defaults so
  // legacy rows missing one of the enum fields don't crash <Select>.
  const empOpts = j.employmentOpts as Record<string, string>;
  const roleOptsAll = j.roleOpts as Record<string, string>;
  const regionOpts = j.regionOpts as Record<string, string>;
  const compOpts = j.compensationOpts as Record<string, string>;
  const expOpts = j.experienceOpts as Record<string, string>;
  const eligOpts = j.eligibilityOpts as Record<string, string>;
  const safeKey = <T extends string>(value: string | undefined, opts: Record<string, string>, fallback: T): T =>
    (value && opts[value] ? value : fallback) as T;

  const [jobTitle, setJobTitle] = useState(initial?.title ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [employment, setEmployment] = useState<EmploymentKey>(
    safeKey<EmploymentKey>(initial?.employment, empOpts, "fullTime"),
  );
  const [roleCategory, setRoleCategory] = useState<RoleKey>(
    safeKey<RoleKey>(initial?.role_category, roleOptsAll, "kitchen"),
  );
  const [region, setRegion] = useState<RegionKey>(
    safeKey<RegionKey>(initial?.region, regionOpts, "islandwide"),
  );
  const [compensation, setCompensation] = useState<CompensationKey>(
    safeKey<CompensationKey>(initial?.compensation, compOpts, "negotiate"),
  );
  const [experience, setExperience] = useState<ExperienceKey>(
    safeKey<ExperienceKey>(initial?.experience, expOpts, "entry"),
  );
  const [eligibility, setEligibility] = useState<EligibilityKey>(
    safeKey<EligibilityKey>(initial?.eligibility, eligOpts, "open"),
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [imageUploading, setImageUploading] = useState(false);
  // In edit mode the user has already consented at original post time — skip
  // the checkbox so they can fix a typo without re-confirming consent.
  const [agreed, setAgreed] = useState(isEdit);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const lines = [
    isSeeker ? "[F&B Portal — 求職者]" : j.msgHeader,
    `${j.msgTitle}: ${jobTitle.trim() || "—"}`,
    company.trim() ? `${j.msgCompany}: ${company.trim()}` : null,
    `${j.msgType}: ${optLabel(j.employmentOpts, employment)}`,
    `${j.msgCategory}: ${optLabel(j.roleOpts, roleCategory)}`,
    `${j.msgRegion}: ${optLabel(j.regionOpts, region)}`,
    `${j.msgPay}: ${optLabel(j.compensationOpts, compensation)}`,
    `${j.msgExp}: ${optLabel(j.experienceOpts, experience)}`,
    `${j.msgEligibility}: ${optLabel(j.eligibilityOpts, eligibility)}`,
    "",
    `${j.msgBody}:`,
    description.trim() || "—",
  ].filter(Boolean) as string[];

  const rawMessage = lines.join("\n");
  const whatsappMessage =
    rawMessage.length <= WA_MAX ? rawMessage : `${rawMessage.slice(0, WA_MAX - 20)}\n\n[…]`;

  const canSendBase = jobTitle.trim().length > 0 && description.trim().length > 0;
  const canSend = canSendBase && agreed && !posting;

  const handlePost = async () => {
    if (!canSendBase || !agreed) return;
    setPosting(true);
    setPostError(null);
    try {
      const sb = getSupabase();
      const session = sb ? (await sb.auth.getSession()).data.session : null;
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        (headers as Record<string, string>).Authorization = `Bearer ${session.access_token}`;
      }
      const url = isEdit && initial?.id
        ? `/api/job-notices?id=${encodeURIComponent(initial.id)}`
        : "/api/job-notices";
      const payload: Record<string, unknown> = {
        post_type: postType,
        title: jobTitle,
        company,
        employment,
        roleCategory,
        region,
        compensation,
        experience,
        eligibility,
        description,
        image: isSeeker ? "" : image,
      };
      if (!isEdit) payload.agreed = true;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setPostError(j.postForbiddenNotAdmin ?? "Forbidden");
          return;
        }
        const errText = String((err as { error?: string })?.error ?? "");
        if (
          err?.code === "JOB_NOTICES_NOT_READY" ||
          /job_notices|schema cache/i.test(errText)
        ) {
          setPostError(j.postSetupPending);
        } else {
          setPostError(err?.error ?? j.postFailed);
        }
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setPostError(j.postFailed);
    } finally {
      setPosting(false);
    }
  };

  const titleLabel = isSeeker
    ? (lang === "ja" ? "希望職種・スキル名" : "Desired role / skills")
    : j.jobTitle;
  const titlePh = isSeeker
    ? (lang === "ja" ? "例: ホールスタッフ、調理補助" : "e.g. Service staff, Kitchen helper")
    : j.jobTitlePh;
  const descLabel = isSeeker
    ? (lang === "ja" ? "自己PR・希望条件" : "About me & requirements")
    : j.description;
  const descPh = isSeeker
    ? (lang === "ja"
        ? "経験、語学力、希望勤務時間・エリア、ビザ種別など"
        : "Experience, languages, preferred hours/area, visa type, etc.")
    : j.descriptionPh;
  const cardTitle = isEdit
    ? (lang === "ja"
        ? (isSeeker ? "求職者情報を編集" : "投稿を編集")
        : (isSeeker ? "Edit seeker post" : "Edit posting"))
    : isSeeker
      ? (lang === "ja" ? "求職者情報フォーム" : "Job seeker form")
      : j.formCardTitle;

  return (
    <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
      <CardHeader className="border-b border-border bg-muted/30 pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl font-black tracking-tight">{cardTitle}</CardTitle>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label={lang === "ja" ? "閉じる" : "Close"}
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-5 sm:p-7 space-y-5 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="form-title">{titleLabel}</Label>
            <Input
              id="form-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder={titlePh}
              className="min-h-[44px] rounded-xl bg-background"
            />
          </div>
          {!isSeeker && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="form-company">{j.company}</Label>
              <Input
                id="form-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={j.companyPh}
                className="min-h-[44px] rounded-xl bg-background"
              />
            </div>
          )}
          {!isSeeker && (
            <div className="space-y-2 sm:col-span-2">
              <Label>{lang === "ja" ? "企業ロゴ / 画像（任意）" : "Company Logo / Image (optional)"}</Label>
              <div className="flex flex-wrap gap-2 items-center">
                {imageUploading ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                    {lang === "ja" ? "アップロード中…" : "Uploading…"}
                  </span>
                ) : (
                  <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors hover:bg-muted">
                    {lang === "ja" ? "画像を選択" : "Choose Image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setImageUploading(true);
                        try {
                          const signRes = await fetch("/api/upload/signed", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              fileName: file.name,
                              fileType: file.type,
                              fileSize: file.size,
                              folder: "jobs",
                            }),
                          });
                          if (!signRes.ok) throw new Error("Upload failed");
                          const signed = await signRes.json();
                          await fetch(signed.signedUrl, {
                            method: "PUT",
                            headers: { "Content-Type": signed.contentType },
                            body: file,
                          });
                          setImage(signed.publicUrl);
                        } catch {
                          alert(lang === "ja" ? "画像のアップロードに失敗しました。" : "Image upload failed.");
                        } finally {
                          setImageUploading(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                )}
                {image && (
                  <div className="flex items-center gap-2">
                    <img src={image} alt="" className="h-14 w-14 rounded-lg object-cover border" referrerPolicy="no-referrer" />
                    <button
                      type="button"
                      onClick={() => setImage("")}
                      className="text-xs text-destructive hover:underline"
                    >
                      {lang === "ja" ? "削除" : "Remove"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{j.employment}</Label>
            <Select value={employment} onValueChange={(v) => setEmployment(v as EmploymentKey)}>
              <SelectTrigger className="min-h-[44px] rounded-xl bg-background">
                <SelectValue placeholder={j.selectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(j.employmentOpts) as EmploymentKey[]).map((k) => (
                  <SelectItem key={k} value={k}>{j.employmentOpts[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{j.roleCategory}</Label>
            <Select value={roleCategory} onValueChange={(v) => setRoleCategory(v as RoleKey)}>
              <SelectTrigger className="min-h-[44px] rounded-xl bg-background">
                <SelectValue placeholder={j.selectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(j.roleOpts) as RoleKey[]).map((k) => (
                  <SelectItem key={k} value={k}>{j.roleOpts[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{j.region}</Label>
            <Select value={region} onValueChange={(v) => setRegion(v as RegionKey)}>
              <SelectTrigger className="min-h-[44px] rounded-xl bg-background">
                <SelectValue placeholder={j.selectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(j.regionOpts) as RegionKey[]).map((k) => (
                  <SelectItem key={k} value={k}>{j.regionOpts[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{j.compensation}</Label>
            <Select value={compensation} onValueChange={(v) => setCompensation(v as CompensationKey)}>
              <SelectTrigger className="min-h-[44px] rounded-xl bg-background">
                <SelectValue placeholder={j.selectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(j.compensationOpts) as CompensationKey[]).map((k) => (
                  <SelectItem key={k} value={k}>{j.compensationOpts[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{j.experience}</Label>
            <Select value={experience} onValueChange={(v) => setExperience(v as ExperienceKey)}>
              <SelectTrigger className="min-h-[44px] rounded-xl bg-background">
                <SelectValue placeholder={j.selectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(j.experienceOpts) as ExperienceKey[]).map((k) => (
                  <SelectItem key={k} value={k}>{j.experienceOpts[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{j.eligibility}</Label>
            <Select value={eligibility} onValueChange={(v) => setEligibility(v as EligibilityKey)}>
              <SelectTrigger className="min-h-[44px] rounded-xl bg-background">
                <SelectValue placeholder={j.selectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(j.eligibilityOpts) as EligibilityKey[]).map((k) => (
                  <SelectItem key={k} value={k}>{j.eligibilityOpts[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="form-desc">{descLabel}</Label>
          <Textarea
            id="form-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={descPh}
            rows={6}
            className="rounded-xl bg-background resize-y min-h-[140px]"
          />
        </div>

        <div className="rounded-xl border border-border bg-muted/25 p-4 space-y-2">
          <p className="text-xs font-semibold text-foreground">{j.preview}</p>
          <pre className="text-[11px] sm:text-xs whitespace-pre-wrap break-words rounded-lg bg-background border border-border p-3 max-h-44 overflow-y-auto text-muted-foreground">
            {whatsappMessage}
          </pre>
          <p className="text-[11px] text-muted-foreground">{j.previewHelp}</p>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          {!isEdit && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <span className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {j.consentText}
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground font-medium">{j.consentHint}</p>
            </div>
          )}

          {canSendBase ? (
            <Button
              onClick={handlePost}
              disabled={!canSend}
              className="w-full rounded-xl min-h-[44px] font-bold"
            >
              {posting
                ? (isEdit ? (lang === "ja" ? "更新中…" : "Updating…") : j.posting)
                : (isEdit ? (lang === "ja" ? "更新する" : "Save changes") : j.postAndSend)}
            </Button>
          ) : (
            <div className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-dashed border-muted-foreground/35 bg-muted/30 px-4 text-sm text-muted-foreground text-center">
              {j.requiredHint}
            </div>
          )}

          {postError && (
            <div className="text-sm text-destructive font-medium">{postError}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function JobVacancies() {
  const { t, lang } = useTranslation();
  const j = t.jobs;
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [activeTab, setActiveTab] = useState<PostType>("job");
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<PostType>("job");
  /** When set, the form opens in *edit* mode for this notice. */
  const [editingNotice, setEditingNotice] = useState<JobNotice | null>(null);
  const [postSuccess, setPostSuccess] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  const [phoneDigits, setPhoneDigits] = useState(() =>
    sanitizeWhatsAppDigits(process.env.NEXT_PUBLIC_JOBS_WHATSAPP ?? "")
  );
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [listings, setListings] = useState<JobNotice[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  /** false = API reports job_notices missing / schema cache; true = OK; null = not checked yet */
  const [jobNoticesDbReady, setJobNoticesDbReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => {
      if (!cancelled) setCurrentUserId(data.user?.id || "");
    }).catch(() => {});
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setCurrentUserId(session?.user?.id || "");
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings?key=jobs_whatsapp")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const v = typeof d?.value === "string" ? d.value : "";
        const digits = sanitizeWhatsAppDigits(v);
        if (digits) setPhoneDigits(digits);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const fetchListings = useCallback(async () => {
    setListingsLoading(true);
    try {
      const res = await fetch("/api/job-notices?limit=50");
      const payload = await res.json().catch(() => null);
      if (res.ok && Array.isArray(payload)) {
        setJobNoticesDbReady(true);
        setListings(payload);
      } else if (
        !res.ok &&
        payload &&
        typeof payload === "object" &&
        (payload as { code?: string }).code === "JOB_NOTICES_NOT_READY"
      ) {
        setJobNoticesDbReady(false);
        setListings([]);
      } else {
        setJobNoticesDbReady(true);
        setListings(Array.isArray(payload) ? payload : []);
      }
    } catch {
      setListings([]);
      setJobNoticesDbReady(true);
    } finally {
      setListingsLoading(false);
    }
  }, []);

  const handleDeleteListing = useCallback(
    async (id: string, mode: "owner" | "admin") => {
      if (!id) return;
      const confirmMsg =
        mode === "admin"
          ? (j.adminDeleteConfirm ?? "Remove this listing?")
          : lang === "ja"
            ? "この投稿を削除しますか？"
            : "Delete this post?";
      if (!window.confirm(confirmMsg)) return;
      try {
        const sb = getSupabase();
        const session = sb ? (await sb.auth.getSession()).data.session : null;
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (session?.access_token) {
          (headers as Record<string, string>).Authorization = `Bearer ${session.access_token}`;
        }
        const res = await fetch(`/api/job-notices?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers,
          body: JSON.stringify({
            reason: mode === "admin" ? "Deleted by administrator" : "Deleted by poster",
          }),
        });
        if (res.ok) {
          await fetchListings();
        } else {
          const err = await res.json().catch(() => ({}));
          const msg =
            err?.error ??
            (lang === "ja"
              ? "削除できませんでした。ログイン状態をご確認ください。"
              : "Could not delete. Check that you are logged in and allowed to remove this listing.");
          window.alert(msg);
        }
      } catch {
        window.alert(lang === "ja" ? "削除に失敗しました。" : "Delete failed.");
      }
    },
    [fetchListings, j.adminDeleteConfirm, lang]
  );

  useEffect(() => { fetchListings(); }, [fetchListings]);

  useEffect(() => {
    if (!currentUserId && showForm) setShowForm(false);
  }, [currentUserId, showForm]);

  useEffect(() => {
    if (!postSuccess) return;
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setPostSuccess(false);
      toastTimerRef.current = null;
    }, 7000);
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [postSuccess]);

  const openForm = (type: PostType) => {
    setEditingNotice(null);
    setFormType(type);
    setShowForm(true);
  };

  const openEditForm = (notice: JobNotice) => {
    const type: PostType = notice.post_type === "seeker" ? "seeker" : "job";
    setEditingNotice(notice);
    setFormType(type);
    setShowForm(true);
  };

  const steps = [
    { n: 1, text: j.step1 },
    { n: 2, text: j.step2 },
    { n: 3, text: j.step3 },
  ];

  // Tab-filtered listings. Treat missing post_type as "job" for legacy entries.
  const tabListings = useMemo(
    () => listings.filter((l) => (l.post_type ?? "job") === activeTab),
    [listings, activeTab]
  );

  const jobCount = useMemo(
    () => listings.filter((l) => (l.post_type ?? "job") === "job").length,
    [listings]
  );
  const seekerCount = useMemo(
    () => listings.filter((l) => l.post_type === "seeker").length,
    [listings]
  );

  return (
    <Layout>
      {postSuccess && (
        <div className="fixed top-4 left-1/2 z-50 w-[min(92vw,760px)] -translate-x-1/2">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-medium shadow-lg">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>{j.postSuccess ?? "✅ 投稿されました。"}</span>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
        <div className="relative container max-w-6xl py-10 md:py-14 text-white min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/85 hover:text-white mb-6 font-medium"
          >
            <ArrowLeft className="h-4 w-4 flex-shrink-0" />
            <span className="min-w-0">{t.contact.backHome}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm border border-white/20">
              <ClipboardList className="h-3.5 w-3.5" />
              {j.bulletinLabel}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight max-w-3xl drop-shadow-sm">
            {j.pageTitle}
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/90 max-w-2xl leading-relaxed">
            {j.pageSubtitle}
          </p>
        </div>
      </section>

      {/* Post buttons — any logged-in user can post */}
      <div className="border-b border-border bg-muted/30">
        <div className="container max-w-6xl py-4 flex flex-wrap gap-3 items-center">
          {currentUserId ? (
            <>
              <Button
                onClick={() => openForm("job")}
                className="rounded-xl gap-2 font-bold min-h-[44px]"
              >
                <Plus className="h-4 w-4" />
                {lang === "ja" ? "求人を投稿する" : "Post a Job"}
              </Button>
              <Button
                variant="outline"
                onClick={() => openForm("seeker")}
                className="rounded-xl gap-2 font-bold min-h-[44px]"
              >
                <User className="h-4 w-4" />
                {lang === "ja" ? "求職者として投稿する" : "Post as Job Seeker"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
              {j.postingAdminOnly}
            </p>
          )}
        </div>
      </div>

      {/* How it works — permanent info section */}
      <div className="border-b border-border bg-muted/10">
        <div className="container max-w-6xl py-5 min-w-0">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ListOrdered className="h-3.5 w-3.5" />
            {j.howItWorks}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {steps.map(({ n, text }) => (
              <div key={n} className="flex gap-2.5 items-start">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary border border-primary/15">
                  {n}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">{text}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground border-l-4 border-primary/30 pl-3">
            {j.disclaimer}
          </p>
        </div>
      </div>

      {/* Form modal */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditingNotice(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-0 rounded-2xl [&>button:last-child]:hidden">
          <DialogTitle className="sr-only">
            {editingNotice
              ? (lang === "ja" ? "投稿を編集" : "Edit posting")
              : formType === "seeker"
                ? (lang === "ja" ? "求職者情報フォーム" : "Job seeker form")
                : (lang === "ja" ? "求人投稿フォーム" : "Post a Job")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {lang === "ja" ? "必要情報を入力して投稿してください" : "Fill in the required information and submit"}
          </DialogDescription>
          <PostForm
            postType={formType}
            j={j}
            initial={editingNotice}
            onSuccess={() => {
              if (!editingNotice) setPostSuccess(true);
              fetchListings();
            }}
            onClose={() => {
              setShowForm(false);
              setEditingNotice(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Listings (tabbed) ─────────────────────────────────────────────── */}
      <section className="container max-w-6xl py-10 md:py-14 min-w-0 w-full">
        {jobNoticesDbReady === false && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <p className="font-semibold leading-snug">{j.jobBoardDbBanner}</p>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex items-center gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab("job")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors whitespace-nowrap -mb-px ${activeTab === "job" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Briefcase className="h-4 w-4" />
            {lang === "ja" ? "求人" : "Job Listings"}
            <span className="ml-1 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{jobCount}</span>
          </button>
          <button
            onClick={() => setActiveTab("seeker")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors whitespace-nowrap -mb-px ${activeTab === "seeker" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <User className="h-4 w-4" />
            {lang === "ja" ? "求職者" : "Job Seekers"}
            <span className="ml-1 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{seekerCount}</span>
          </button>
          <div className="ml-auto">
            <button
              onClick={fetchListings}
              disabled={listingsLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${listingsLoading ? "animate-spin" : ""}`} />
              {listingsLoading ? t.common.loading : (t.admin?.jobsRefresh ?? "Refresh")}
            </button>
          </div>
        </div>

        {listingsLoading && tabListings.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="flex gap-2">
                  <div className="h-5 bg-muted rounded-full w-20" />
                  <div className="h-5 bg-muted rounded-full w-16" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-2.5 bg-muted rounded w-full" />
                  <div className="h-2.5 bg-muted rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : tabListings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
            {activeTab === "seeker"
              ? (lang === "ja" ? "現在掲載中の求職者情報はありません。" : "No job seekers listed at the moment.")
              : j.noListings}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tabListings.map((notice) => {
                const isOwner = Boolean(
                  currentUserId && notice.created_by === currentUserId
                );
                // Admins see admin-delete on every post; regular users see owner-delete only on their own
                const canOwnerDelete = !isAdmin && isOwner;
                const showAdminDelete = Boolean(isAdmin);
                // Edit is allowed for the owner (regular user) and for admins
                // moderating any post.
                const canEdit = Boolean(isOwner || isAdmin);
                return (
                  <JobListingCard
                    key={notice.id}
                    notice={notice}
                    j={j}
                    phoneDigits={phoneDigits}
                    canDelete={canOwnerDelete}
                    canEdit={canEdit}
                    showAdminDelete={showAdminDelete}
                    onDelete={(id) => handleDeleteListing(id, "owner")}
                    onEdit={openEditForm}
                    onAdminDelete={(id) => handleDeleteListing(id, "admin")}
                  />
                );
              })}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">{j.listingsNote}</p>
          </>
        )}
      </section>
    </Layout>
  );
}
