"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./useAuth";

/**
 * Redirect to /login if user is not authenticated.
 * Use at the top of any page that requires login.
 *
 * @param adminOnly - if true, also redirect non-admin users
 */
export function useRequireAuth(adminOnly = false) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (adminOnly && profile?.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, profile, loading, adminOnly, router]);

  return { user, profile, loading };
}
