import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Handles the password recovery link from the reset email.
 * Supabase generateLink with PKCE requires server-side verification via hashed_token.
 * User clicks: {SITE_URL}/api/auth/confirm-reset?token_hash=xxx&next=/reset-password
 * We verify the token, set the session cookie, and redirect to the Set Password form.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tokenHash = searchParams.get("token_hash");
  const nextPath = searchParams.get("next") ?? "/reset-password";

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    req.nextUrl.origin ||
    "https://thekitchenconnection.net";
  const resetPasswordUrl = new URL("/reset-password", origin);
  const errorUrl = new URL("/reset-password", origin);
  errorUrl.hash = "error=access_denied";

  if (!tokenHash) {
    return NextResponse.redirect(errorUrl);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(errorUrl);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  if (error) {
    console.error("[confirm-reset] verifyOtp error:", error.message);
    return NextResponse.redirect(errorUrl);
  }

  const redirectTarget = nextPath.startsWith("/")
    ? new URL(nextPath, origin)
    : new URL("/reset-password", origin);
  return NextResponse.redirect(redirectTarget);
}
