const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  qt: "video/quicktime",
  webm: "video/webm",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  mts: "video/mp2t",
  m2ts: "video/mp2t",
  ts: "video/mp2t",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  ogv: "video/ogg",
  mxf: "video/mxf",
};

export const VIDEO_EXTENSIONS = new Set(Object.keys(VIDEO_MIME_BY_EXTENSION));
export const GENERIC_VIDEO_TYPES = new Set(["application/octet-stream", "binary/octet-stream"]);
export const BROWSER_NATIVE_VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "webm", "ogv", "mov", "qt"]);

const YOUTUBE_VIMEO_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|vimeo\.com\/)/i;

export type VideoTranscodeStatus =
  | "none"
  | "not_needed"
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export function getFileExtension(input: string): string {
  const cleanInput = (input || "").split(/[?#]/)[0] || input || "";
  return (cleanInput.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getMimeTypeForVideoExtension(ext: string): string | null {
  return VIDEO_MIME_BY_EXTENSION[ext] ?? null;
}

export function inferVideoMimeType({
  fileType,
  fileName,
  url,
  fallback = "video/mp4",
}: {
  fileType?: string;
  fileName?: string;
  url?: string;
  fallback?: string;
}): string {
  const declaredType = (fileType || "").toLowerCase().trim();
  if (declaredType.startsWith("video/")) return declaredType;

  const extension = getFileExtension(fileName || url || "");
  const byExt = getMimeTypeForVideoExtension(extension);
  if (byExt) return byExt;

  if (declaredType) return declaredType;
  return fallback;
}

export function isAllowedVideoUpload(fileType: string, fileName: string): boolean {
  const normalizedType = (fileType || "").toLowerCase().trim();
  if (normalizedType.startsWith("video/")) return true;
  if (GENERIC_VIDEO_TYPES.has(normalizedType)) return true;

  const ext = getFileExtension(fileName);
  return VIDEO_EXTENSIONS.has(ext);
}

export function isEmbeddedVideoUrl(url?: string): boolean {
  if (!url) return false;
  return YOUTUBE_VIMEO_REGEX.test(url);
}

export function isBrowserNativeVideoUrl(url?: string): boolean {
  if (!url) return false;
  if (isEmbeddedVideoUrl(url)) return true;
  const ext = getFileExtension(url);
  return BROWSER_NATIVE_VIDEO_EXTENSIONS.has(ext);
}

export function getPreferredPlaybackUrl({
  videoUrl,
  videoTranscodedUrl,
  videoPlaybackUrl,
}: {
  videoUrl?: string;
  videoTranscodedUrl?: string;
  videoPlaybackUrl?: string;
}): string {
  return (videoPlaybackUrl || videoTranscodedUrl || videoUrl || "").trim();
}

export function getVideoTranscodeStateForUrl(
  videoUrl?: string,
  nowIso: string = new Date().toISOString(),
): {
  video_playback_url: string;
  video_transcoded_url: string;
  video_transcode_status: VideoTranscodeStatus;
  video_transcode_error: string;
  video_transcode_requested_at: string | null;
  video_transcoded_at: string | null;
} {
  const cleanUrl = (videoUrl || "").trim();
  if (!cleanUrl) {
    return {
      video_playback_url: "",
      video_transcoded_url: "",
      video_transcode_status: "none",
      video_transcode_error: "",
      video_transcode_requested_at: null,
      video_transcoded_at: null,
    };
  }

  if (isBrowserNativeVideoUrl(cleanUrl)) {
    return {
      video_playback_url: cleanUrl,
      video_transcoded_url: "",
      video_transcode_status: "not_needed",
      video_transcode_error: "",
      video_transcode_requested_at: null,
      video_transcoded_at: null,
    };
  }

  return {
    video_playback_url: cleanUrl,
    video_transcoded_url: "",
    video_transcode_status: "queued",
    video_transcode_error: "",
    video_transcode_requested_at: nowIso,
    video_transcoded_at: null,
  };
}
