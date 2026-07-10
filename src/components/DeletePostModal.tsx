"use client";

import React, { useTransition } from "react";
import { deletePost } from "@/actions/posts";
import { useI18n } from "@/lib/i18n";

export default function DeletePostModal({
  isOpen,
  onClose,
  postId,
}: {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const { t, lang } = useI18n();

  const handleDelete = () => {
    startTransition(async () => {
      await deletePost(postId);
      onClose();
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-border flex flex-col space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <h3 className="text-sm font-bold text-foreground">
            {lang === "th" ? "ยืนยันการลบบิล" : "Confirm Delete Bill"}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xs font-semibold">
            {t("close")}
          </button>
        </div>

        {/* Body */}
        <p className="text-sm text-muted">
          {lang === "th"
            ? "คุณแน่ใจหรือไม่ว่าต้องการลบบิลนี้ถาวร? การดำเนินการนี้ไม่สามารถย้อนกลับได้."
            : "Are you sure you want to permanently delete this bill? This action cannot be undone."}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-muted hover:bg-muted/10 transition"
          >
            {lang === "th" ? "ยกเลิก" : "Cancel"}
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 transition flex items-center gap-1.5"
          >
            {isPending && (
              <span className="w-3 h-3 rounded-full border-2 border-t-white border-transparent animate-spin" />
            )}
            {lang === "th" ? "ลบบิล" : "Delete Bill"}
          </button>
        </div>
      </div>
    </div>
  );
}
