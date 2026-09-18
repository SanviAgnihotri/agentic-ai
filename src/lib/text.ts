/**
 * Text helpers for strings that end up in Postgres (jsonb/text reject lone
 * UTF-16 surrogates, which appear whenever a slice cuts an emoji surrogate
 * pair in half).
 */

/** Replace lone surrogates with U+FFFD so the value is valid UTF-8/JSON. */
export function wellFormed(value: string): string {
  const toWellFormed = (
    String.prototype as unknown as { toWellFormed?: () => string }
  ).toWellFormed;
  if (typeof toWellFormed === "function") {
    return value.toWellFormed();
  }
  return value.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    "\uFFFD",
  );
}

/**
 * Truncate without splitting a surrogate pair, then normalize any lone
 * surrogates that were already present upstream.
 */
export function truncateSafe(value: string, max: number): string {
  if (value.length <= max) return wellFormed(value);
  let end = max;
  const code = value.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return wellFormed(value.slice(0, end));
}

/**
 * Recursively normalize every string in a JSON-ish structure. Use at the
 * persistence boundary for values stored as jsonb — a single lone surrogate
 * anywhere inside would fail the entire write.
 */
export function deepWellFormed<T>(value: T): T {
  if (typeof value === "string") {
    return wellFormed(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => deepWellFormed(entry)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = deepWellFormed(entry);
    }
    return out as T;
  }
  return value;
}
