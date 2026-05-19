import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { getFileExtension, inferVideoMimeType, isAllowedVideoUpload } from "@/lib/video";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const VIDEO_MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;  // 10 MB

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Upload not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const fileType = typeof body.fileType === "string" ? body.fileType : "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;
  const folder   = typeof body.folder === "string" && body.folder.trim() ? body.folder.trim() : "";

  if (!fileName) return NextResponse.json({ error: "fileName is required" }, { status: 400 });

  const sanitizedExt  = getFileExtension(fileName);
  const normalizedType = fileType.toLowerCase().trim();

  const isImage = IMAGE_TYPES.has(normalizedType) || IMAGE_EXTENSIONS.has(sanitizedExt);
  const isVideo = isAllowedVideoUpload(fileType, fileName);

  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: "Unsupported file type. Please upload an image or video file." },
      { status: 400 },
    );
  }

  const maxBytes = isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
  if (fileSize > maxBytes) {
    return NextResponse.json(
      { error: `File is too large. Maximum size is ${maxBytes / (1024 * 1024)} MB.` },
      { status: 400 },
    );
  }

  // Determine bucket and default folder
  const bucket = isVideo ? "videos" : "logos";
  const resolvedFolder = folder || (isVideo ? "videos" : "products");
  const ext = sanitizedExt || (isVideo ? "mp4" : "jpg");
  const objectPath = `${resolvedFolder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const contentType = isVideo
    ? inferVideoMimeType({ fileType, fileName })
    : (normalizedType || "image/jpeg");

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(objectPath);
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message || "Failed to create upload URL" },
      { status: 500 },
    );
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);

  return NextResponse.json({
    bucket,
    path: objectPath,
    token: data.token,
    // signedUrl is the complete absolute URL — use it directly for the PUT request
    signedUrl: data.signedUrl,
    publicUrl: urlData.publicUrl,
    contentType,
  });
}
