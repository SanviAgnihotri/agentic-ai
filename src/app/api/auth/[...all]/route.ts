import { getBetterAuth } from "@/lib/better-auth";

/**
 * Better Auth catch-all handler.
 *
 * Better Auth owns `/api/auth/*` (sign-in/email, sign-up/email, callback/google,
 * callback/github, get-session, sign-out, ...). The demo endpoint lives at
 * `/api/demo` — a static segment outside this catch-all.
 *
 * The auth instance is built lazily (the database runs migrations on first
 * use), so the handlers resolve it per request instead of importing a
 * module-level singleton.
 */
async function handle(request: Request): Promise<Response> {
  const auth = await getBetterAuth();
  return auth.handler(request);
}

export { handle as GET, handle as POST };
