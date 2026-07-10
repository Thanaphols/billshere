"use client";

import React, { useTransition } from "react";
import { useI18n } from "@/lib/i18n";

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { t, lang } = useI18n();

  if (!isOpen) return null;

  const handleConfirm = () => {
    startTransition(async () => {
      await onConfirm();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-border flex flex-col space-y-4 animate-fade-in text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <h3 className="text-sm font-bold text-foreground">
            {title}
          </h3>
          <button 
            onClick={onClose} 
            disabled={isPending}
            className="text-muted hover:text-foreground text-xs font-semibold cursor-pointer"
          >
            {t("close")}
          </button>
        </div>

        {/* Body */}
        <p className="text-sm text-muted">
          {message}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-muted hover:bg-muted/10 transition cursor-pointer"
          >
            {cancelText || (lang === "th" ? "ยกเลิก" : "Cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            {isPending && (
              <span className="w-3 h-3 rounded-full border-2 border-t-white border-transparent animate-spin" />
            )}
            {confirmText || (lang === "th" ? "ยืนยัน" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
