import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { GENERIC_VIDEO_TYPES, getFileExtension, inferVideoMimeType, VIDEO_EXTENSIONS } from "@/lib/video";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Maximum sizes */
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;  // 10 MB
const VIDEO_MAX_BYTES = 200 * 1024 * 1024; // 200 MB

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Upload not configured" }, { status: 503 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const requestedFolder = ((formData.get("folder") as string) || "").trim().toLowerCase();
  const normalizedType = (file.type || "").toLowerCase().trim();
  const ext = getFileExtension(file.name);

  const isImage = IMAGE_TYPES.includes(normalizedType);
  const isVideoByType = normalizedType.startsWith("video/") || GENERIC_VIDEO_TYPES.has(normalizedType);
  const isVideoByExt = VIDEO_EXTENSIONS.has(ext);
  const isVideo = isVideoByType || isVideoByExt || requestedFolder === "videos";

  if (!isImage && !isVideo) {
    return NextResponse.json(
      {
        error:
          "Unsupported file type. Accepted: common image files or video files.",
      },
      { status: 400 },
    );
  }

  const maxBytes = isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
  if (file.size > maxBytes) {
    const maxMb = maxBytes / (1024 * 1024);
    return NextResponse.json(
      { error: `File is too large. Maximum size is ${maxMb} MB.` },
      { status: 400 },
    );
  }

  const folder = requestedFolder || (isVideo ? "videos" : "suppliers");
  const safeExt = ext || (isVideo ? "mp4" : "png");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
  const buf = await file.arrayBuffer();

  // Videos go into the "videos" bucket; images stay in "logos"
  const bucket = isVideo ? "videos" : "logos";
  const resolvedVideoType = inferVideoMimeType({
    fileType: normalizedType,
    fileName: file.name,
  });

  const { error } = await supabase.storage.from(bucket).upload(path, buf, {
    contentType: isVideo ? resolvedVideoType : normalizedType,
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: urlData.publicUrl, type: isVideo ? "video" : "image" });
}
