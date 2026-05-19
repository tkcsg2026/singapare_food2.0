"use client";

import { LogIn, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";

interface LoginPromptModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginPromptModal({ open, onClose }: LoginPromptModalProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-fade-in-scale">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <LogIn className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-bold">{t.loginPrompt.title}</h2>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            {t.loginPrompt.description}
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
            onClick={onClose}
          >
            <LogIn className="h-4 w-4" />
            {t.loginPrompt.loginButton}
          </Link>
          <Link
            href="/register"
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border-2 border-primary/20 text-primary font-bold text-sm hover:bg-primary/5 transition-colors"
            onClick={onClose}
          >
            <UserPlus className="h-4 w-4" />
            {t.loginPrompt.registerButton}
          </Link>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          {t.loginPrompt.freeNote}
        </p>
      </div>
    </div>
  );
}

/**
 * Hook: returns a guard function and modal element.
 * Call `requireLogin()` before any action — returns true if logged in, false if modal was shown.
 */
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function useLoginPrompt() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const requireLogin = (): boolean => {
    if (user) return true;
    setShowModal(true);
    return false;
  };

  const modal = (
    <LoginPromptModal open={showModal} onClose={() => setShowModal(false)} />
  );

  return { requireLogin, loginPromptModal: modal, isLoggedIn: !!user };
}
