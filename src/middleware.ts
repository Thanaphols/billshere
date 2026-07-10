import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";

// Public paths that never require a session.
const PUBLIC_PREFIXES = ["/login", "/register", "/api/health", "/share"];

// The SSE endpoint just pings "update" with no bill data — safe to expose so
// the public /share guest page can live-refresh like the logged-in page does.
const isPublicStream = (pathname: string) =>
  /^\/api\/posts\/[^/]+\/stream$/.test(pathname);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    isPublicStream(pathname);

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  // Not logged in and hitting a protected page → send to /login.
  if (!isPublic && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ponytail: intentionally NO "logged-in → bounce to dashboard" redirect here.
  // Middleware only sees the JWT; the app layout also requires the user to exist
  // in the DB. An orphaned-but-valid token (e.g. after a DB reseed) would make
  // /login → / (middleware) and / → /login (layout guard) bounce forever. Letting
  // /login always render breaks the loop; a fresh login just overwrites the cookie.
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
