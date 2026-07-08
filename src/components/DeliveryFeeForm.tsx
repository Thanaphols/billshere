"use client";

import { useState } from "react";
import { round2 } from "@/lib/discount";
import { baht } from "@/lib/format";
import SubmitButton from "@/components/SubmitButton";

/**
 * Delivery fee input with a live "split equally" preview, separate from the
 * discount settings save — confirming here adds the per-person share on top
 * of each participant's discounted item amount.
 */
export default function DeliveryFeeForm({
  action,
  defaultFee,
  participantCount,
}: {
  action: (formData: FormData) => void;
  defaultFee: number;
  participantCount: number;
}) {
  const [fee, setFee] = useState(defaultFee);

  const share = participantCount > 0 ? round2(fee / participantCount) : 0;

  return (
    <form action={action} className="mt-3 space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">ค่าส่งรวมทั้งบิล</span>
        <input
          name="deliveryFee"
          type="number"
          step="0.01"
          min="0"
          value={fee}
          onChange={(e) => setFee(parseFloat(e.target.value) || 0)}
          className="no-spinner w-full rounded-xl border border-border bg-white px-3 py-3"
        />
      </label>

      <p className="rounded-lg bg-background px-3 py-2 text-sm">
        หารเท่ากัน {participantCount} คน = <span className="font-semibold text-brand">{baht(share)}</span> /คน
      </p>

      <SubmitButton>ยืนยันค่าส่ง</SubmitButton>
    </form>
  );
}
