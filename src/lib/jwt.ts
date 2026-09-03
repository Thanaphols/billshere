import { SignJWT, jwtVerify } from "jose";

// Edge-safe JWT helpers. Kept free of Node-only/Prisma imports so any runtime
// can verify an access token. DB-backed refresh logic lives in refresh.ts.

export const SESSION_COOKIE = "billshere_session";

// The access-token JWT is short-lived; the cookie itself lives long so it keeps
// riding along after the JWT inside it expires. The proxy mints a fresh JWT
// from the refresh token once the old one lapses.
const ACCESS_TTL = "15m";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

// Shared cookie attributes for both server actions (next/headers) and the
// proxy (NextResponse.cookies) — keep them identical so a refreshed cookie
// doesn't diverge from the one login sets.
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("JWT_SECRET is missing or too short (min 16 chars).");
  }
  return new TextEncoder().encode(s);
}

export type SessionPayload = { userId: string; name: string };

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret());
}

export async function verifySession(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId === "string" && typeof payload.name === "string") {
      return { userId: payload.userId, name: payload.name };
    }
    return null;
  } catch {
    return null;
  }
}
