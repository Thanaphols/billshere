"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { notifyPostUpdate } from "@/lib/events";
import { saveSlipForParticipants } from "@/lib/uploads";
import type { SlipState } from "@/actions/slips";

// Guest self-service actions for the public /share/[token] page — no
// account/session involved. A per-(browser, bill) cookie stands in for
// session.userId: every row a guest claims gets the same guestClaimToken.

function guestCookieName(shareToken: string) {
  return `gsid_${shareToken}`;
}

async function getGuestId(shareToken: string): Promise<string | null> {
  const store = await cookies();
  return store.get(guestCookieName(shareToken))?.value ?? null;
}

async function getOrCreateGuestId(shareToken: string): Promise<string> {
  const existing = await getGuestId(shareToken);
  if (existing) return existing;
  const id = crypto.randomUUID();
  const store = await cookies();
  store.set(guestCookieName(shareToken), id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/share/${shareToken}`,
    maxAge: 60 * 60 * 24 * 30,
  });
  return id;
}

async function loadPostByToken(shareToken: string) {
  const post = await prisma.post.findUnique({ where: { shareToken } });
  if (!post || post.deletedAt) throw new Error("NOT_FOUND");
  return post;
}

/** Guest self-service claim: type a name against an unclaimed menu item. */
export async function claimAsGuest(
  shareToken: string,
  participantId: string,
  name: string
): Promise<void> {
  const guestName = name.trim();
  if (!guestName) throw new Error("NAME_REQUIRED");

  const post = await loadPostByToken(shareToken);
  if (post.status === "CLOSED") throw new Error("BILL_CLOSED");

  const p = await prisma.participant.findUnique({ where: { id: participantId } });
  if (!p || p.postId !== post.id) throw new Error("NOT_FOUND");
  if (p.slipImagePath) throw new Error("LOCKED");

  const guestId = await getOrCreateGuestId(shareToken);
  const claimable =
    p.guestClaimToken === guestId ||
    (p.userId === null && p.guestName === null && p.guestClaimToken === null);
  if (!claimable) throw new Error("FORBIDDEN");

  await prisma.participant.update({
    where: { id: participantId },
    data: { guestName, guestClaimToken: guestId },
  });
  revalidatePath(`/share/${shareToken}`);
  notifyPostUpdate(post.id);
}

/** Guest self-service release: undo a claim you made, back to unassigned. */
export async function unclaimAsGuest(
  shareToken: string,
  participantId: string
): Promise<void> {
  const post = await loadPostByToken(shareToken);
  if (post.status === "CLOSED") throw new Error("BILL_CLOSED");

  const p = await prisma.participant.findUnique({ where: { id: participantId } });
  if (!p || p.postId !== post.id) throw new Error("NOT_FOUND");
  if (p.slipImagePath) throw new Error("LOCKED");

  const guestId = await getGuestId(shareToken);
  if (!guestId || p.guestClaimToken !== guestId) throw new Error("FORBIDDEN");

  await prisma.participant.update({
    where: { id: participantId },
    data: { guestName: null, guestClaimToken: null },
  });
  revalidatePath(`/share/${shareToken}`);
  notifyPostUpdate(post.id);
}

/** Guest uploads one slip covering every item they've claimed on this bill. */
export async function uploadSlipAsGuest(
  shareToken: string,
  participantIds: string[],
  _prev: SlipState,
  formData: FormData
): Promise<SlipState> {
  if (participantIds.length === 0) return { error: "กรุณาเลือกอย่างน้อย 1 รายการ" };

  const post = await prisma.post.findUnique({ where: { shareToken } });
  if (!post || post.deletedAt) return { error: "ไม่พบบิล" };
  if (post.status === "CLOSED") return { error: "บิลปิดแล้ว ไม่สามารถแนบสลิปได้" };

  const guestId = await getGuestId(shareToken);
  if (!guestId) return { error: "กรุณาจองรายการก่อนอัปโหลดสลิป" };

  const participants = await prisma.participant.findMany({
    where: { id: { in: participantIds } },
  });
  if (participants.length !== participantIds.length) return { error: "ไม่พบรายการ" };
  if (participants.some((p) => p.postId !== post.id)) {
    return { error: "รายการไม่อยู่ในบิลเดียวกัน" };
  }
  for (const p of participants) {
    if (p.guestClaimToken !== guestId) return { error: `คุณไม่มีสิทธิ์แนบสลิปของ "${p.itemName}"` };
    if (p.slipImagePath) return { error: `"${p.itemName}" แนบสลิปแล้ว` };
  }

  const result = await saveSlipForParticipants(participants, formData.get("slip"));
  if ("error" in result) return result;

  revalidatePath(`/share/${shareToken}`);
  notifyPostUpdate(post.id);
  return { ok: true };
}
