"use client";

import { useEffect, useRef, useState } from "react";

/** Simple polling hook with visibility awareness. */
export function usePoll<T>(
  fetcher: () => Promise<T>,
  intervalMs: number | null,
  deps: unknown[] = [],
  initialData?: T,
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(initialData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialData);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const refresh = async () => {
    try {
      const value = await fetcherRef.current();
      setData(value);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!active) return;
      await refresh();
    };
    void run();
    if (!intervalMs) return () => {
      active = false;
    };
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void run();
    }, intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);

  return { data, error, loading, refresh };
}

export async function apiFetch<T>(
  input: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const response = await fetch(input, {
    ...rest,
    headers: {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json ? JSON.stringify(json) : rest.body,
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }
  return payload as T;
}
