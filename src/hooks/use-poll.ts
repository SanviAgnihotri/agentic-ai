"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Polling hook with visibility awareness.
 *
 * - A tick is skipped while the previous request is still in flight, so slow
 *   networks don't pile up overlapping requests or apply them out of order.
 * - `data` only changes when the payload actually changed — an unchanged poll
 *   response must not re-render a large list every few seconds.
 */
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

  // Latest request wins: when deps change mid-flight the older response is
  // dropped instead of overwriting newer data.
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const lastJsonRef = useRef<string | null>(
    initialData === undefined ? null : JSON.stringify(initialData),
  );

  const refresh = async (force = false) => {
    if (inFlightRef.current && !force) return;
    const requestId = ++requestIdRef.current;
    inFlightRef.current = true;
    try {
      const value = await fetcherRef.current();
      const json = JSON.stringify(value);
      if (json !== lastJsonRef.current) {
        lastJsonRef.current = json;
        setData(value);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      if (requestId === requestIdRef.current) {
        inFlightRef.current = false;
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!active) return;
      // Force: a dep change (e.g. new filter) must issue a fresh request even
      // if a request for the previous filter is still in flight.
      await refresh(true);
    };
    void run();
    if (!intervalMs) {
      return () => {
        active = false;
      };
    }
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
