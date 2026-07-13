import type { DiscountType } from "@prisma/client";

export type BillRow = {
  id: string;
  price: number;
  /** Groups rows owned by the same payer: userId → guestClaimToken → guestName → per-row for unassigned. */
  ownerKey: string;
};

export type BillSettings = {
  /** FIXED = everyone pays equal; PERCENT (and legacy NONE) = pay your own items. */
  discountType: DiscountType;
  /** D — discount as a baht total (split across personCount). */
  discountValue: number;
  /** S — delivery as a baht total (split across personCount). */
  deliveryFee: number;
  /** N — manual head count; divides BOTH discount and delivery. */
  personCount: number;
};

export type BillResult = {
  id: string;
  /** Final amount owed for this row — discount AND delivery already folded in. */
  amountToPay: number;
  /** price − amountToPay, floored at 0 (display only). */
  discountShare: number;
};

/**
 * Compute each row's final payable under the person-based model.
 *
 * Let Σ = sum of all prices, D = discountValue, S = deliveryFee, N = personCount,
 * ownItems = sum of one payer's rows. Per payer:
 *   FIXED   → (Σ − D + S) / N        (everyone equal, regardless of items)
 *   PERCENT → ownItems − D/N + S/N   (pay your own items, share discount+delivery)
 * Clamped at 0.
 *
 * A payer may own several rows, but amountToPay is stored per row, so each payer's
 * total is distributed back across their rows proportional to price (equal split if
 * their prices sum to 0); the last row absorbs rounding drift so the rows re-sum
 * exactly to the payer total.
 *
 * NOTE: N is entered manually and may differ from the actual number of payer groups.
 * In FIXED that means Σ(all rows) only equals the true bill total when groupCount === N
 * — intentional: N is the owner's divisor knob, not auto-reconciled.
 *
 * Pure — safe to import from client components (live preview) and server actions.
 */
export function computeBill(rows: BillRow[], s: BillSettings): BillResult[] {
  const N = Math.max(1, Math.round(s.personCount) || 1);
  const D = Math.max(0, s.discountValue);
  const S = Math.max(0, s.deliveryFee);
  const total = rows.reduce((a, r) => a + r.price, 0);

  // Group rows by ownerKey, preserving first-seen order.
  const groups = new Map<string, BillRow[]>();
  for (const r of rows) {
    const g = groups.get(r.ownerKey) ?? [];
    g.push(r);
    groups.set(r.ownerKey, g);
  }

  const out = new Map<string, BillResult>();
  for (const g of groups.values()) {
    const ownItems = g.reduce((a, r) => a + r.price, 0);
    const personTotal = Math.max(
      0,
      s.discountType === "FIXED" ? (total - D + S) / N : ownItems - D / N + S / N
    );

    let acc = 0;
    g.forEach((r, i) => {
      const share =
        i === g.length - 1
          ? round2(personTotal - acc) // last row absorbs rounding drift
          : round2(ownItems > 0 ? personTotal * (r.price / ownItems) : personTotal / g.length);
      acc = round2(acc + share);
      out.set(r.id, {
        id: r.id,
        amountToPay: share,
        discountShare: round2(Math.max(0, r.price - share)),
      });
    });
  }

  return rows.map((r) => out.get(r.id)!);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type PayerRow = {
  userId: string | null;
  guestName: string | null;
  user?: { name: string } | null;
};

export type PayerGroup<T> = {
  name: string;
  kind: "user" | "guest" | "unassigned";
  items: T[];
};

/**
 * Group rows by who pays: one group per member (userId) and per guest name,
 * with every unassigned row collapsed into a single trailing "ยังไม่ระบุคน" group.
 * Groups keep first-seen order; the unassigned group is always last.
 */
export function groupByPayer<T extends PayerRow>(rows: T[]): PayerGroup<T>[] {
  const groups: PayerGroup<T>[] = [];
  const byKey = new Map<string, PayerGroup<T>>();

  for (const r of rows) {
    let key: string;
    let name: string;
    let kind: PayerGroup<T>["kind"];
    if (r.userId) {
      key = "u:" + r.userId;
      name = r.user?.name ?? "สมาชิก";
      kind = "user";
    } else if (r.guestName) {
      key = "n:" + r.guestName;
      name = r.guestName;
      kind = "guest";
    } else {
      key = "unassigned";
      name = "ยังไม่ระบุคน";
      kind = "unassigned";
    }
    let g = byKey.get(key);
    if (!g) {
      g = { name, kind, items: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.items.push(r);
  }

  return groups.sort((a, b) => {
    const au = a.kind === "unassigned" ? 1 : 0;
    const bu = b.kind === "unassigned" ? 1 : 0;
    return au - bu; // stable: only pushes unassigned to the end
  });
}

/** Group key for a participant row — rows sharing a payer collapse to one key. */
export function ownerKeyOf(p: {
  id: string;
  userId?: string | null;
  guestClaimToken?: string | null;
  guestName?: string | null;
}): string {
  if (p.userId) return "u:" + p.userId;
  if (p.guestClaimToken) return "g:" + p.guestClaimToken;
  if (p.guestName) return "n:" + p.guestName;
  return "row:" + p.id; // unassigned — each row is its own payer
}

/** Human label for the split setting. */
export function discountLabel(type: DiscountType, discountValue: number): string {
  if (type === "FIXED") return "หารเท่ากันทุกรายการ (ทุกคนจ่ายเท่ากัน)";
  return discountValue > 0
    ? `หารตามที่สั่ง · ส่วนลด ฿${round2(discountValue)}`
    : "หารตามที่สั่ง";
}

/** assert-based self-check — run via a throwaway script, no test framework. */
export function demo(): void {
  const two: BillRow[] = [
    { id: "A", price: 100, ownerKey: "p1" },
    { id: "B", price: 60, ownerKey: "p2" },
  ];
  const f = computeBill(two, { discountType: "FIXED", discountValue: 40, deliveryFee: 30, personCount: 2 });
  console.assert(f[0].amountToPay === 75 && f[1].amountToPay === 75, "FIXED 75/75", f);

  const p = computeBill(two, { discountType: "PERCENT", discountValue: 40, deliveryFee: 30, personCount: 2 });
  console.assert(p[0].amountToPay === 95 && p[1].amountToPay === 55, "PERCENT 95/55", p);

  // Multi-row payer: rows must re-sum to the payer total (140 − 20 + 15 = 135).
  const m = computeBill(
    [
      { id: "A", price: 100, ownerKey: "p1" },
      { id: "C", price: 40, ownerKey: "p1" },
      { id: "B", price: 60, ownerKey: "p2" },
    ],
    { discountType: "PERCENT", discountValue: 40, deliveryFee: 30, personCount: 2 }
  );
  console.assert(round2(m[0].amountToPay + m[1].amountToPay) === 135, "p1 multi-row sum 135", m);

  // groupByPayer: unassigned rows collapse into one trailing group.
  const g = groupByPayer([
    { userId: "u1", guestName: null, user: { name: "A" } },
    { userId: null, guestName: null },
    { userId: "u1", guestName: null, user: { name: "A" } },
    { userId: null, guestName: "B" },
    { userId: null, guestName: null },
  ]);
  console.assert(g.length === 3, "3 groups (A, B, unassigned)", g);
  console.assert(g[0].name === "A" && g[0].items.length === 2, "A has 2", g);
  console.assert(g[2].kind === "unassigned" && g[2].items.length === 2, "unassigned last, 2 rows", g);

  console.log("discount.demo OK");
}
