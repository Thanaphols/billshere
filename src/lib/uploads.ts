import { promises as fs } from "fs";
import path from "path";
import type { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Best-effort delete of a participant's slip file; ignores missing files. */
export async function deleteSlipFile(filename: string | null | undefined): Promise<void> {
  if (!filename) return;
  await fs.unlink(path.join(UPLOAD_DIR, filename)).catch(() => {});
}

/**
 * Validate the uploaded slip file, write it to disk once per participant,
 * and persist slipImagePath/paymentStatus for all of them. Shared by the
 * logged-in and guest upload actions — ownership/CLOSED checks are the
 * caller's job since those differ (session user vs. guest claim token).
 */
export async function saveSlipForParticipants(
  participants: { id: string; itemName: string; paymentStatus: PaymentStatus }[],
  file: FormDataEntryValue | null
): Promise<{ error: string } | { ok: true }> {
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
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = EXT[file.type];

  await Promise.all(
    participants.map((p) => fs.writeFile(path.join(UPLOAD_DIR, `${p.id}.${ext}`), buffer))
  );

  await prisma.$transaction(
    participants.map((p) =>
      prisma.participant.update({
        where: { id: p.id },
        data: {
          slipImagePath: `${p.id}.${ext}`,
          paymentStatus: p.paymentStatus === "PAID" ? "PAID" : "SLIP_UPLOADED",
        },
      })
    )
  );

  return { ok: true };
}
