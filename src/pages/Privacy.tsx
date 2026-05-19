"use client";
import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/contexts/LanguageContext";
import { Shield } from "lucide-react";

const Privacy = () => {
  const { t } = useTranslation();
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings?key=privacy_policy")
      .then((r) => r.json())
      .then((d) => {
        const v = typeof d?.value === "string" ? d.value.trim() : "";
        setContent(v);
      })
      .catch(() => setContent(""));
  }, []);

  return (
    <Layout>
      <div className="container max-w-3xl py-10 md:py-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black">{t.footer.privacy}</h1>
        </div>

        {content === null ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
          </div>
        ) : (
          <div className="prose prose-sm max-w-none text-foreground">
            {(content || t.legal.privacyFallback).split("\n").map((line, i) =>
              line.trim() === "" ? (
                <br key={i} />
              ) : (
                <p key={i} className="mb-3 leading-relaxed text-muted-foreground">
                  {line}
                </p>
              )
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Privacy;
