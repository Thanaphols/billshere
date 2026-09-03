import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

// DB-backed refresh tokens. Runs on the Node.js runtime only (proxy + server
// actions). The raw token is a random opaque string handed to the client in a
// cookie; the DB only ever holds its SHA-256 hash.

export const REFRESH_COOKIE = "billshere_refresh";
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

// Bump a token's expiry at most ~once/day: only slide it forward when it has
// lost more than a day off its full 30-day window. Keeps active devices signed
// in indefinitely without writing to the DB on every access refresh.
const SLIDE_THRESHOLD_MS = REFRESH_TTL_MS - 1000 * 60 * 60 * 24;

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFRESH_MAX_AGE,
  };
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Create a refresh-token row for a user and return the raw token to cookie. */
export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(raw),
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  // Opportunistic sweep: purge every expired row on each login so tokens from
  // abandoned devices (30+ days idle) don't pile up. No cron needed — any login
  // keeps the table clean. ponytail: global scan, no expiresAt index — add one
  // if the table ever gets big enough for this to matter.
  await prisma.refreshToken
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});
  return raw;
}

/**
 * Validate a raw refresh token. If good, slide its expiry forward (throttled)
 * and return the owning user's id + name for minting a new access token.
 * Returns null for missing/unknown/expired tokens.
 */
export async function useRefreshToken(
  raw: string | undefined
): Promise<{ userId: string; name: string } | null> {
  if (!raw) return null;
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!row) return null;

  if (row.expiresAt.getTime() < Date.now()) {
    // Expired — clean it up so the table doesn't accumulate dead rows.
    await prisma.refreshToken.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }

  if (row.expiresAt.getTime() - Date.now() < SLIDE_THRESHOLD_MS) {
    await prisma.refreshToken
      .update({
        where: { id: row.id },
        data: { expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
      })
      .catch(() => {});
  }

  return { userId: row.user.id, name: row.user.name };
}

/** Delete a refresh-token row on logout. No-op if it doesn't exist. */
export async function revokeRefreshToken(raw: string | undefined): Promise<void> {
  if (!raw) return;
  await prisma.refreshToken
    .deleteMany({ where: { tokenHash: hashToken(raw) } })
    .catch(() => {});
}

// ponytail: no rotation / reuse-detection — a stolen refresh token stays valid
// until it expires or the user logs out. Add rotation-on-use + a reuse alarm if
// this graduates past an internal tool.
