import { t, type Lang } from "./i18n-dict";

/** Format a number as Thai Baht, e.g. 70.25 -> "฿70.25". */
export function baht(n: number): string {
  return "฿" + n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Delivery fee: zero reads as "free" instead of "฿0.00". */
export function deliveryFeeText(n: number, lang: Lang): string {
  return n === 0 ? t("bill.free", lang) : baht(n);
}

const PAYMENT_LABELS: Record<string, string> = {
  UNPAID: "ยังไม่จ่าย",
  SLIP_UPLOADED: "แนบสลิปแล้ว",
  PAID: "จ่ายแล้ว",
};

export function paymentLabel(status: string): string {
  return PAYMENT_LABELS[status] ?? status;
}
