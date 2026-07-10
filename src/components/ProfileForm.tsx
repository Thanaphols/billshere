"use client";

import { useActionState, useEffect } from "react";
import { updateProfile, type ProfileState } from "@/actions/profile";
import SubmitButton from "@/components/SubmitButton";

export default function ProfileForm({
  name,
  promptpayNumber,
  onSuccess,
}: {
  name: string;
  promptpayNumber: string;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState<ProfileState, FormData>(
    updateProfile,
    undefined
  );

  useEffect(() => {
    if (state?.ok && onSuccess) {
      const timer = setTimeout(() => {
        onSuccess();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [state?.ok, onSuccess]);

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
      {state?.error && (
        <p className="text-sm font-semibold text-red-600 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-red-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="text-sm font-semibold text-green-600 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 text-green-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          บันทึกแล้ว
        </p>
      )}
      <SubmitButton>บันทึกโปรไฟล์</SubmitButton>
    </form>
  );
}
