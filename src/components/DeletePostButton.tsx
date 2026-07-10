"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import DeletePostModal from "./DeletePostModal";

export default function DeletePostButton({ postId }: { postId: string }) {
  const { lang } = useI18n();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100 transition active:scale-[.98] select-none cursor-pointer flex items-center justify-center gap-1.5"
      >
        {lang === "th" ? "ลบบิลนี้ถาวร" : "Delete Bill Permanently"}
      </button>

      <DeletePostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        postId={postId}
      />
    </>
  );
}

