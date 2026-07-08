"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type FormState } from "@/actions/auth";
import SubmitButton from "@/components/SubmitButton";

export default function RegisterPage() {
  const [state, formAction] = useActionState<FormState, FormData>(
    registerAction,
    undefined
  );

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">สมัครสมาชิก</h2>
      <form action={formAction} className="space-y-4">
        <Field label="ชื่อ" name="name" type="text" placeholder="ชื่อของคุณ" />
        <Field label="อีเมล" name="email" type="email" placeholder="you@company.com" />
        <Field label="รหัสผ่าน" name="password" type="password" placeholder="อย่างน้อย 6 ตัว" />
        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}
        <SubmitButton>สมัครสมาชิก</SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        มีบัญชีอยู่แล้ว?{" "}
        <Link href="/login" className="font-semibold text-brand">
          เข้าสู่ระบบ
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        {...props}
        required
        className="w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand"
      />
    </label>
  );
}
