import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/jwt";
import {
  REFRESH_COOKIE,
  issueRefreshToken,
  refreshCookieOptions,
  revokeRefreshToken,
} from "@/lib/refresh";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Sign an access token + issue a refresh token, both as httpOnly cookies. */
export async function startSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const refresh = await issueRefreshToken(payload.userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
  store.set(REFRESH_COOKIE, refresh, refreshCookieOptions());
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  await revokeRefreshToken(store.get(REFRESH_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  store.delete(REFRESH_COOKIE);
}

/** Read + verify the current session from the cookie. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Full user record for the logged-in session, or null. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}

/** Like getCurrentUser but throws if not logged in (for server actions). */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
