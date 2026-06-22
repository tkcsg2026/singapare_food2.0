import { NextResponse } from "next/server";

/** Cache-Control for public read-only API responses (browser + CDN). */
export const PUBLIC_CACHE_MAX_AGE = 60;
export const PUBLIC_CACHE_STALE_WHILE_REVALIDATE = 300;

export function jsonWithPublicCache<T>(data: T, maxAge = PUBLIC_CACHE_MAX_AGE): NextResponse {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${PUBLIC_CACHE_STALE_WHILE_REVALIDATE}`,
    },
  });
}
