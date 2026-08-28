import { NextResponse } from "next/server";

/**
 * Postgres undefined_table (42P01) or PostgREST "schema cache" / PGRST205 when
 * the community tables were never created or the API reload has not picked them
 * up yet. Mirrors the job_notices guard so the UI can show a setup notice
 * instead of a hard error.
 */
export function isCommunityUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const o = error as { code?: string; message?: string; details?: string; hint?: string };
  const code = o.code ?? "";
  if (code === "42P01" || code === "PGRST205") return true;
  const blob = [o.message, o.details, o.hint].filter(Boolean).join(" ").toLowerCase();
  if (!blob.includes("community_")) return false;
  return (
    blob.includes("schema cache") ||
    blob.includes("does not exist") ||
    blob.includes("could not find") ||
    blob.includes("not found")
  );
}

/** 503 response the community pages recognise as "run the migration". */
export function communityNotReady(): NextResponse {
  return NextResponse.json(
    { error: "Community setup is pending", code: "COMMUNITY_NOT_READY" },
    { status: 503 },
  );
}

/** Trims a value to a string and caps its length. Returns "" for non-strings. */
export function clampText(value: unknown, maxLen: number): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/**
 * Makes a user-typed search term safe to drop into a PostgREST `or=(...)`
 * filter: drops the characters that would break the filter's own grammar, and
 * backslash-escapes the LIKE wildcards so they match literally.
 */
export function escapeIlike(value: string): string {
  return value
    .replace(/[,()"\\]/g, " ")
    .replace(/[%_]/g, (m) => `\\${m}`)
    .trim();
}
