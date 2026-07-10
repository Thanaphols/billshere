"use client";

import { useI18n } from "@/lib/i18n";

const STYLES: Record<string, string> = {
  UNPAID: "bg-gray-100 text-gray-600",
  SLIP_UPLOADED: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
};

export default function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const labelKey =
    status === "PAID"
      ? "bill.status.paid"
      : status === "SLIP_UPLOADED"
      ? "bill.status.uploaded"
      : "bill.status.unpaid";

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        STYLES[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {t(labelKey as any)}
    </span>
  );
}
