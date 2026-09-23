"use server";

import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { signQrLoginToken } from "@/lib/jwt";

// Mint a fresh QR-login token for the current user and return it as a QR image.
// On-demand (not on every profile render) so this login credential only exists
// when the user actually asks to sign another device in.
export async function generateLoginQr(): Promise<{ qr: string }> {
  const user = await requireUser();
  const token = await signQrLoginToken({ userId: user.id, name: user.name });

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/qr-login/${token}`;

  const qr = await QRCode.toDataURL(url, { margin: 1, width: 320, errorCorrectionLevel: "M" });
  return { qr };
}
