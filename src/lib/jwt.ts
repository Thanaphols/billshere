import { SignJWT, jwtVerify } from "jose";

// Edge-safe JWT helpers (used by middleware and server code alike).
// No Node-only or Prisma imports here so this can run in the edge runtime.

export const SESSION_COOKIE = "billshere_session";

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
    .setExpirationTime("7d")
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
