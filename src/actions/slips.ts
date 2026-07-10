"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notifyPostUpdate } from "@/lib/events";
import { deleteSlipFile, saveSlipForParticipants } from "@/lib/uploads";

/**
 * Upload one slip image and attach it to every given participant row — one
 * PromptPay transfer can cover several menu items owned by the same person.
 * Every row must already be claimed by the caller (via claimParticipant) and
 * unlocked (no existing slip); this action only writes the file + status.
 */
export type SlipState = { error?: string; ok?: boolean } | undefined;

export async function uploadSlip(
  participantIds: string[],
  _prev: SlipState,
  formData: FormData
): Promise<SlipState> {
  const user = await requireUser();
  if (participantIds.length === 0) return { error: "กรุณาเลือกอย่างน้อย 1 รายการ" };

  const participants = await prisma.participant.findMany({
    where: { id: { in: participantIds } },
    include: { post: true },
  });
  if (participants.length !== participantIds.length) return { error: "ไม่พบรายการ" };

  const post = participants[0].post;
  if (participants.some((p) => p.postId !== post.id)) {
    return { error: "รายการไม่อยู่ในบิลเดียวกัน" };
  }
  if (post.status === "CLOSED") {
    return { error: "บิลปิดแล้ว ไม่สามารถแนบสลิปได้" };
  }
  for (const p of participants) {
    if (p.userId !== user.id) return { error: `คุณไม่มีสิทธิ์แนบสลิปของ "${p.itemName}"` };
    if (p.slipImagePath) return { error: `"${p.itemName}" แนบสลิปแล้ว` };
  }

  const result = await saveSlipForParticipants(participants, formData.get("slip"));
  if ("error" in result) return result;

  revalidatePath(`/posts/${post.id}`);
  notifyPostUpdate(post.id);
  return { ok: true };
}

/** Owner deletes an already-uploaded slip, resetting the row back to unpaid. */
export async function deleteSlip(participantId: string): Promise<void> {
  const user = await requireUser();
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: { post: true },
  });
  if (!participant) return;
  if (participant.post.ownerId !== user.id) throw new Error("FORBIDDEN");
  if (!participant.slipImagePath) return;

  await deleteSlipFile(participant.slipImagePath);
  await prisma.participant.update({
    where: { id: participantId },
    data: { slipImagePath: null, paymentStatus: "UNPAID", paidAt: null },
  });

  revalidatePath(`/posts/${participant.postId}`);
  notifyPostUpdate(participant.postId);
}
