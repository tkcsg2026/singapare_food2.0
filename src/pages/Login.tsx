"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Mail, RefreshCw, UtensilsCrossed, KeyRound } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const { signIn, resendConfirmationEmail } = useAuth();
  const { t, lang } = useTranslation();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmailNotConfirmed(false);
    setLoading(true);

    const { error: err } = await signIn(email, password);
    setLoading(false);

    if (err === "EMAIL_NOT_CONFIRMED") {
      setEmailNotConfirmed(true);
      return;
    }

    if (err === "BANNED") {
      setError(lang === "ja"
        ? "このアカウントは停止されています。管理者にお問い合わせください。"
        : "This account has been suspended. Please contact support.");
      return;
    }

    if (err) {
      setError(err);
      return;
    }

    const sb = getSupabase();
    if (sb) {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        const { data: prof } = await sb
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (prof?.role === "admin") {
          router.push("/admin-dashboard");
          return;
        }
      }
    }
    router.push("/dashboard");
  };

  const handleResend = async () => {
    setResendLoading(true);
    const { error: err } = await resendConfirmationEmail(email);
    setResendLoading(false);
    if (err) {
      setError(`${t.login.resendError}${err}`);
    } else {
      setResendSent(true);
    }
  };

  return (
    <Layout>
      <div className="container max-w-md py-8 sm:py-12 md:py-16">
        <div className="bg-card border p-4 sm:p-6 md:p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
              <UtensilsCrossed className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">{t.login.title}</h1>
            <p className="text-sm text-muted-foreground mt-2">{t.login.subtitle}</p>
          </div>

          {emailNotConfirmed && (
            <div className="mb-4 p-4 rounded-xl bg-primary/10 border border-primary/30 text-foreground text-sm space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <Mail className="h-4 w-4" />
                {t.login.emailNotConfirmedTitle}
              </div>
              <p>{t.login.emailNotConfirmedBody}</p>
              {resendSent ? (
                <p className="text-primary font-medium">{t.login.resendSent}</p>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
                  onClick={handleResend}
                  disabled={resendLoading || !email}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${resendLoading ? "animate-spin" : ""}`} />
                  {t.login.resendButton}
                </Button>
              )}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.login.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full min-h-[44px] h-11 px-4 rounded-lg border bg-background text-base sm:text-sm"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">{t.login.password}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[44px] h-11 px-4 rounded-lg border bg-background text-base sm:text-sm"
                required
              />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl font-bold" disabled={loading}>
              {loading ? t.login.submitting : t.login.submit}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/reset-password" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
              <KeyRound className="h-3.5 w-3.5" />
              {t.login.forgotPassword}
            </Link>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-4">
            {t.login.noAccount}{" "}
            <Link href="/register" className="text-primary hover:underline font-medium">
              {t.login.register}
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Login;
