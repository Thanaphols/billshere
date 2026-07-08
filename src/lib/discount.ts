import type { DiscountType } from "@prisma/client";

export type LineInput = {
  /** Original price of this person's item. */
  price: number;
};

export type LineResult = {
  /** How much discount this line receives. */
  discountShare: number;
  /** Final amount this person pays (price - discountShare). */
  amountToPay: number;
};

/**
 * Compute each participant's discount share and final amount.
 *
 * FIXED   – the total discount (baht) is split equally across all participants,
 *           matching the current spreadsheet workflow (70 / 8 = 8.75 each).
 * PERCENT – each line gets `value`% off its own price.
 * NONE    – no discount.
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

  return lines.map((line) => {
    let discountShare = 0;

    if (discountType === "FIXED") {
      discountShare = value / count;
    } else if (discountType === "PERCENT") {
      discountShare = (line.price * value) / 100;
    }

    // Never discount below zero.
    discountShare = Math.min(discountShare, line.price);

    const amountToPay = round2(line.price - discountShare);
    return { discountShare: round2(discountShare), amountToPay };
  });
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Human label for the discount setting. */
export function discountLabel(type: DiscountType, value: number): string {
  if (type === "FIXED") return `ส่วนลดรวม ${round2(value)} บาท (หารเท่ากัน)`;
  if (type === "PERCENT") return `ส่วนลด ${round2(value)}%`;
  return "ไม่มีส่วนลด";
}
