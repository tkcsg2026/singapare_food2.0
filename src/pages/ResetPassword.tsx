"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  Mail, KeyRound, CheckCircle2, ArrowLeft, AlertTriangle,
  Eye, EyeOff, Send, Lock, ShieldCheck,
} from "lucide-react";

type Mode = "request" | "verifying" | "update" | "done" | "invalid";

/* Derive a simple 0-4 strength score for a password */
function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_LABEL_EN = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_LABEL_JA = ["", "弱い", "まあまあ", "良い", "強い"];
const STRENGTH_COLOR  = [
  "", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-green-500",
];

const ResetPassword = () => {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const strength = passwordStrength(password);
  const strengthLabel = lang === "ja" ? STRENGTH_LABEL_JA[strength] : STRENGTH_LABEL_EN[strength];
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordsMismatch = confirm.length > 0 && password !== confirm;

  /* Cooldown timer after rate-limit */
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setInterval(() => setCooldownSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldownSeconds]);

  /* When showing "Set Password", re-verify session after a delay (handles
     browser back / manual refresh — but must not race with PASSWORD_RECOVERY). */
  useEffect(() => {
    if (mode !== "update") return;
    const sb = getSupabase();
    if (!sb) return;
    const id = setTimeout(() => {
      sb.auth.getSession().then(({ data: { session } }) => {
        if (!session) setMode("invalid");
      });
    }, 3000);
    return () => clearTimeout(id);
  }, [mode]);

  /* Detect password-recovery session from Supabase redirect or server-side confirm */
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    const hash   = typeof window !== "undefined" ? window.location.hash : "";
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const code   = params?.get("code");

    const clearUrl = () => {
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", window.location.pathname);
      }
    };

    // ── Subscribe FIRST so we never miss events ──────────────────────────
    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        clearUrl();
        setMode("update");
      }
    });

    // ── Supabase error in hash (e.g. otp_expired) ────────────────────────
    if (hash.includes("error=")) {
      clearUrl();
      setMode("invalid");
      return () => subscription.unsubscribe();
    }

    // ── Server-side confirm flow: session set by /api/auth/confirm-reset ──
    // No hash, no code — check if we already have a recovery session (from cookies).
    if (!hash && !code) {
      sb.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setMode("update");
        }
      });
      return () => subscription.unsubscribe();
    }

    // ── Implicit flow: token in URL hash ─────────────────────────────────
    // Do NOT clear URL or set "update" here. Wait for PASSWORD_RECOVERY so session is established.
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setMode("verifying");
      // Fallback: if listener already fired before we subscribed, check session after a short delay.
      const fallback = setTimeout(() => {
        sb.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            clearUrl();
            setMode("update");
          }
        });
      }, 1500);
      return () => {
        clearTimeout(fallback);
        subscription.unsubscribe();
      };
    }

    // ── PKCE flow: ?code= in query string ────────────────────────────────
    if (code) {
      setMode("verifying");

      // Supabase may have auto-exchanged the code already during client init.
      // Check for an existing session first to avoid a "code already used" error.
      sb.auth.getSession().then(({ data: { session: existingSession } }) => {
        if (existingSession) {
          // Auto-exchange succeeded — session is already established.
          clearUrl();
          setMode("update");
          return;
        }

        // No session yet — exchange the code manually. Clear URL only after session is confirmed.
        sb.auth.exchangeCodeForSession(code)
          .then(({ data, error: err }) => {
            if (data.session) {
              clearUrl();
              setMode("update");
            } else if (err) {
              clearUrl();
              // Exchange failed — check one more time (race with auth listener)
              sb.auth.getSession().then(({ data: { session } }) => {
                setMode(session ? "update" : "invalid");
              });
            } else {
              clearUrl();
              setMode("invalid");
            }
          })
          .catch(() => {
            clearUrl();
            // Last resort: maybe the listener already set up the session
            sb.auth.getSession().then(({ data: { session } }) => {
              setMode(session ? "update" : "invalid");
            });
          });
      });

      return () => subscription.unsubscribe();
    }

    return () => subscription.unsubscribe();
  }, []);

  /* ── Step 1: send reset email via custom SMTP (bypasses Supabase rate limits) */
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setLoading(false);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || "Failed to send email. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setLoading(false);
      setError("Network error. Please check your connection and try again.");
    }
  };

  /* ── Step 3: set new password ─────────────────────────────────────────── */
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t.register.errorPasswordMismatch);
      return;
    }
    if (password.length < 8) {
      setError(t.reset.passwordTooShort);
      return;
    }
    setLoading(true);
    const sb = getSupabase();
    if (!sb) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const { error: err } = await sb.auth.updateUser({ password });
    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }

    // Password updated — session stays active, redirect straight to dashboard.
    setLoading(false);
    setMode("done");
  };

  /* ── Step indicator ─────────────────────────────────────────────────── */
  const StepBar = () => {
    // 0 = Enter Email active, 1 = Set Password active, 3 = all done
    const step = mode === "done" ? 3 : mode === "update" ? 1 : 0;
    const steps = lang === "ja"
      ? ["メール入力", "パスワード設定", "完了"]
      : ["Enter Email", "Set Password", "Done"];
    return (
      <div className="flex items-center justify-center gap-1 mb-8">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`flex flex-col items-center gap-0.5`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-[10px] hidden sm:block ${i <= step ? "text-primary font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 mb-3 rounded-full ${i < step ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="container max-w-md py-8 sm:py-16">
        <div className="bg-card border p-6 sm:p-8 rounded-2xl shadow-sm">

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div className="text-center mb-6">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4
              ${mode === "done" ? "bg-green-500" : mode === "invalid" ? "bg-destructive" : "bg-primary"}`}>
              {mode === "done"
                ? <CheckCircle2 className="h-6 w-6 text-white" />
                : mode === "invalid"
                  ? <AlertTriangle className="h-6 w-6 text-white" />
                  : mode === "update"
                    ? <Lock className="h-6 w-6 text-primary-foreground" />
                    : <KeyRound className="h-6 w-6 text-primary-foreground" />
              }
            </div>
            <h1 className="text-2xl font-bold">
              {mode === "update" ? t.reset.newPasswordTitle
                : mode === "done" ? t.reset.doneTitle
                : mode === "invalid" ? t.reset.invalidTitle
                : t.reset.title}
            </h1>
            {mode !== "invalid" && mode !== "verifying" && mode !== "done" && (
              <p className="text-sm text-muted-foreground mt-2">
                {mode === "update" ? t.reset.newPasswordSubtitle : t.reset.subtitle}
              </p>
            )}
          </div>

          {/* ── Step bar ─────────────────────────────────────────────────── */}
          {(mode === "request" || mode === "update" || mode === "done") && <StepBar />}

          {/* ── Error banner ─────────────────────────────────────────────── */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Verifying ────────────────────────────────────────────────── */}
          {mode === "verifying" && (
            <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p>{t.reset.verifying}</p>
            </div>
          )}

          {/* ── Invalid / expired link ───────────────────────────────────── */}
          {mode === "invalid" && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">{t.reset.invalidBody}</p>
              <Button
                className="w-full h-11 rounded-xl font-bold"
                onClick={() => { setError(""); setSent(false); setMode("request"); }}
              >
                {t.reset.requestNewLink}
              </Button>
            </div>
          )}

          {/* ── Step 1: enter email ──────────────────────────────────────── */}
          {mode === "request" && !sent && (
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">{t.login.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full h-11 px-4 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                  autoComplete="email"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2"
                disabled={loading || cooldownSeconds > 0}
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t.reset.sending}</>
                  : cooldownSeconds > 0
                    ? t.reset.tryAgainIn.replace("{seconds}", String(cooldownSeconds))
                    : <><Send className="h-4 w-4" />{t.reset.sendButton}</>}
              </Button>
            </form>
          )}

          {/* ── Step 2: email sent ───────────────────────────────────────── */}
          {mode === "request" && sent && (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-primary font-semibold">
                  <Mail className="h-5 w-5" />
                  <span>{t.reset.sentTitle}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t.reset.sentBody.replace("{email}", email)}
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 space-y-1.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground text-sm">
                  {lang === "ja" ? "メールが届かない場合" : "Didn't receive the email?"}
                </p>
                <p>• {lang === "ja" ? "迷惑メールフォルダをご確認ください" : "Check your spam / junk folder"}</p>
                <p>• {lang === "ja" ? "数分かかる場合があります" : "It may take a few minutes to arrive"}</p>
                <p>• {lang === "ja" ? "登録済みのメールアドレスか確認してください" : "Make sure you used your registered email address"}</p>
              </div>
              <button
                type="button"
                onClick={() => { setSent(false); setEmail(""); setError(""); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
              >
                {lang === "ja" ? "別のメールアドレスで再試行" : "Try a different email address"}
              </button>
            </div>
          )}

          {/* ── Step 3: set new password ─────────────────────────────────── */}
          {mode === "update" && (
            <form onSubmit={handleUpdate} className="space-y-4">
              {/* New password */}
              <div>
                <label className="text-sm font-medium block mb-1.5">{t.reset.newPassword}</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={lang === "ja" ? "8文字以上" : "8 characters or more"}
                    className="w-full h-11 px-4 pr-11 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors
                          ${strength >= i ? STRENGTH_COLOR[strength] : "bg-muted"}`} />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lang === "ja" ? "強度: " : "Strength: "}
                      <span className={`font-medium ${
                        strength <= 1 ? "text-red-500" :
                        strength === 2 ? "text-orange-400" :
                        strength === 3 ? "text-yellow-500" : "text-green-500"
                      }`}>{strengthLabel}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="text-sm font-medium block mb-1.5">{t.reset.confirmPassword}</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full h-11 px-4 pr-11 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 transition-colors
                      ${passwordsMatch ? "border-green-400 focus:ring-green-400/50"
                        : passwordsMismatch ? "border-red-400 focus:ring-red-400/50"
                        : "focus:ring-primary/50"}`}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordsMatch && (
                  <p className="mt-1 text-xs text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {lang === "ja" ? "パスワードが一致しています" : "Passwords match"}
                  </p>
                )}
                {passwordsMismatch && (
                  <p className="mt-1 text-xs text-red-500">
                    {lang === "ja" ? "パスワードが一致していません" : "Passwords do not match"}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2"
                disabled={loading || !password || !confirm || passwordsMismatch}
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t.reset.updating}</>
                  : <><ShieldCheck className="h-4 w-4" />{t.reset.updateButton}</>}
              </Button>
            </form>
          )}

          {/* ── Done ─────────────────────────────────────────────────────── */}
          {mode === "done" && (
            <div className="text-center space-y-5">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5 space-y-2">
                <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="font-semibold">{t.reset.doneTitle}</p>
                </div>
                <p className="text-sm text-muted-foreground">{t.reset.doneBody}</p>
              </div>
              <Button
                className="w-full h-11 rounded-xl font-bold"
                onClick={() => router.push("/dashboard")}
              >
                {t.reset.goToDashboard}
              </Button>
            </div>
          )}

          {/* ── Back to login ─────────────────────────────────────────────── */}
          {(mode === "request" || mode === "invalid") && (
            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t.reset.backToLogin}
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ResetPassword;
