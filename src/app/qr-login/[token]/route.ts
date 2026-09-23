import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { verifyQrLoginToken } from "@/lib/jwt";

// Scanning the QR from the profile page lands here. Verify the short-lived
// token, start a session on THIS device, then drop the user into the app.
// Public route (see proxy.ts) — the scanning device has no session yet.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const session = await verifyQrLoginToken(token);
  if (!session) redirect("/login?error=qr");

  // Confirm the user still exists (token could outlive a deleted account).
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login?error=qr");

  await startSession({ userId: user.id, name: user.name });
  redirect("/");
}
