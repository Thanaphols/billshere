"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type FormState } from "@/actions/auth";
import SubmitButton from "@/components/SubmitButton";
import { AuthField, useField } from "@/components/AuthField";

export default function RegisterPage() {
  const [state, formAction] = useActionState<FormState, FormData>(
    registerAction,
    undefined
  );
  const name = useField("ชื่อ", "text");
  const email = useField("อีเมล", "email");
  const password = useField("รหัสผ่าน", "password", 6);

  function onSubmit(formData: FormData) {
    // Validate before the server action so a failed submit keeps the typed values.
    const ok = [name.check(), email.check(), password.check()].every(Boolean);
    if (!ok) return;
    formAction(formData);
  }

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">สมัครสมาชิก</h2>
      <form action={onSubmit} className="space-y-4" noValidate>
        <AuthField
          label="ชื่อ"
          name="name"
          type="text"
          placeholder="ชื่อของคุณ"
          error={name.error}
          {...name.inputProps}
        />
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
          placeholder="อย่างน้อย 6 ตัว"
          error={password.error}
          {...password.inputProps}
        />
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
