"use client";

import { useState, type ComponentProps } from "react";
import ShareBillModal from "@/components/ShareBillModal";
import { useI18n } from "@/lib/i18n";

// ponytail: its own modal instance, separate from the one in ParticipantTable's
// header. Lift the modal to a shared parent only if a third trigger appears.
type Props = Omit<ComponentProps<typeof ShareBillModal>, "isOpen" | "onClose">;

export default function ShareBillButton(props: Props) {
  const [open, setOpen] = useState(false);
  const { lang } = useI18n();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-brand/40 bg-brand/5 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/10 active:scale-[.98]"
      >
        {lang === "th" ? "แชร์บิล" : "Share bill"}
      </button>
      <ShareBillModal isOpen={open} onClose={() => setOpen(false)} {...props} />
    </>
  );
}
