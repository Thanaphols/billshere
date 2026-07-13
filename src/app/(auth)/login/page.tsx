"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type FormState } from "@/actions/auth";
import SubmitButton from "@/components/SubmitButton";
import { AuthField, useField } from "@/components/AuthField";

export default function LoginPage() {
  const [state, formAction] = useActionState<FormState, FormData>(
    loginAction,
    undefined
  );
  const email = useField("อีเมล", "email");
  const password = useField("รหัสผ่าน", "password");

  function onSubmit(formData: FormData) {
    // Validate before hitting the server action — blocking it avoids React's
    // post-action form reset, so the typed values stay put.
    const ok = [email.check(), password.check()].every(Boolean);
    if (!ok) return;
    formAction(formData);
  }

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">เข้าสู่ระบบ</h2>
      <form action={onSubmit} className="space-y-4" noValidate>
        <AuthField
          label="อีเมล"
          name="email"
          type="email"
          placeholder="you@company.com"
          error={email.error}
          {...email.inputProps}
        />
        <AuthField
          label="รหัสผ่าน"
          name="password"
          type="password"
          placeholder="••••••"
          error={password.error}
          {...password.inputProps}
        />
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
