import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ user: null });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ user: null });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ user: null });

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ user, profile });
}
