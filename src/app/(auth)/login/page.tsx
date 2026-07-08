"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type FormState } from "@/actions/auth";
import SubmitButton from "@/components/SubmitButton";

export default function LoginPage() {
  const [state, formAction] = useActionState<FormState, FormData>(
    loginAction,
    undefined
  );

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">เข้าสู่ระบบ</h2>
      <form action={formAction} className="space-y-4">
        <Field label="อีเมล" name="email" type="email" placeholder="you@company.com" />
        <Field label="รหัสผ่าน" name="password" type="password" placeholder="••••••" />
        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}
        <SubmitButton>เข้าสู่ระบบ</SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        ยังไม่มีบัญชี?{" "}
        <Link href="/register" className="font-semibold text-brand">
          สมัครสมาชิก
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
