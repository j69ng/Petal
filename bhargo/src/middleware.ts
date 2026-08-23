import { NextResponse, type NextRequest } from "next/server";

// A cheap first gate: no session cookie, no pages. It cannot read the database
// (middleware runs on the edge runtime), so it only checks that a cookie is
// present — every page and form handler still validates the session properly
// through requireUser(). Belt and braces, in that order.

const PUBLIC_PATHS = [
  "/login",
  "/setup",
  // Answers an uptime checker that has no account and never will.
  "/api/health",
  // The error boundary posts here from a page that may itself have failed.
  "/api/report",
  // Guarded by BHARGO_OPS_KEY instead of a session — see diagnostics/page.tsx.
  "/diagnostics",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (!request.cookies.get("bhargo_session")) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
