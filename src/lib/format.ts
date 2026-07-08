/** Format a number as Thai Baht, e.g. 70.25 -> "฿70.25". */
export function baht(n: number): string {
  return "฿" + n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const PAYMENT_LABELS: Record<string, string> = {
  UNPAID: "ยังไม่จ่าย",
  SLIP_UPLOADED: "แนบสลิปแล้ว",
  PAID: "จ่ายแล้ว",
};

export function paymentLabel(status: string): string {
  return PAYMENT_LABELS[status] ?? status;
}
