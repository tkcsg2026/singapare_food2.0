"use client";

import { useState, useEffect, useCallback } from "react";

export function useFetch<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { signal });
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
  }, [url]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData, ...deps]);

  return { data, loading, error, refetch: fetchData };
}
