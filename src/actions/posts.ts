"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { DiscountType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeAmounts } from "@/lib/discount";
import { notifyPostUpdate } from "@/lib/events";
import { deleteSlipFile } from "@/lib/uploads";

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
 * Recompute every participant's discount share and final amount for a post.
 * Delivery fee is NOT part of this — it's a manual total ÷ head-count the
 * owner enters, shown as a summary-only figure, decoupled from amountToPay.
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

  await prisma.$transaction(
    post.participants.map((p, i) =>
      prisma.participant.update({
        where: { id: p.id },
        data: {
          discountShare: results[i].discountShare,
          amountToPay: results[i].itemAmount,
        },
      })
    )
  );
  notifyPostUpdate(postId);
}

/** Ensure the current user owns the post and it isn't in the bin; returns the post. */
async function assertOwner(postId: string) {
  const user = await requireUser();
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.ownerId !== user.id || post.deletedAt) throw new Error("FORBIDDEN");
  return post;
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

/** Save title/note/discount/delivery fee together and recompute everyone's amount. */
export async function updatePostSettings(
  postId: string,
  formData: FormData
): Promise<void> {
  await assertOwner(postId);

  const updateData: any = {
    discountType: parseDiscountType(str(formData, "discountType")),
    discountValue: num(formData, "discountValue"),
    deliveryFee: Math.max(0, num(formData, "deliveryFee")),
    deliveryPersonCount: Math.max(1, Math.round(num(formData, "deliveryPersonCount")) || 1),
  };

  if (formData.has("title")) {
    updateData.title = str(formData, "title") || "บิลไม่มีชื่อ";
  }
  if (formData.has("note")) {
    updateData.note = str(formData, "note") || null;
  }

  await prisma.post.update({
    where: { id: postId },
    data: updateData,
  });
  await recompute(postId);
  revalidatePath(`/posts/${postId}`);
  notifyPostUpdate(postId);
}

/** Update only post title and note. */
export async function updatePostTitleNote(
  postId: string,
  formData: FormData
): Promise<void> {
  await assertOwner(postId);
  await prisma.post.update({
    where: { id: postId },
    data: {
      title: str(formData, "title") || "บิลไม่มีชื่อ",
      note: str(formData, "note") || null,
    },
  });
  revalidatePath(`/posts/${postId}`);
  notifyPostUpdate(postId);
}

/** Add a menu item (name + price) — with optional person assignment. */
export async function addMenuItem(
  postId: string,
  formData: FormData
): Promise<void> {
  await assertOwner(postId);
  const itemName = str(formData, "itemName") || "-";
  const price = num(formData, "price");
  if (price <= 0) return;

  const userId = str(formData, "userId");
  const guestName = str(formData, "guestName");
  const quantity = Math.max(1, Math.floor(num(formData, "quantity")) || 1);

  if (quantity === 1) {
    await prisma.participant.create({
      data: {
        postId,
        itemName,
        price,
        userId: userId || null,
        guestName: userId ? null : (guestName || null),
      },
    });
  } else {
    const dataToCreate = Array.from({ length: quantity }).map((_, index) => ({
      postId,
      itemName: `${itemName} (${index + 1}/${quantity})`,
      price,
      userId: userId || null,
      guestName: userId ? null : (guestName || null),
    }));
    await prisma.participant.createMany({
      data: dataToCreate,
    });
  }

  await recompute(postId);
  revalidatePath(`/posts/${postId}`);
}

/**
 * Assign who owes for a menu item — either an existing member (userId) or a
 * free-text name for someone without an account (guestName). userId wins if
 * both are given. Owner-only; locked once the bill is closed. Changing the
 * assigned identity clears any existing slip — the old proof no longer
 * belongs to whoever now owns the row.
 */
export async function assignParticipantUser(
  participantId: string,
  formData: FormData
): Promise<void> {
  const p = await prisma.participant.findUnique({
    where: { id: participantId },
  });
  if (!p) return;
  const post = await assertOwner(p.postId);
  if (post.status === "CLOSED") throw new Error("BILL_CLOSED");

  const userId = str(formData, "userId");
  const guestName = str(formData, "guestName");
  const nextUserId = userId || null;
  const nextGuestName = userId ? null : guestName || null;
  const changed = p.userId !== nextUserId || p.guestName !== nextGuestName;

  const data: any = { userId: nextUserId, guestName: nextGuestName };
  if (changed && p.slipImagePath) {
    await deleteSlipFile(p.slipImagePath);
    data.slipImagePath = null;
    data.paymentStatus = "UNPAID";
    data.paidAt = null;
  }

  await prisma.participant.update({ where: { id: participantId }, data });
  await recompute(p.postId);
  revalidatePath(`/posts/${p.postId}`);
}

/**
 * Self-service claim: a visitor tags themselves as the owner of a menu item.
 * Only allowed on rows that are unassigned or already theirs, and only while
 * the bill is open — cannot steal a row assigned to someone else.
 */
export async function claimParticipant(participantId: string): Promise<void> {
  const user = await requireUser();
  const p = await prisma.participant.findUnique({
    where: { id: participantId },
    include: { post: true },
  });
  if (!p) throw new Error("NOT_FOUND");
  if (p.post.status === "CLOSED") throw new Error("BILL_CLOSED");
  if (p.slipImagePath) throw new Error("LOCKED");
  const claimable = p.userId === user.id || (p.userId === null && p.guestName === null);
  if (!claimable) throw new Error("FORBIDDEN");

  await prisma.participant.update({
    where: { id: participantId },
    data: { userId: user.id, guestName: null },
  });
  revalidatePath(`/posts/${p.postId}`);
  notifyPostUpdate(p.postId);
}

/** Self-service release: undo a claim you made, back to unassigned. */
export async function unclaimParticipant(participantId: string): Promise<void> {
  const user = await requireUser();
  const p = await prisma.participant.findUnique({
    where: { id: participantId },
    include: { post: true },
  });
  if (!p) throw new Error("NOT_FOUND");
  if (p.post.status === "CLOSED") throw new Error("BILL_CLOSED");
  if (p.slipImagePath) throw new Error("LOCKED");
  if (p.userId !== user.id) throw new Error("FORBIDDEN");

  await prisma.participant.update({
    where: { id: participantId },
    data: { userId: null },
  });
  revalidatePath(`/posts/${p.postId}`);
  notifyPostUpdate(p.postId);
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
  notifyPostUpdate(p.postId);
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
  notifyPostUpdate(p.postId);
}

/** Owner-only: get the post's public guest-share token, generating one if it doesn't exist yet. */
export async function getOrCreateShareLink(postId: string): Promise<string> {
  const post = await assertOwner(postId);
  if (post.shareToken) return post.shareToken;

  const token = crypto.randomUUID();
  await prisma.post.update({ where: { id: postId }, data: { shareToken: token } });
  return token;
}

export async function togglePostStatus(postId: string): Promise<void> {
  const post = await assertOwner(postId);
  await prisma.post.update({
    where: { id: postId },
    data: { status: post.status === "OPEN" ? "CLOSED" : "OPEN" },
  });
  revalidatePath(`/posts/${postId}`);
  notifyPostUpdate(postId);
}

export async function loadMorePosts(
  type: "owned" | "tagged" | "search",
  offset: number,
  limit: number = 6,
  query: string = "",
  status: string = "all"
): Promise<any[]> {
  const user = await requireUser();

  let posts;
  if (type === "owned") {
    const where: any = { ownerId: user.id, deletedAt: null };
    if (status === "open") where.status = "OPEN";
    else if (status === "closed") where.status = "CLOSED";

    posts = await prisma.post.findMany({
      where,
      include: { owner: true, participants: true },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    });
  } else if (type === "tagged") {
    const where: any = {
      ownerId: { not: user.id },
      participants: { some: { userId: user.id } },
      deletedAt: null,
    };
    if (status === "open") where.status = "OPEN";
    else if (status === "closed") where.status = "CLOSED";

    posts = await prisma.post.findMany({
      where,
      include: { owner: true, participants: true },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    });
  } else {
    // type === "search"
    const trimmedQuery = query.trim();
    const where: any = { deletedAt: null };
    if (trimmedQuery) {
      where.OR = [
        { title: { contains: trimmedQuery, mode: "insensitive" } },
        { note: { contains: trimmedQuery, mode: "insensitive" } },
        { owner: { name: { contains: trimmedQuery, mode: "insensitive" } } },
      ];
    }
    if (status === "open") where.status = "OPEN";
    else if (status === "closed") where.status = "CLOSED";

    posts = await prisma.post.findMany({
      where,
      include: { owner: true, participants: true },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    });
  }

  return posts.map((p) => {
    const mine = p.participants.find((x) => x.userId === user.id);
    return {
      id: p.id,
      title: p.title,
      ownerName: p.owner.name,
      dateLabel: p.createdAt.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "2-digit",
      }),
      total: p.participants.reduce((s, x) => s + x.amountToPay, 0),
      count: p.participants.length,
      paidCount: p.participants.filter((x) => x.paymentStatus === "PAID").length,
      myAmount: mine?.amountToPay,
      myStatus: mine?.paymentStatus,
    };
  });
}

/** Soft delete: move the bill to the owner's bin (restorable). */
export async function deletePost(postId: string): Promise<void> {
  await assertOwner(postId);

  await prisma.post.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/");
  redirect("/");
}

/** Restore a binned bill back to active use. */
export async function restorePost(postId: string): Promise<void> {
  const user = await requireUser();
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.ownerId !== user.id || !post.deletedAt) throw new Error("FORBIDDEN");

  await prisma.post.update({
    where: { id: postId },
    data: { deletedAt: null },
  });

  revalidatePath("/bin");
  revalidatePath("/");
  redirect(`/posts/${postId}`);
}
