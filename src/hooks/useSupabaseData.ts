"use client";

import { useState, useEffect, useCallback } from "react";

export interface UseFetchOptions {
  /** Browser fetch cache mode. Use `"default"` for cacheable public APIs. */
  cache?: RequestCache;
  /** When false, skip the request until enabled becomes true. */
  enabled?: boolean;
}

export function useFetch<T>(
  url: string,
  deps: unknown[] = [],
  options: UseFetchOptions = {},
) {
  const { cache = "no-store", enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { signal, cache });
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      if (signal?.aborted) return;
      setData(json);
    } catch (err: unknown) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      if (signal?.aborted) return;
      setLoading(false);
    }
  }, [url, cache]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData, enabled, ...deps]);

  return { data, loading, error, refetch: fetchData };
}
