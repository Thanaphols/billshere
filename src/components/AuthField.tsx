"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Inline validation message (empty / bad email / too short). Empty string = valid. */
export function validate(label: string, type: string, value: string, minLength = 0): string {
  if (!value.trim()) return `กรุณากรอก${label}`;
  if (type === "email" && !EMAIL_RE.test(value)) return "อีเมลไม่ถูกต้อง";
  if (minLength && value.length < minLength) return `${label}ต้องอย่างน้อย ${minLength} ตัวอักษร`;
  return "";
}

/** Controlled field state + handlers. `check()` validates now and returns true when valid. */
export function useField(label: string, type: string, minLength = 0) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  return {
    error,
    inputProps: {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
        if (error) setError(validate(label, type, e.target.value, minLength)); // clear as they fix it
      },
      onBlur: (e: React.FocusEvent<HTMLInputElement>) =>
        setError(validate(label, type, e.target.value, minLength)),
    },
    check() {
      const err = validate(label, type, value, minLength);
      setError(err);
      return !err;
    },
  };
}

export function AuthField({
  label,
  type,
  error,
  ...props
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <div className="relative">
        <input
          {...props}
          type={isPassword && show ? "text" : type}
          className="w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-brand"
          >
            {show ? <EyeOff /> : <Eye />}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </label>
  );
}

function Eye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
