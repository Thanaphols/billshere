"use client";

import { useState } from "react";
import type { DiscountType } from "@prisma/client";
import { computeAmounts } from "@/lib/discount";
import { baht } from "@/lib/format";
import SubmitButton from "@/components/SubmitButton";

export type UserOption = { id: string; name: string; email: string };

/**
 * "เพิ่มผู้จ่าย" form with a live preview of what the new person would owe —
 * computed the same way the server will (same computeAmounts + delivery
 * split), so the number shown here matches what gets saved.
 */
export default function AddParticipantForm({
  action,
  users,
  existingPrices,
  discountType,
  discountValue,
  deliveryFee,
}: {
  action: (formData: FormData) => void;
  users: UserOption[];
  existingPrices: number[];
  discountType: DiscountType;
  discountValue: number;
  deliveryFee: number;
}) {
  const [price, setPrice] = useState("");

  const parsedPrice = parseFloat(price) || 0;
  const lines = [...existingPrices.map((p) => ({ price: p })), { price: parsedPrice }];
  const results = computeAmounts(lines, discountType, discountValue);
  const newCount = lines.length;
  const deliveryShare = deliveryFee > 0 ? deliveryFee / newCount : 0;
  const previewTotal = results[results.length - 1].itemAmount + deliveryShare;

  return (
    <form action={action} className="mt-3 space-y-3">
      <select
        name="userId"
        required
        defaultValue=""
        className="w-full rounded-xl border border-border bg-white px-3 py-3"
      >
        <option value="" disabled>
          เลือกสมาชิก…
        </option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.email})
          </option>
        ))}
      </select>
      <input
        name="itemName"
        placeholder="รายการ เช่น โกโก้เข้มข้น (กลาง)"
        className="w-full rounded-xl border border-border bg-white px-3 py-3"
      />
      <input
        name="price"
        type="number"
        step="0.01"
        min="0"
        required
        placeholder="ราคา (บาท)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="no-spinner w-full rounded-xl border border-border bg-white px-3 py-3"
      />

      {parsedPrice > 0 && (
        <p className="rounded-lg bg-background px-3 py-2 text-sm">
          ยอดที่ต้องจ่าย (พรีวิว): <span className="font-semibold text-brand">{baht(previewTotal)}</span>
          {deliveryFee > 0 && (
            <span className="text-xs text-muted"> (รวมค่าส่ง {baht(deliveryShare)})</span>
          )}
        </p>
      )}

      <SubmitButton>เพิ่มผู้จ่าย</SubmitButton>
    </form>
  );
}
