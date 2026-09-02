import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient, requireAdmin } from "@/lib/supabase-server";
import { jsonWithPublicCache } from "@/lib/api-cache";

/**
 * Every page in the site renders the marquee, so this endpoint is requested on
 * each navigation. The banner is identical for all visitors, so serve it with a
 * public cache header — the browser and CDN then answer most of those requests
 * without a Supabase round trip.
 */
export async function GET() {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return jsonWithPublicCache({
      id: 1,
      text_en: "",
      text_ja: "",
      is_active: false,
      speed: 35,
    });
  }
  const { data, error } = await supabase
    .from("scrolling_banner")
    .select("*")
    .eq("id", 1)
    .single();
  if (error || !data) {
    return jsonWithPublicCache({ id: 1, text_en: "", text_ja: "", is_active: false, speed: 35 });
  }
  return jsonWithPublicCache(data);
}

export async function PUT(req: NextRequest) {
  const adminAuth = await requireAdmin(req);
  if (adminAuth instanceof NextResponse) return adminAuth;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = await req.json();
  const { text_en, text_ja, is_active, speed, text_color } = body;

  const { data, error } = await supabase
    .from("scrolling_banner")
    .upsert({
      id: 1,
      text_en: typeof text_en === "string" ? text_en : "",
      text_ja: typeof text_ja === "string" ? text_ja : "",
      is_active: Boolean(is_active),
      speed: typeof speed === "number" && speed > 0 ? Math.min(speed, 120) : 35,
      text_color: text_color === "black" ? "black" : "red",
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
