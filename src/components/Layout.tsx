"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import logoImage from "@/assets/logo.png";
import {
  Menu, X, ChevronRight, ChevronDown,
  User, LogOut, LayoutDashboard, ShieldCheck, Settings, Globe, ChevronUp, Heart, UserPlus, LogIn, Shield, FileText,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { FooterSocialLinks } from "@/components/FooterSocialLinks";
import { ChatbotWidget } from "@/components/chatbot/ChatbotWidget";
import { ScrollingBanner } from "@/components/ScrollingBanner";

/** Circular avatar or default icon */
function AvatarBadge({ src, alt, size = 32 }: { src?: string | null; alt: string; size?: number }) {
  if (src) {
    return (
      <div
        className="rounded-full overflow-hidden border-2 border-primary/20 flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <Image src={src} alt={alt} width={size} height={size} className="object-cover w-full h-full" unoptimized />
      </div>
    );
  }
  return (
    <div
      className="rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <User className="text-primary" style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}

/** Language toggle — always a globe icon with a lang badge (EN/JA). */
function LangToggle({ compact: _compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "en" ? "ja" : "en")}
      className="relative p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
      aria-label={lang === "en" ? "Switch to 日本語" : "Switch to English"}
    >
      <Globe className="h-5 w-5" />
      <span className="absolute bottom-0.5 right-0.5 text-[8px] font-black bg-primary text-primary-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
        {lang === "en" ? "E" : "J"}
      </span>
    </button>
  );
}

/** User menu dropdown — avatar + name (or avatar-only when compact), then My Page / Profile / Logout */
function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, profile, signOut } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isAdmin = profile?.role === "admin";
  const displayName = profile?.name || profile?.username || t.nav.user;
  const avatarSrc = profile?.avatar_url || null;

  const dropdownPanel = open && typeof document !== "undefined" && createPortal(
    <div
      ref={panelRef}
      className="fixed w-60 max-w-[calc(100vw-2rem)] bg-white border border-border rounded-none shadow-lg z-[100] animate-dropdown-open origin-top"
      style={{
        top: triggerRef.current
          ? triggerRef.current.getBoundingClientRect().bottom + 4
          : 0,
        right: triggerRef.current
          ? document.documentElement.clientWidth - triggerRef.current.getBoundingClientRect().right
          : 16,
      }}
    >
          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors"
            >
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              <span>{t.nav.myPage}</span>
            </Link>
            <Link
              href="/dashboard?tab=favorites"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors"
            >
              <Heart className="h-4 w-4 text-muted-foreground" />
              <span>{t.nav.favoriteSuppliers}</span>
            </Link>
            <Link
              href="/dashboard?tab=profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>{t.nav.editProfile}</span>
            </Link>
            {isAdmin && (
              <Link
                href="/admin-dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors"
              >
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-primary font-medium">{t.nav.adminPanel}</span>
              </Link>
            )}
            <div className="my-1 border-t" />
            <button
              onClick={() => { signOut(); setOpen(false); }}
              className="flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/8 w-full transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>{t.nav.logout}</span>
            </button>
          </div>
    </div>,
    document.body
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        title={displayName}
        className={`flex items-center border border-transparent hover:border-border hover:bg-muted transition-all duration-150 ${
          compact ? "p-1.5 rounded-full" : "gap-2 px-3 py-2"
        }`}
      >
        <AvatarBadge src={avatarSrc} alt={displayName} size={compact ? 40 : 38} />
        {!compact && (
          <>
            {isAdmin
              ? <ShieldCheck className="h-3.5 w-3.5 text-primary hidden sm:block flex-shrink-0" />
              : <User className="h-3.5 w-3.5 text-muted-foreground hidden sm:block flex-shrink-0" />
            }
            <span className="max-w-[110px] truncate text-sm font-semibold hidden sm:block">{displayName}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>
      {dropdownPanel}
    </div>
  );
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useTranslation();

  const navItems = [
    { label: t.nav.suppliers,   path: "/suppliers" },
    { label: t.nav.marketplace, path: "/marketplace" },
    { label: t.nav.news,        path: "/news" },
    { label: t.nav.jobs,        path: "/jobs" },
    { label: t.nav.about,       path: "/about" },
    { label: t.nav.contact,     path: "/contact" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white shadow-header border-b-2 border-primary overflow-hidden">
      <div className="container flex h-20 md:h-[4.55rem] items-center gap-4 md:gap-6 min-w-0">
        {/* Logo — no border, no white background */}
        <Link href="/" className="flex items-center flex-shrink-0 min-w-0 max-w-[60vw] sm:max-w-none group bg-transparent border-0 shadow-none rounded-none p-0">
          <Image
            src={logoImage}
            alt="F&B Portal - Singapore F&B Supplier & Chef Network"
            height={56}
            width={220}
            className="h-10 sm:h-12 md:h-14 w-auto object-contain object-left transition-transform duration-200 ease-smooth group-hover:-translate-y-0.5 [background:transparent]"
            priority
          />
        </Link>

        {/* Right — nav, lang, auth */}
        <div className="hidden md:flex items-center gap-0.5 ml-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`relative px-3 py-2 text-[15px] font-medium transition-all duration-200 ease-smooth group ${
                (pathname ?? "").startsWith(item.path)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              {item.label}
              <span
                className={`absolute bottom-0 left-0 right-0 h-0.5 bg-primary transition-opacity duration-200 ${
                  (pathname ?? "").startsWith(item.path) ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                }`}
              />
            </Link>
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          <LangToggle />
          <div className="ml-1">
            {user ? (
              <UserMenu />
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="font-medium text-muted-foreground hover:text-foreground">
                    {t.nav.login}
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline" size="sm" className="font-semibold">
                    {t.nav.register}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: globe + avatar (if logged in) + menu */}
        <div className="md:hidden flex items-center gap-1 ml-auto">
          <LangToggle compact />
          {user && (
            <div className="flex items-center">
              <UserMenu compact />
            </div>
          )}
          <button
            type="button"
            className="p-2 rounded-lg text-foreground hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu — header menu only (Suppliers, Marketplace, News) */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-white animate-fade-in">
          <nav className="container py-4 space-y-0.5 overflow-y-auto max-h-[70vh]">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between min-h-[48px] px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted ${
                  (pathname ?? "").startsWith(item.path) ? "bg-primary/8 text-primary border-l-4 border-primary" : ""
                }`}
              >
                {item.label}
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </Link>
            ))}
            {!user && (
              <>
                <div className="my-2 border-t border-border" />
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 min-h-[48px] px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <LogIn className="h-4 w-4 flex-shrink-0" />
                  {t.nav.login}
                  <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 min-h-[48px] px-4 py-3.5 text-sm font-semibold transition-colors bg-primary/5 hover:bg-primary/10 text-primary border-l-4 border-primary"
                >
                  <UserPlus className="h-4 w-4 flex-shrink-0" />
                  {t.nav.createAccount}
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Link>
              </>
            )}
            <div className="my-2 border-t border-border" />
            <Link
              href="/terms"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 min-h-[48px] px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <FileText className="h-4 w-4 flex-shrink-0" />
              {t.footer.terms}
              <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </Link>
            <Link
              href="/privacy"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 min-h-[48px] px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <Shield className="h-4 w-4 flex-shrink-0" />
              {t.footer.privacy}
              <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t-2 border-primary bg-primary/[0.06] overflow-hidden w-full">
      <div className="container py-8 sm:py-12 min-w-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 min-w-0">
          <div className="min-w-0">
            <Link href="/" className="inline-block mb-4">
              
                <Image
                  src={logoImage}
                  alt="F&B Portal - Singapore F&B Supplier & Chef Network"
                  height={36}
                  width={180}
                  className="h-9 w-auto object-contain"
                  style={{ mixBlendMode: "multiply" }}
                />
              
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed break-words-safe">{t.footer.tagline}</p>
            <FooterSocialLinks />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold mb-4 text-sm text-primary uppercase tracking-wider">{t.footer.services}</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li><Link href="/suppliers" className="block py-2 -my-1 hover:text-primary transition-colors duration-200">{t.footer.supplierSearch}</Link></li>
              <li><Link href="/suppliers?plan=premium" className="block py-2 -my-1 hover:text-primary transition-colors duration-200">{t.footer.premiumListings}</Link></li>
              <li><Link href="/marketplace" className="block py-2 -my-1 hover:text-primary transition-colors duration-200">{t.footer.marketplace}</Link></li>
              <li><Link href="/news" className="block py-2 -my-1 hover:text-primary transition-colors duration-200">{t.footer.news}</Link></li>
              <li><Link href="/jobs" className="block py-2 -my-1 hover:text-primary transition-colors duration-200">{t.footer.jobs}</Link></li>
              <li><Link href="/links" className="block py-2 -my-1 hover:text-primary transition-colors duration-200">{t.footer.links}</Link></li>
              <li><Link href="/about" className="block py-2 -my-1 hover:text-primary transition-colors duration-200">{t.about.pageTitle}</Link></li>
            </ul>
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold mb-4 text-sm text-foreground uppercase tracking-wider">{t.footer.info}</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li><Link href="/terms" className="block py-2 -my-1 hover:text-primary transition-colors duration-200">{t.footer.terms}</Link></li>
              <li><Link href="/privacy" className="block py-2 -my-1 hover:text-primary transition-colors duration-200">{t.footer.privacy}</Link></li>
            </ul>
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold mb-4 text-sm text-foreground uppercase tracking-wider">{t.footer.contact}</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li><Link href="/contact" className="block py-2 -my-1 hover:text-primary transition-colors duration-200">{t.footer.contactForm}</Link></li>
              <li><Link href="/login" className="block py-2 -my-1 hover:text-primary transition-colors duration-200">{t.footer.adminLogin}</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border text-center text-xs text-muted-foreground space-y-1">
          <div>{t.footer.copyright}</div>
          <div>WILL &amp; BEYOND PTE. LTD. (UEN: 202222320N)</div>
        </div>
      </div>
    </footer>
  );
}

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      className="fixed z-50 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all duration-200"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom, 0px))", right: "max(1rem, env(safe-area-inset-right, 0px))" }}
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}

function PageViewTracker() {
  const pathname = usePathname();
  const record = useCallback((path: string) => {
    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }).catch(() => {});
  }, []);
  useEffect(() => { record(pathname ?? "/"); }, [pathname, record]);
  return null;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full min-w-0 flex flex-col overflow-x-hidden">
      <PageViewTracker />
      <Header />
      <main className="relative flex-1 w-full min-w-0 pt-20 md:pt-[4.55rem] overflow-x-hidden">
        <div className="absolute left-0 right-0 top-1 md:top-1.5 z-20 pointer-events-none">
          <div className="pointer-events-auto">
            <ScrollingBanner />
          </div>
        </div>
        {children}
      </main>
      <Footer />
      <BackToTop />
      <ChatbotWidget />
    </div>
  );
}
