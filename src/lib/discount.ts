import type { DiscountType } from "@prisma/client";

export type BillRow = {
  id: string;
  price: number;
  /** Per-item discount in baht, subtracted from price before the bill-level split. Default 0. */
  discount?: number;
  /** Groups rows owned by the same payer: userId → guestClaimToken → guestName → per-row for unassigned. */
  ownerKey: string;
};

/** Price this row actually contributes to the bill — original minus its own item discount, floored at 0. */
function effPrice(r: BillRow): number {
  return Math.max(0, r.price - (r.discount ?? 0));
}

export type BillSettings = {
  /** FIXED = everyone pays equal; PERCENT (and legacy NONE) = pay your own items. */
  discountType: DiscountType;
  /** D — discount as a baht total (split across personCount). */
  discountValue: number;
  /** S — delivery as a baht total (split across personCount). */
  deliveryFee: number;
  /** N — manual head count; divides BOTH discount and delivery. */
  personCount: number;
  /** ownerKey of the bill owner — absorbs the delivery rounding remainder. Omit to drop it. */
  ownerKey?: string;
};

/**
 * Split the delivery fee into a per-head amount everyone pays and the rounding
 * remainder. Rounding S/N to satang leaves S − perHead·N unpaid (฿10 / 3 →
 * ฿3.33 each, ฿0.01 short); the bill owner covers it, so ฿3.33 + ฿0.01 = ฿3.34.
 */
export function deliverySplit(deliveryFee: number, personCount: number) {
  const N = Math.max(1, Math.round(personCount) || 1);
  const perHead = round2(Math.max(0, deliveryFee) / N);
  const remainder = round2(Math.max(0, deliveryFee) - perHead * N);
  return { perHead, remainder, ownerShare: round2(perHead + remainder) };
}

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
 *   FIXED   → (Σ − D)/N + del        (everyone equal, regardless of items)
 *   PERCENT → ownItems − D/N + del   (pay your own items, share discount+delivery)
 * where del = deliverySplit(S, N).perHead, and the owner group pays .ownerShare
 * instead so the rounding remainder is not silently dropped.
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
  const total = rows.reduce((a, r) => a + effPrice(r), 0);
  const delivery = deliverySplit(S, N);

  // Group rows by ownerKey, preserving first-seen order.
  const groups = new Map<string, BillRow[]>();
  for (const r of rows) {
    const g = groups.get(r.ownerKey) ?? [];
    g.push(r);
    groups.set(r.ownerKey, g);
  }

  const out = new Map<string, BillResult>();
  for (const g of groups.values()) {
    const ownItems = g.reduce((a, r) => a + effPrice(r), 0);
    // Everyone pays the rounded per-head delivery; the owner also eats the remainder.
    const deliveryShare =
      s.ownerKey != null && g[0].ownerKey === s.ownerKey ? delivery.ownerShare : delivery.perHead;
    // What the payer actually owes — delivery folded in.
    const personTotal = Math.max(
      0,
      (s.discountType === "FIXED" ? (total - D) / N : ownItems - D / N) + deliveryShare
    );
    // Same figure WITHOUT delivery — the reference for discountShare, so delivery
    // (an addition) never cancels out the discount shown on a row.
    const personNoDelivery = Math.max(
      0,
      s.discountType === "FIXED" ? (total - D) / N : ownItems - D / N
    );

    let acc = 0;
    let accRef = 0;
    g.forEach((r, i) => {
      const isLast = i === g.length - 1;
      const frac = ownItems > 0 ? effPrice(r) / ownItems : 1 / g.length;
      const share = isLast
        ? round2(personTotal - acc) // last row absorbs rounding drift
        : round2(personTotal * frac);
      const refShare = isLast ? round2(personNoDelivery - accRef) : round2(personNoDelivery * frac);
      acc = round2(acc + share);
      accRef = round2(accRef + refShare);
      out.set(r.id, {
        id: r.id,
        amountToPay: share,
        // Discount shown = original price − delivery-excluded payable, i.e. the
        // per-item discount plus the row's bill-level discount share (no delivery).
        discountShare: round2(Math.max(0, r.price - refShare)),
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
  if (type === "FIXED") return "หารทั้งบิลตามจำนวนคน (ทุกคนจ่ายเท่ากัน)";
  return discountValue > 0
    ? `หารรายการตามจำนวนคน · ส่วนลด ฿${round2(discountValue)}`
    : "หารรายการตามจำนวนคน";
}

/**
 * Split payer groups into receipt pages of at most `maxRows` item rows.
 *
 * A group moves to the next page rather than being cut in half — unless it is too
 * big to fit on a page of its own, in which case it spills over: every chunk keeps
 * the payer name (`cont` flags the continuation) and only the final chunk carries
 * the subtotal. Always returns at least one page.
 */
export function paginateGroups<G extends { items: unknown[]; lines: unknown[] }>(
  groups: G[],
  maxRows: number
): (G & { cont: boolean; showSubtotal: boolean })[][] {
  type Chunk = G & { cont: boolean; showSubtotal: boolean };
  const rowCap = Math.max(1, Math.round(maxRows) || 1);
  const pages: Chunk[][] = [];
  let page: Chunk[] = [];
  let rows = 0;
  const flush = () => {
    pages.push(page);
    page = [];
    rows = 0;
  };

  for (const g of groups) {
    for (let i = 0; i < g.items.length; ) {
      const rest = g.items.length - i;
      // Prefer starting a fresh page over splitting; spill only on an empty page.
      if (page.length && rest > rowCap - rows) {
        flush();
        continue;
      }
      const take = Math.min(rest, rowCap - rows);
      page.push({
        ...g,
        items: g.items.slice(i, i + take),
        lines: g.lines.slice(i, i + take),
        cont: i > 0,
        showSubtotal: i + take === g.items.length,
      } as Chunk);
      rows += take;
      i += take;
      if (rows === rowCap && i < g.items.length) flush();
    }
  }
  pages.push(page); // a bill with no items still renders one (empty) page
  return pages;
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

  // Per-item discount stacks with the bill-level split: A's effective price is
  // 100−20=80, so PERCENT (no bill discount/delivery) pays 80, and discountShare
  // reports the full 20 off the original.
  const d = computeBill(
    [
      { id: "A", price: 100, discount: 20, ownerKey: "p1" },
      { id: "B", price: 60, ownerKey: "p2" },
    ],
    { discountType: "PERCENT", discountValue: 0, deliveryFee: 0, personCount: 2 }
  );
  console.assert(d[0].amountToPay === 80 && d[0].discountShare === 20, "item discount 80/-20", d);
  console.assert(d[1].amountToPay === 60, "undiscounted row unchanged", d);

  // Delivery must NOT cancel the item discount shown: 30−5 item disc, +10/3 delivery.
  // Payable = 25 + 3.33 = 28.33, but discountShare stays the pure 5 off.
  const dd = computeBill(
    [{ id: "A", price: 30, discount: 5, ownerKey: "p1" }],
    { discountType: "PERCENT", discountValue: 0, deliveryFee: 10, personCount: 3 }
  );
  console.assert(dd[0].amountToPay === 28.33 && dd[0].discountShare === 5, "delivery keeps discount at 5", dd);

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

  // Delivery rounding remainder lands on the bill owner: ฿10 / 3 → ฿3.33 each,
  // owner ฿3.34, and the three shares re-sum to exactly ฿10.
  const ds = deliverySplit(10, 3);
  console.assert(ds.perHead === 3.33 && ds.remainder === 0.01 && ds.ownerShare === 3.34, "10/3 split", ds);
  const rem = computeBill(
    [
      { id: "A", price: 0, ownerKey: "u:owner" },
      { id: "B", price: 0, ownerKey: "p2" },
      { id: "C", price: 0, ownerKey: "p3" },
    ],
    { discountType: "PERCENT", discountValue: 0, deliveryFee: 10, personCount: 3, ownerKey: "u:owner" }
  );
  console.assert(rem[0].amountToPay === 3.34, "owner absorbs remainder", rem);
  console.assert(round2(rem.reduce((a, r) => a + r.amountToPay, 0)) === 10, "delivery re-sums to 10", rem);

  // Pagination: a 6-item payer cannot fit a 5-row page, so it spills — both chunks
  // keep the name, the continuation is flagged, and only the tail owes a subtotal.
  const mk = (n: number) => ({ items: Array.from({ length: n }, (_, i) => i), lines: Array.from({ length: n }, () => []) });
  const spill = paginateGroups([mk(6)], 5);
  console.assert(spill.length === 2, "6 rows spill onto 2 pages", spill);
  console.assert(spill[0][0].items.length === 5 && !spill[0][0].cont && !spill[0][0].showSubtotal, "head chunk", spill);
  console.assert(spill[1][0].items.length === 1 && spill[1][0].cont && spill[1][0].showSubtotal, "tail chunk", spill);
  // A group that still fits is never cut: 3 + 4 rows go to separate pages, whole.
  const whole = paginateGroups([mk(3), mk(4)], 5);
  console.assert(whole.length === 2 && whole[0].length === 1 && whole[1].length === 1, "no mid-group cut", whole);
  console.assert(whole.every((pg) => pg.every((c) => c.showSubtotal && !c.cont)), "whole groups keep subtotals", whole);
  console.assert(paginateGroups([], 5).length === 1, "empty bill still yields a page");

  console.log("discount.demo OK");
}
