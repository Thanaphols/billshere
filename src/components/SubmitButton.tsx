"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({
  children,
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`inline-flex w-full items-center justify-center rounded-xl bg-brand px-4 py-3 font-semibold text-white transition active:scale-[.98] disabled:opacity-60 ${className}`}
    >
      {pending ? "กำลังทำงาน…" : children}
    </button>
  );
}
