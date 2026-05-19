import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  const { email, password, name, username, avatar_url, role, company, whatsapp } = await req.json();

  if (!email || !password || !name || !username) {
    return NextResponse.json(
      { error: "Please fill in all required fields." },
      { status: 400 },
    );
  }

  const adminSb = createAdminClient();

  // ── No service-role key: tell client to fall back to client-side signUp ──
  if (!adminSb) {
    return NextResponse.json({ useClientFallback: true });
  }

  // ── Check username uniqueness ──
  const { data: existingUsername } = await adminSb
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existingUsername) {
    return NextResponse.json(
      { error: "This username is already taken." },
      { status: 400 },
    );
  }

  // ── Create auth user with email already confirmed ──
  const { data: authData, error: authError } =
    await adminSb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, username },
    });

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes("invalid api key") || msg.includes("invalid_api_key")) {
      return NextResponse.json(
        {
          error:
            "Supabase API keys are missing or incorrect. In .env.local, set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY from Supabase Dashboard → Settings → API.",
        },
        { status: 500 },
      );
    }
    const isDuplicate =
      msg.includes("already") || msg.includes("exist") || msg.includes("duplicate");
    return NextResponse.json(
      {
        error: isDuplicate
          ? "This email address is already registered."
          : authError.message,
      },
      { status: 400 },
    );
  }

  const userId = authData.user.id;

  // ── Create profile directly (bypasses RLS) ──
  const { error: profileError } = await adminSb.from("profiles").upsert({
    id: userId,
    email,
    name,
    username,
    avatar_url: typeof avatar_url === "string" && avatar_url.trim() ? avatar_url.trim() : "",
    role: role === "admin" ? "admin" : "user",
    whatsapp: typeof whatsapp === "string" ? whatsapp : "",
    company: typeof company === "string" ? company : "",
    banned: false,
  });

  if (profileError) {
    console.error("[register] profile upsert error:", profileError.message);
  }

  return NextResponse.json({ success: true, userId, needsEmailConfirmation: false });
}
