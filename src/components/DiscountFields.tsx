"use client";

import { useState } from "react";
import type { DiscountType } from "@prisma/client";

/**
 * Discount type selector + value input.
 * The value box only appears for PERCENT — "หารเท่ากัน" (FIXED) and "ไม่มี" (NONE)
 * need no value, so it stays hidden for them.
 */
export default function DiscountFields({
  defaultType = "NONE",
  defaultValue = 0,
}: {
  defaultType?: DiscountType;
  defaultValue?: number;
}) {
  const [type, setType] = useState<DiscountType>(defaultType);

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">แบบส่วนลด</span>
        <select
          name="discountType"
          value={type}
          onChange={(e) => setType(e.target.value as DiscountType)}
          className="w-full rounded-xl border border-border bg-white px-3 py-3"
        >
          <option value="NONE">ไม่มี</option>
          <option value="FIXED">หารเท่ากัน (ทั้งบิล)</option>
          <option value="PERCENT">เปอร์เซ็นต์</option>
        </select>
      </label>

      {type === "PERCENT" && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">ส่วนลด (%)</span>
          <input
            name="discountValue"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={defaultValue}
            className="no-spinner w-full rounded-xl border border-border bg-white px-3 py-3"
          />
        </label>
      )}

      {type === "FIXED" && (
        <p className="text-xs text-muted">
          ทุกคนจ่ายเท่ากัน = ยอดรวมทั้งบิล ÷ จำนวนคน (ไม่ต้องกรอกค่า)
        </p>
      )}
    </div>
  );
}
