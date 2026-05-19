"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Camera, User, Mail, CheckCircle2, Sparkles } from "lucide-react";

const Register = () => {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { signUp } = useAuth();
  const { t, lang } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(t.register.avatarError);
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t.register.errorPasswordMismatch);
      return;
    }
    if (username.length < 3) {
      setError(t.register.errorUsernameTooShort);
      return;
    }

    setLoading(true);
    const result = await signUp({ email, password, name, username, avatarFile });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.needsEmailConfirmation) {
      setWaitingForConfirmation(true);
    } else {
      router.push("/dashboard");
    }
  };

  // ── Confirmation-pending screen ──────────────────────────────────────────
  if (waitingForConfirmation) {
    return (
      <Layout>
        <section className="min-h-[calc(100vh-12rem)] flex items-center justify-center px-4 py-12 sm:py-16">
          <div
            className={`w-full max-w-md transition-all duration-500 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="bg-card/95 backdrop-blur-md border border-border/60 p-6 sm:p-10 shadow-xl shadow-black/5 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-float-subtle">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words-safe">
                {t.register.confirmationSentTitle}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed break-words-safe">
                {t.register.confirmationSentBody.replace("{email}", email)}
              </p>
              <div className="rounded-xl bg-muted/80 p-4 text-xs sm:text-sm text-left space-y-1.5 text-muted-foreground break-words-safe">
                <p className="font-semibold text-foreground">{t.register.confirmationTips}</p>
                <p>{t.register.confirmationTip1}</p>
                <p>{t.register.confirmationTip2}</p>
              </div>
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl font-medium transition-all duration-200 hover:bg-muted"
                onClick={() => router.push("/login")}
              >
                {t.register.goToLogin}
              </Button>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  // ── Registration form ────────────────────────────────────────────────────
  const stagger = "animate-fade-in-up opacity-0-init";
  return (
    <Layout>
      <section className="min-h-[calc(100vh-12rem)] flex items-center justify-center px-4 py-8 sm:py-12 lg:py-16">
        {/* Decorative background — fashion editorial feel */}
        <div
          className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
          aria-hidden
        >
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/[0.03]" />
          <div className="absolute top-0 right-0 w-[80vmin] h-[80vmin] rounded-full bg-primary/[0.04] blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[60vmin] h-[60vmin] rounded-full bg-primary/[0.03] blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="w-full max-w-[26rem] sm:max-w-md">
          {/* Card */}
          <div
            className={`bg-card/95 backdrop-blur-md border border-border/60 shadow-xl shadow-black/5 overflow-hidden transition-all duration-500 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="p-6 sm:p-8 md:p-10">
              {/* Header */}
              <div className="text-center mb-6 sm:mb-8">
                <div
                  className={`inline-flex w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 sm:mb-5 shadow-lg shadow-primary/25 ${stagger} animate-stagger-1`}
                >
                  <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-primary-foreground" />
                </div>
                <h1
                  className={`text-2xl sm:text-3xl font-bold tracking-tight text-foreground break-words-safe ${stagger} animate-stagger-2`}
                >
                  {t.register.title}
                </h1>
                <p
                  className={`text-sm text-muted-foreground mt-1.5 sm:mt-2 break-words-safe ${stagger} animate-stagger-3`}
                >
                  {t.register.subtitle}
                </p>
              </div>

              {error && (
                <div
                  className={`mb-4 sm:mb-5 p-3 sm:p-4 rounded-xl bg-destructive/10 text-destructive text-sm break-words-safe ${stagger}`}
                >
                  {error}
                </div>
              )}

              <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
                {/* Avatar */}
                <div
                  className={`flex flex-col items-center gap-2 sm:gap-3 ${stagger} animate-stagger-4`}
                >
                  <button
                    type="button"
                    className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-dashed border-muted-foreground/25 bg-muted/50 cursor-pointer overflow-hidden transition-all duration-300 hover:border-primary/40 hover:bg-muted hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatarPreview ? (
                      <Image
                        src={avatarPreview}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="112px"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-1">
                        <User className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 hover:opacity-100">
                      <Camera className="h-7 w-7 sm:h-8 sm:w-8 text-white drop-shadow" />
                    </div>
                  </button>
                  <p className="text-xs text-muted-foreground text-center break-words-safe max-w-[240px]">
                    {t.register.avatarHint}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>

                <div className={`space-y-1.5 ${stagger} animate-stagger-5`}>
                  <label className="text-sm font-medium text-foreground block break-words-safe">
                    {t.register.name}
                    {lang === "ja" && <span className="text-xs font-normal text-muted-foreground ml-1">（英語のみ）</span>}
                    <span className="text-destructive"> *</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.replace(/[^\x00-\x7F]/g, ""))}
                    placeholder={t.register.namePlaceholder}
                    className="w-full min-w-0 h-11 sm:h-12 px-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    required
                  />
                </div>

                <div className={`space-y-1.5 ${stagger} animate-stagger-6`}>
                  <label className="text-sm font-medium text-foreground block break-words-safe">
                    {t.register.username} <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">
                      @
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={handleUsernameChange}
                      placeholder={t.register.usernamePlaceholder}
                      className="w-full min-w-0 h-11 sm:h-12 pl-8 pr-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      required
                      minLength={3}
                      maxLength={30}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground break-words-safe">
                    {t.register.usernameHint}
                  </p>
                </div>

                <div className={`space-y-1.5 ${stagger} animate-stagger-7`}>
                  <label className="text-sm font-medium text-foreground block break-words-safe">
                    {t.register.email} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full min-w-0 h-11 sm:h-12 px-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    required
                  />
                </div>

                <div className={`space-y-1.5 ${stagger} animate-stagger-8`}>
                  <label className="text-sm font-medium text-foreground block break-words-safe">
                    {t.register.password} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.register.passwordPlaceholder}
                    className="w-full min-w-0 h-11 sm:h-12 px-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    required
                    minLength={8}
                  />
                </div>

                <div className={`space-y-1.5 ${stagger} animate-stagger-9`}>
                  <label className="text-sm font-medium text-foreground block break-words-safe">
                    {t.register.confirmPassword} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-w-0 h-11 sm:h-12 px-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    required
                    minLength={8}
                  />
                </div>

                <div
                  className={`flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-primary/5 border border-primary/10 text-xs sm:text-sm text-foreground/90 break-words-safe ${stagger} animate-stagger-9`}
                >
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 mt-0.5 text-primary" />
                  <p>{t.register.confirmationNote}</p>
                </div>

                <Button
                  type="submit"
                  className={`w-full h-12 rounded-xl font-semibold text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:hover:translate-y-0 ${stagger} animate-stagger-10`}
                  disabled={loading}
                >
                  {loading ? t.register.submitting : t.register.submit}
                </Button>
              </form>

              <p
                className={`text-center text-sm text-muted-foreground mt-6 sm:mt-8 break-words-safe ${stagger} animate-stagger-10`}
              >
                {t.register.hasAccount}{" "}
                <Link
                  href="/login"
                  className="text-primary hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 rounded"
                >
                  {t.register.login}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Register;
