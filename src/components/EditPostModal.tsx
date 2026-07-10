"use client";

import { useState } from "react";
import { updatePostTitleNote } from "@/actions/posts";
import SubmitButton from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n";

export default function EditPostModal({
  postId,
  defaultTitle,
  defaultNote,
}: {
  postId: string;
  defaultTitle: string;
  defaultNote: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { t, lang } = useI18n();

  const handleSubmit = async (formData: FormData) => {
    await updatePostTitleNote(postId, formData);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-full p-1.5 text-muted hover:bg-muted/20 hover:text-brand transition-all flex items-center justify-center border border-transparent hover:border-border/30"
        title={lang === "th" ? "แก้ไขชื่อและโน้ตบิล" : "Edit Bill Title & Note"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-3.5 h-3.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.84a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="text-sm font-bold text-foreground">
                {lang === "th" ? "แก้ไขหัวข้อบิล" : "Edit Bill Header"}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted hover:text-foreground text-xs font-semibold"
              >
                {t("close")}
              </button>
            </div>

            <form action={handleSubmit} className="mt-3.5 space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                  {t("bill.title")}
                </label>
                <input
                  name="title"
                  defaultValue={defaultTitle}
                  required
                  placeholder={lang === "th" ? "เช่น ค่าพิซซ่าเที่ยงนี้" : "e.g. Lunch Pizza"}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                  {t("bill.note")}
                </label>
                <input
                  name="note"
                  defaultValue={defaultNote ?? ""}
                  placeholder={lang === "th" ? "เช่น หารเฉพาะค่าพิซซ่า, รีบจ่ายนะ" : "e.g. split equally, pay fast"}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-muted hover:bg-muted/10 transition-colors"
                >
                  {lang === "th" ? "ยกเลิก" : "Cancel"}
                </button>
                <SubmitButton>{t("bill.save")}</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
