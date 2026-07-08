"use server";

import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * A tagged participant (or the post owner) uploads a transfer slip image.
 * The file lands in UPLOAD_DIR and is served back via /api/uploads/[file].
 */
export type SlipState = { error?: string; ok?: boolean } | undefined;

export async function uploadSlip(
  participantId: string,
  _prev: SlipState,
  formData: FormData
): Promise<SlipState> {
  const user = await requireUser();

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: { post: true },
  });
  if (!participant) return { error: "ไม่พบรายการ" };

  // Only the tagged payer or the post owner may attach a slip.
  if (participant.userId !== user.id && participant.post.ownerId !== user.id) {
    return { error: "คุณไม่มีสิทธิ์แนบสลิปของรายการนี้" };
  }

  const file = formData.get("slip");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "กรุณาเลือกไฟล์รูปสลิป" };
  }
  if (!ALLOWED.has(file.type)) {
    return { error: "รองรับเฉพาะรูป PNG, JPG, WEBP" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "ไฟล์ใหญ่เกิน 5MB" };
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${participantId}.${EXT[file.type]}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

  await prisma.participant.update({
    where: { id: participantId },
    data: {
      slipImagePath: filename,
      // Don't downgrade an already-confirmed payment.
      paymentStatus:
        participant.paymentStatus === "PAID" ? "PAID" : "SLIP_UPLOADED",
    },
  });

  revalidatePath(`/posts/${participant.postId}`);
  return { ok: true };
}
