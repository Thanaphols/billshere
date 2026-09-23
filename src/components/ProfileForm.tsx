"use client";

import { useActionState, useEffect, useState } from "react";
import { updateProfile, type ProfileState } from "@/actions/profile";
import SubmitButton from "@/components/SubmitButton";
import { useToast } from "@/components/Toast";

export default function ProfileForm({
  name,
  promptpayNumber,
  promptpayExtras,
  onSuccess,
}: {
  name: string;
  promptpayNumber: string;
  promptpayExtras: string[];
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState<ProfileState, FormData>(
    updateProfile,
    undefined
  );
  const toast = useToast();
  // Main number sits at index 0 of the saved list; the radio picks which one is main.
  const [numbers, setNumbers] = useState([promptpayNumber, ...promptpayExtras]);
  const [mainIdx, setMainIdx] = useState(0);

  useEffect(() => {
    if (state?.ok) {
      toast("บันทึกแล้ว");
      if (onSuccess) {
        const timer = setTimeout(() => {
          onSuccess();
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [state?.ok, onSuccess, toast]);

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
      <div>
        <span className="mb-1 block text-sm font-medium">
          เบอร์ PromptPay (สำหรับรับเงิน)
        </span>
        <span className="mb-2 block text-xs text-muted">
          เลือก ◉ เบอร์หลัก — ใช้เป็นตัวเลือกแรกของช่องทางชำระเงินในบิล
        </span>
        <input type="hidden" name="promptpayMain" value={mainIdx} />
        <div className="space-y-2">
          {numbers.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                checked={mainIdx === i}
                onChange={() => setMainIdx(i)}
                aria-label="ตั้งเป็นเบอร์หลัก"
                className="h-4 w-4 shrink-0 accent-brand"
              />
              <input
                name="promptpayNumbers"
                value={n}
                onChange={(e) => setNumbers(numbers.map((x, j) => (j === i ? e.target.value : x)))}
                inputMode="numeric"
                placeholder="เช่น 0812345678 หรือเลขบัตร 13 หลัก"
                className="w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand"
              />
              {numbers.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setNumbers(numbers.filter((_, j) => j !== i));
                    setMainIdx(mainIdx === i ? 0 : mainIdx > i ? mainIdx - 1 : mainIdx);
                  }}
                  className="rounded-xl border border-red-200 px-3 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
                  aria-label="ลบเบอร์"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setNumbers([...numbers, ""])}
        className="text-sm font-bold text-brand hover:underline"
      >
        + เพิ่มเบอร์ PromptPay
      </button>
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
