/**
 * Tiny stale-while-revalidate cache for hot authenticated GET endpoints.
 *
 * Neon round-trips from the app's region jitter between ~150ms and multiple
 * seconds. Serving the previous snapshot instantly and refreshing in the
 * background keeps the UI steady through that jitter. Entries are per-user
 * (keyed by caller), TTL-gated, and never used across processes.
 */
type Entry = { at: number; value: unknown };

const store = new Map<string, Entry>();

export async function withSwr<T>(
  key: string,
  compute: () => Promise<T>,
  ttlMs = 3_000,
): Promise<T> {
  const cached = store.get(key) as Entry | undefined;
  if (cached && Date.now() - cached.at < ttlMs) {
    return cached.value as T;
  }
  if (cached) {
    // Stale-while-revalidate: serve the previous snapshot instantly.
    void compute()
      .then((value) => store.set(key, { at: Date.now(), value }))
      .catch(() => {
        // keep the stale snapshot on failure
      });
    return cached.value as T;
  }
  const value = await compute();
  store.set(key, { at: Date.now(), value });
  return value;
}

export function invalidateSwr(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
