"use client";

import { useState } from "react";
import type { DiscountType } from "@prisma/client";
import { computeAmounts } from "@/lib/discount";
import { baht } from "@/lib/format";

export type ParticipantPreviewInput = { name: string; price: number };

/**
 * Discount type selector + a live comparison table so the owner can see, for
 * every current participant, what "หารเท่ากัน" vs "เปอร์เซ็นต์ X%" would cost
 * BEFORE saving — same computeAmounts() the server uses, so the preview and
 * the persisted numbers always match exactly.
 */
export default function DiscountSettings({
  defaultType = "NONE",
  defaultValue = 0,
  participants,
}: {
  defaultType?: DiscountType;
  defaultValue?: number;
  participants: ParticipantPreviewInput[];
}) {
  const [type, setType] = useState<DiscountType>(defaultType);
  const [pct, setPct] = useState<number>(defaultValue);

  const lines = participants.map((p) => ({ price: p.price }));
  const equalResults = computeAmounts(lines, "FIXED", 0);
  const percentResults = computeAmounts(lines, "PERCENT", pct);
  const equalTotal = equalResults.reduce((s, r) => s + r.itemAmount, 0);
  const percentTotal = percentResults.reduce((s, r) => s + r.itemAmount, 0);

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">แบบส่วนลดที่จะใช้</span>
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

      <label className="block">
        <span className="mb-1 block text-sm font-medium">ค่าเปอร์เซ็นต์ (สำหรับเทียบ/ใช้จริงถ้าเลือกเปอร์เซ็นต์)</span>
        <input
          name="discountValue"
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={pct}
          onChange={(e) => setPct(parseFloat(e.target.value) || 0)}
          className="no-spinner w-full rounded-xl border border-border bg-white px-3 py-3"
        />
      </label>

      {participants.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-background text-muted">
                <th className="p-2 text-left">ชื่อ</th>
                <th className="p-2 text-right">ราคา</th>
                <th className="p-2 text-right">หารเท่ากัน</th>
                <th className="p-2 text-right">{pct || 0}%</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-2 truncate max-w-[80px]">{p.name}</td>
                  <td className="p-2 text-right">{baht(p.price)}</td>
                  <td
                    className={`p-2 text-right ${type === "FIXED" ? "font-semibold text-brand" : ""}`}
                  >
                    {baht(equalResults[i].itemAmount)}
                  </td>
                  <td
                    className={`p-2 text-right ${type === "PERCENT" ? "font-semibold text-brand" : ""}`}
                  >
                    {baht(percentResults[i].itemAmount)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border font-semibold">
                <td className="p-2" colSpan={2}>
                  รวม
                </td>
                <td className="p-2 text-right">{baht(equalTotal)}</td>
                <td className="p-2 text-right">{baht(percentTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        ตารางนี้เทียบให้ดูก่อนตัดสินใจ — ยอดที่บันทึกจริงจะใช้ตาม
        &quot;แบบส่วนลดที่จะใช้&quot; ที่เลือกไว้ด้านบนเท่านั้น
      </p>
    </div>
  );
}
