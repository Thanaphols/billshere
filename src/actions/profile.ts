"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export type ProfileState = { error?: string; ok?: boolean } | undefined;

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await requireUser();
  const name = (formData.get("name") ?? "").toString().trim();
  const promptpayNumber = (formData.get("promptpayNumber") ?? "")
    .toString()
    .replace(/[\s-]/g, "")
    .trim();

  if (!name) return { error: "กรุณากรอกชื่อ" };
  if (promptpayNumber && !/^\d{10}$|^\d{13}$/.test(promptpayNumber)) {
    return { error: "PromptPay ต้องเป็นเบอร์ 10 หลัก หรือเลขบัตร 13 หลัก" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name, promptpayNumber: promptpayNumber || null },
  });

  revalidatePath("/profile");
  return { ok: true };
}
