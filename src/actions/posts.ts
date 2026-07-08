"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { DiscountType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeAmounts, round2 } from "@/lib/discount";

function str(fd: FormData, key: string): string {
  return (fd.get(key) ?? "").toString().trim();
}
function num(fd: FormData, key: string): number {
  const n = parseFloat(str(fd, key));
  return Number.isFinite(n) ? n : 0;
}
function parseDiscountType(v: string): DiscountType {
  return v === "FIXED" || v === "PERCENT" ? v : "NONE";
}

/**
 * Recompute every participant's discount share, delivery share, and final
 * amount for a post. The delivery fee is always split equally across all
 * participants and added on top of the discounted item amount.
 */
async function recompute(postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { participants: { orderBy: { id: "asc" } } },
  });
  if (!post) return;

  const results = computeAmounts(
    post.participants.map((p) => ({ price: p.price })),
    post.discountType,
    post.discountValue
  );

  const count = post.participants.length;
  const deliveryShare = count > 0 ? round2(post.deliveryFee / count) : 0;

  await prisma.$transaction(
    post.participants.map((p, i) =>
      prisma.participant.update({
        where: { id: p.id },
        data: {
          discountShare: results[i].discountShare,
          deliveryShare,
          amountToPay: round2(results[i].itemAmount + deliveryShare),
        },
      })
    )
  );
}

/** Ensure the current user owns the post; returns the user. */
async function assertOwner(postId: string) {
  const user = await requireUser();
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.ownerId !== user.id) throw new Error("FORBIDDEN");
  return user;
}

export async function createPost(formData: FormData): Promise<void> {
  const user = await requireUser();
  const title = str(formData, "title") || "บิลไม่มีชื่อ";
  const note = str(formData, "note") || null;

  // Discount + delivery fee are configured later in the post's settings,
  // once the owner can see the actual participants and prices.
  const post = await prisma.post.create({
    data: { ownerId: user.id, title, note },
  });
  redirect(`/posts/${post.id}`);
}

export async function updatePostSettings(
  postId: string,
  formData: FormData
): Promise<void> {
  await assertOwner(postId);
  await prisma.post.update({
    where: { id: postId },
    data: {
      title: str(formData, "title") || "บิลไม่มีชื่อ",
      note: str(formData, "note") || null,
      discountType: parseDiscountType(str(formData, "discountType")),
      discountValue: num(formData, "discountValue"),
    },
  });
  await recompute(postId);
  revalidatePath(`/posts/${postId}`);
}

/** Set the bill's delivery fee — split equally across participants. */
export async function updateDeliveryFee(
  postId: string,
  formData: FormData
): Promise<void> {
  await assertOwner(postId);
  await prisma.post.update({
    where: { id: postId },
    data: { deliveryFee: Math.max(0, num(formData, "deliveryFee")) },
  });
  await recompute(postId);
  revalidatePath(`/posts/${postId}`);
}

export async function addParticipant(
  postId: string,
  formData: FormData
): Promise<void> {
  await assertOwner(postId);
  const userId = str(formData, "userId");
  const itemName = str(formData, "itemName") || "-";
  const price = num(formData, "price");
  if (!userId) return;

  await prisma.participant.create({
    data: { postId, userId, itemName, price },
  });
  await recompute(postId);
  revalidatePath(`/posts/${postId}`);
}

export async function removeParticipant(
  participantId: string
): Promise<void> {
  const p = await prisma.participant.findUnique({
    where: { id: participantId },
  });
  if (!p) return;
  await assertOwner(p.postId);
  await prisma.participant.delete({ where: { id: participantId } });
  await recompute(p.postId);
  revalidatePath(`/posts/${p.postId}`);
}

/** Owner confirms a payment (accepts the slip). */
export async function markPaid(participantId: string): Promise<void> {
  const p = await prisma.participant.findUnique({
    where: { id: participantId },
  });
  if (!p) return;
  await assertOwner(p.postId);
  await prisma.participant.update({
    where: { id: participantId },
    data: { paymentStatus: "PAID", paidAt: new Date() },
  });
  revalidatePath(`/posts/${p.postId}`);
}

/** Owner reverts a payment back to unpaid. */
export async function markUnpaid(participantId: string): Promise<void> {
  const p = await prisma.participant.findUnique({
    where: { id: participantId },
  });
  if (!p) return;
  await assertOwner(p.postId);
  await prisma.participant.update({
    where: { id: participantId },
    data: {
      paymentStatus: p.slipImagePath ? "SLIP_UPLOADED" : "UNPAID",
      paidAt: null,
    },
  });
  revalidatePath(`/posts/${p.postId}`);
}

export async function togglePostStatus(postId: string): Promise<void> {
  const user = await assertOwner(postId);
  void user;
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return;
  await prisma.post.update({
    where: { id: postId },
    data: { status: post.status === "OPEN" ? "CLOSED" : "OPEN" },
  });
  revalidatePath(`/posts/${postId}`);
}
