"use client";

import React, { useState } from "react";
import Link from "next/link";
import ProfileForm from "@/components/ProfileForm";
import { logoutAction } from "@/actions/auth";
import { generateLoginQr } from "@/actions/qrLogin";
import { useI18n } from "@/lib/i18n";
import Dropdown from "@/components/Dropdown";

export default function ProfileView({
  user,
  qrs,
}: {
  user: { name: string; email: string; promptpayNumber: string | null; promptpayExtras: string[] };
  qrs: { number: string; qr: string }[];
}) {
  const [picked, setQrNumber] = useState("");
  // Fall back to the first number if the picked one was removed.
  const current = qrs.find((q) => q.number === picked) ?? qrs[0];
  const qrNumber = current?.number ?? "";
  const qr = current?.qr ?? null;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [loginQr, setLoginQr] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const { t, lang } = useI18n();

  async function showLoginQr() {
    setQrLoading(true);
    try {
      const { qr } = await generateLoginQr();
      setLoginQr(qr);
    } finally {
      setQrLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Account Info Card */}
      <div className="rounded-2xl bg-surface p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("profile.title")}</h2>
          <button
            onClick={() => setIsEditOpen(true)}
            className="rounded-xl border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand/10 transition active:scale-[.95]"
          >
            {t("profile.edit")}
          </button>
        </div>

        <div className="border-t border-border/60 pt-3 text-xs space-y-2.5">
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted">{t("profile.name")}</span>
            <span className="font-semibold text-foreground">{user.name}</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted">{t("profile.email")}</span>
            <span className="font-semibold text-foreground">{user.email}</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted">{t("profile.promptpay")}</span>
            {user.promptpayNumber ? (
              <span className="font-semibold text-foreground">{user.promptpayNumber}</span>
            ) : (
              <span className="font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100 flex items-center gap-1 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                {t("profile.warning.promptpay")}
              </span>
            )}
          </div>
          {user.promptpayExtras.map((n) => (
            <div key={n} className="flex justify-between items-center py-0.5">
              <span className="text-muted">{lang === "th" ? "เบอร์เพิ่มเติม" : "Extra number"}</span>
              <span className="font-semibold text-foreground">{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* QR Code Card */}
      {user.promptpayNumber && qr ? (
        <div className="rounded-2xl bg-surface p-4 shadow-sm">
          <h3 className="mb-3 font-semibold text-sm">{t("bill.totalAmount")} (QR)</h3>
          {qrs.length > 1 && (
            <div className="mb-3">
              <Dropdown
                value={qrNumber}
                onChange={setQrNumber}
                options={qrs.map((q) => ({ value: q.number, label: q.number }))}
                placeholder="PromptPay"
              />
            </div>
          )}
          <div className="flex justify-center bg-white p-4 rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="My PromptPay QR" width={220} height={220} />
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            {lang === "th"
              ? "คนที่ถูกแท็กในบิลของคุณจะเห็น QR นี้พร้อมยอดที่ต้องจ่าย"
              : "People tagged in your bill will see this QR with their amount to pay."}
          </p>
        </div>
      ) : (
        /* Blurred Placeholder QR Card */
        <div className="relative rounded-2xl bg-surface p-4 shadow-sm overflow-hidden flex flex-col items-center justify-center min-h-[300px]">
          {/* Background content to be blurred */}
          <div className="w-full flex flex-col items-center select-none pointer-events-none filter blur-[6px] opacity-35">
            <h3 className="mb-3 font-semibold text-sm text-center w-full">{t("bill.totalAmount")} (QR)</h3>
            <div className="flex justify-center bg-white p-4 rounded-xl border border-border">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-[180px] h-[180px] text-muted">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h.008v.008H3.75V12Zm0 3.75h.008v.008H3.75v-.008Zm0 3.75h.008v.008H3.75v-.008Zm3.75-3.75h.008v.008H7.5v-.008Zm3.75 3.75h.008v.008h-.008v-.008Zm0-3.75h.008v.008h-.008v-.008Zm3.75 3.75h.008v.008h-.008v-.008Zm0-3.75h.008v.008h-.008v-.008Zm3.75-3.75h.008v.008h-.008v-.008Zm0-3.75h.008v.008h-.008V4.5Zm3.75 0h.008v.008h-.008V4.5Zm0 3.75h.008v.008h-.008V8.25Z" />
              </svg>
            </div>
            <p className="mt-2 text-center text-xs text-muted">
              {lang === "th"
                ? "คนที่ถูกแท็กในบิลของคุณจะเห็น QR นี้พร้อมยอดที่ต้องจ่าย"
                : "People tagged in your bill will see this QR with their amount to pay."}
            </p>
          </div>
          {/* Centered Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-foreground/10 backdrop-blur-[2.5px]">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 border border-amber-200/80 shadow-lg max-w-[280px] flex flex-col items-center space-y-2.5 animate-fade-in">
              <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <p className="text-xs font-bold text-foreground leading-relaxed">
                {t("profile.warning.qr")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile login QR */}
      <div className="rounded-2xl bg-surface p-4 shadow-sm space-y-3">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-brand">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
            {lang === "th" ? "เข้าสู่ระบบบนมือถือ" : "Sign in on mobile"}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {lang === "th"
              ? "สแกน QR นี้ด้วยมือถือเพื่อเข้าสู่ระบบบัญชีเดียวกัน"
              : "Scan this QR with your phone to sign in to the same account."}
          </p>
        </div>

        {loginQr ? (
          <div className="flex flex-col items-center space-y-2">
            <div className="flex justify-center bg-white p-4 rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={loginQr} alt="Login QR" width={220} height={220} />
            </div>
            <p className="text-center text-xs text-amber-600 font-semibold">
              {lang === "th"
                ? "หมดอายุใน 5 นาที · อย่าแชร์ให้คนอื่น"
                : "Expires in 5 min · don't share with anyone"}
            </p>
            <button
              onClick={showLoginQr}
              disabled={qrLoading}
              className="text-xs font-bold text-brand hover:underline disabled:opacity-50"
            >
              {lang === "th" ? "สร้าง QR ใหม่" : "Generate new QR"}
            </button>
          </div>
        ) : (
          <button
            onClick={showLoginQr}
            disabled={qrLoading}
            className="w-full rounded-xl border border-brand/20 bg-brand/5 py-2.5 text-xs font-bold text-brand hover:bg-brand/10 transition active:scale-[.98] disabled:opacity-50"
          >
            {qrLoading
              ? lang === "th" ? "กำลังสร้าง…" : "Generating…"
              : lang === "th" ? "แสดง QR เข้าสู่ระบบ" : "Show login QR"}
          </button>
        )}
      </div>

      {/* Bin link */}
      <Link
        href="/bin"
        className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-sm text-sm font-semibold text-foreground hover:bg-muted/10 transition active:scale-[.99]"
      >
        <span className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-muted">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
          {lang === "th" ? "ถังขยะ (บิลที่ลบ)" : "Bin (deleted bills)"}
        </span>
        <span className="text-muted">›</span>
      </Link>

      {/* Logout */}
      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full rounded-2xl border border-red-200 bg-red-50 py-4 text-sm font-bold text-red-600 shadow-sm hover:bg-red-100 transition active:scale-[.98]"
        >
          {t("profile.logout")}
        </button>
      </form>

      {/* Edit Profile Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-border flex flex-col space-y-4 animate-fade-in">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="text-sm font-bold text-foreground">{t("profile.edit")}</h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-muted hover:text-foreground text-xs font-semibold"
              >
                {t("close")}
              </button>
            </div>

            {/* Profile form */}
            <ProfileForm
              name={user.name}
              promptpayNumber={user.promptpayNumber ?? ""}
              promptpayExtras={user.promptpayExtras}
              onSuccess={() => setIsEditOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
