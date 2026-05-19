"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function GoRedirect() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings?key=qr_redirect_url")
      .then((r) => r.json())
      .then((data) => {
        const url = data?.value || "/suppliers";
        if (url.startsWith("http")) {
          window.location.href = url;
        } else {
          router.replace(url);
        }
      })
      .catch(() => {
        router.replace("/suppliers");
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <img src="/QR.png?v=2" alt="The Kitchen Connection" className="w-40 h-40 sm:w-48 sm:h-48 object-contain animate-pulse" />
        </div>
        <p className="text-sm text-muted-foreground">リダイレクト中...</p>
      </div>
    </div>
  );
}
