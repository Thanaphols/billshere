import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "@/lib/jwt";
import { REFRESH_COOKIE, useRefreshToken } from "@/lib/refresh";

// Public paths that never require a session.
const PUBLIC_PREFIXES = ["/login", "/register", "/api/health", "/share"];

// The SSE endpoint just pings "update" with no bill data — safe to expose so
// the public /share guest page can live-refresh like the logged-in page does.
const isPublicStream = (pathname: string) =>
  /^\/api\/posts\/[^/]+\/stream$/.test(pathname);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    isPublicStream(pathname);

  let session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  // Access token expired/absent but a refresh token is present → trade it for a
  // fresh access JWT so an active same-device user never has to log in again.
  // Proxy runs on the Node.js runtime, so the DB lookup here is fine.
  let refreshedToken: string | null = null;
  if (!session) {
    const refreshed = await useRefreshToken(req.cookies.get(REFRESH_COOKIE)?.value);
    if (refreshed) {
      session = { userId: refreshed.userId, name: refreshed.name };
      refreshedToken = await signSession(session);
      // Forward the new token downstream so server components see a live session
      // on this very request, not just the next one.
      req.cookies.set(SESSION_COOKIE, refreshedToken);
    }
  }

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
  const res = refreshedToken
    ? NextResponse.next({ request: { headers: req.headers } })
    : NextResponse.next();
  if (refreshedToken) {
    res.cookies.set(SESSION_COOKIE, refreshedToken, sessionCookieOptions());
  }
  return res;
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
