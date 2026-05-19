import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { getPreferredPlaybackUrl } from "@/lib/video";

type CallbackStatus = "processing" | "completed" | "failed";

export async function POST(req: NextRequest) {
  const secret = process.env.VIDEO_TRANSCODE_WEBHOOK_SECRET || "";
  const token =
    req.headers.get("x-transcode-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const status = typeof body.status === "string" ? (body.status.trim() as CallbackStatus) : "";
  const transcodedUrl = typeof body.transcodedUrl === "string" ? body.transcodedUrl.trim() : "";
  const errorMessage = typeof body.error === "string" ? body.error.trim() : "";
  const sourceMime = typeof body.sourceMime === "string" ? body.sourceMime.trim().toLowerCase() : "";

  if (!productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });
  if (!["processing", "completed", "failed"].includes(status)) {
    return NextResponse.json({ error: "status must be processing, completed, or failed" }, { status: 400 });
  }

  const { data: current, error: readError } = await admin
    .from("supplier_products")
    .select("id, video_url, video_playback_url")
    .eq("id", productId)
    .single();

  if (readError || !current) {
    return NextResponse.json({ error: readError?.message || "Product not found" }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const update: Record<string, string | null> = {
    video_transcode_status: status,
    video_transcode_error: "",
    video_source_mime: sourceMime || null,
  };

  if (status === "processing") {
    update.video_transcode_requested_at = current.video_playback_url ? null : nowIso;
  }

  if (status === "completed") {
    if (!transcodedUrl) {
      return NextResponse.json({ error: "transcodedUrl is required for completed status" }, { status: 400 });
    }
    update.video_transcoded_url = transcodedUrl;
    update.video_playback_url = getPreferredPlaybackUrl({
      videoUrl: current.video_url || "",
      videoTranscodedUrl: transcodedUrl,
      videoPlaybackUrl: transcodedUrl,
    });
    update.video_transcoded_at = nowIso;
  } else if (status === "failed") {
    update.video_transcode_error = errorMessage || "Transcoding failed.";
    update.video_playback_url = getPreferredPlaybackUrl({
      videoUrl: current.video_url || "",
      videoTranscodedUrl: "",
      videoPlaybackUrl: current.video_playback_url || "",
    });
    update.video_transcoded_at = null;
  } else {
    update.video_playback_url = current.video_playback_url || current.video_url || "";
  }

  const { error: updateError } = await admin
    .from("supplier_products")
    .update(update)
    .eq("id", productId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
