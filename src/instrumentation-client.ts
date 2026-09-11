/**
 * Client-side instrumentation — runs before hydration.
 *
 * Dev-only console filter: Next.js 16.3.x (Turbopack) has a known bug where
 * the React debug channel writes to an already-closed WritableStream on fast
 * navigations/HMR refreshes, spamming the console and the dev overlay with
 * "Cannot write to a CLOSED writable stream" TypeErrors. It is diagnostic-only
 * noise from Next's dev tooling, not an application error — upstream issue:
 * https://github.com/vercel/next.js/issues/97918
 *
 * We swallow exactly those messages in development so the dev overlay stays
 * useful. Production is untouched (this file only runs its guard in dev).
 */
if (process.env.NODE_ENV !== "production") {
  const suppressed = [
    "Cannot write to a CLOSED writable stream",
    "Cannot close a CLOSED writable stream",
  ];

  const originalError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    const first = args[0];
    const message =
      typeof first === "string"
        ? first
        : first instanceof Error
          ? first.message
          : "";
    if (message && suppressed.some((needle) => message.includes(needle))) {
      return;
    }
    originalError(...args);
  };
}
