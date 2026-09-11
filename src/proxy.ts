import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth policy lives here (edge) so the dashboard layout and pages stay free of
 * dynamic APIs and can be statically rendered.
 *
 * The edge proxy can only see cookies, not the database — so it gates
 * /dashboard on the presence of a Better Auth session cookie. Whether the
 * session is actually valid is checked by page-level `requireUser` and every
 * API's `requireApiUser` against the database.
 *
 * Better Auth names the session cookie `better-auth.session_token`; with
 * secure cookies enabled (production HTTPS) it is `__Secure-better-auth.session_token`.
 */
const BA_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

function hasAuthCookie(request: NextRequest): boolean {
  return BA_COOKIE_NAMES.some((name) => request.cookies.get(name)?.value);
}

function isDashboard(request: NextRequest): boolean {
  return request.nextUrl.pathname.startsWith("/dashboard");
}

function redirectToSignIn(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?redirect_url=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export default async function middleware(request: NextRequest) {
  if (isDashboard(request) && !hasAuthCookie(request)) {
    return redirectToSignIn(request);
  }
  return NextResponse.next();
}

export const config = {
  // Plain path patterns — Next 16's route parser rejects regex capturing
  // groups in matchers. Named params cover the root plus every nested path.
  matcher: ["/", "/:path*"],
};
