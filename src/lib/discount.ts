import type { DiscountType } from "@prisma/client";

export type LineInput = {
  /** Original price of this person's item. */
  price: number;
};

export type LineResult = {
  /** How much discount this line receives. */
  discountShare: number;
  /** Amount owed for the item after discount — does NOT include delivery fee. */
  itemAmount: number;
};

/**
 * Compute each participant's discount share and item amount (pre-delivery-fee).
 *
 * FIXED   – split the WHOLE bill equally: everyone pays the average
 *           (Σ price / people). Ignores `value`. No per-item discount.
 * PERCENT – each line gets `value`% off its own price.
 * NONE    – no discount.
 *
 * Pure function — safe to import from both client components (for live
 * previews) and server actions (for the persisted computation); the numbers
 * always match exactly.
 *
 * Money is rounded to 2 decimals to avoid floating point drift.
 */
export function computeAmounts(
  lines: LineInput[],
  discountType: DiscountType,
  value: number
): LineResult[] {
  const count = lines.length;
  if (count === 0) return [];

  // For "หารเท่ากัน" everyone pays the same share of the whole bill.
  const total = lines.reduce((s, l) => s + l.price, 0);
  const equalShare = round2(total / count);

  return lines.map((line) => {
    if (discountType === "FIXED") {
      return { discountShare: 0, itemAmount: equalShare };
    }

    let discountShare = 0;
    if (discountType === "PERCENT") {
      discountShare = (line.price * value) / 100;
    }

    // Never discount below zero.
    discountShare = Math.min(discountShare, line.price);

    const itemAmount = round2(line.price - discountShare);
    return { discountShare: round2(discountShare), itemAmount };
  });
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Delivery fee is entered by the owner as one total plus a manual head count
 * (not tied to menu items/assignment — one person may own several items, so
 * splitting per line never matched splitting per person anyway). This is a
 * summary-only figure, not added into any participant's amountToPay.
 */
export function perHeadDeliveryFee(fee: number, count: number): number {
  return count > 0 ? round2(fee / count) : 0;
}

/** Human label for the discount setting. */
export function discountLabel(type: DiscountType, value: number): string {
  if (type === "FIXED") return "หารเท่ากันทั้งบิล (ทุกคนจ่ายเท่ากัน)";
  if (type === "PERCENT") return `ส่วนลด ${round2(value)}%`;
  return "ไม่มีส่วนลด";
}
