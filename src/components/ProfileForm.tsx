"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/actions/profile";
import SubmitButton from "@/components/SubmitButton";

export default function ProfileForm({
  name,
  promptpayNumber,
}: {
  name: string;
  promptpayNumber: string;
}) {
  const [state, formAction] = useActionState<ProfileState, FormData>(
    updateProfile,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">ชื่อ</span>
        <input
          name="name"
          defaultValue={name}
          required
          className="w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          เบอร์ PromptPay (สำหรับรับเงิน)
        </span>
        <input
          name="promptpayNumber"
          defaultValue={promptpayNumber}
          inputMode="numeric"
          placeholder="เช่น 0812345678 หรือเลขบัตร 13 หลัก"
          className="w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand"
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-600">บันทึกแล้ว ✓</p>}
      <SubmitButton>บันทึกโปรไฟล์</SubmitButton>
    </form>
  );
}
