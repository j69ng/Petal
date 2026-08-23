import { NextResponse, type NextRequest } from "next/server";

// A cheap first gate: no session cookie, no pages. It cannot read the database
// (middleware runs on the edge runtime), so it only checks that a cookie is
// present — every page and form handler still validates the session properly
// through requireUser(). Belt and braces, in that order.

const PUBLIC_PATHS = ["/login", "/setup"];

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
