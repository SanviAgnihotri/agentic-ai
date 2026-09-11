import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth policy lives here (edge) so the dashboard layout and pages stay free of
 * dynamic APIs and can be statically rendered.
 *
 * - Clerk configured: the session is verified by Clerk middleware and
 *   /dashboard redirects unauthenticated users to sign-in.
 * - Demo/built-in sessions: the `groovy_session` cookie gates /dashboard.
 * Without Clerk keys, everything else falls back to a passthrough.
 */
const enabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

const SESSION_COOKIE = "groovy_session";

type ClerkHandler = (
  request: NextRequest,
  event: unknown,
) => Promise<Response> | Response;

let cachedHandler: ClerkHandler | undefined;

function isDashboard(request: NextRequest): boolean {
  return request.nextUrl.pathname.startsWith("/dashboard");
}

function redirectToSignIn(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?redirect_url=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export default async function middleware(request: NextRequest, event: unknown) {
  if (enabled) {
    if (!cachedHandler) {
      const { clerkMiddleware } = await import("@clerk/nextjs/server");
      cachedHandler = clerkMiddleware(async (auth, req) => {
        if (isDashboard(req)) {
          // A valid built-in session (demo workspace) also grants access even
          // when Clerk keys are configured — the page-level requireUser still
          // validates it against the database.
          if (req.cookies.get(SESSION_COOKIE)) {
            return NextResponse.next();
          }
          await auth.protect();
        }
      }) as unknown as ClerkHandler;
    }
    return cachedHandler(request, event);
  }

  // Built-in session auth (zero-config mode).
  if (isDashboard(request) && !request.cookies.get(SESSION_COOKIE)) {
    return redirectToSignIn(request);
  }
  return NextResponse.next();
}

export const config = {
  // Plain path patterns — Next 16's route parser rejects regex capturing
  // groups in matchers. Named params cover the root plus every nested path.
  matcher: ["/", "/:path*"],
};
