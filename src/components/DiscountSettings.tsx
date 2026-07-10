"use client";

import { useState } from "react";
import type { DiscountType } from "@prisma/client";
import SubmitButton from "@/components/SubmitButton";
import Dropdown from "@/components/Dropdown";
import { useI18n } from "@/lib/i18n";

export default function DiscountSettings({
  action,
  defaultType = "NONE",
  defaultValue = 0,
  defaultDeliveryFee = 0,
  defaultDeliveryPersonCount = 1,
}: {
  action: (formData: FormData) => void;
  defaultType?: DiscountType;
  defaultValue?: number;
  defaultDeliveryFee?: number;
  defaultDeliveryPersonCount?: number;
}) {
  const [type, setType] = useState<DiscountType>(defaultType);
  const [pct, setPct] = useState<number | "">(defaultValue);
  const [fee, setFee] = useState<number | "">(defaultDeliveryFee);
  const [personCount, setPersonCount] = useState<number | "">(defaultDeliveryPersonCount);
  const { lang } = useI18n();

  return (
    <form action={action} className="rounded-2xl bg-surface p-4 shadow-sm space-y-3">
      <h3 className="font-semibold text-sm text-foreground">
        {lang === "th" ? "ตั้งค่าการหารและค่าส่ง" : "Split & Delivery Settings"}
      </h3>

      {/* Compact inline split settings */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">
              {lang === "th" ? "แบบการหาร" : "Split Type"}
            </span>
            <Dropdown
              name="discountType"
              value={type}
              onChange={(v) => setType(v as DiscountType)}
              placeholder={lang === "th" ? "เลือกแบบการหาร" : "Select split type"}
              options={[
                { value: "NONE", label: lang === "th" ? "หารตามราคารวมปกติ" : "Split by item price" },
                { value: "FIXED", label: lang === "th" ? "หารเท่ากันทุกคน" : "Split equally" },
                { value: "PERCENT", label: lang === "th" ? "ลดเปอร์เซ็นต์ (%)" : "Percent discount (%)" },
              ]}
            />
          </label>
        </div>

        {type === "PERCENT" && (
          <div className="w-24">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted">
                {lang === "th" ? "ส่วนลด (%)" : "Discount (%)"}
              </span>
              <input
                name="discountValue"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={pct}
                onChange={(e) => setPct(e.target.value === "" ? "" : parseFloat(e.target.value))}
                onBlur={() => setPct((v) => (v === "" || Number.isNaN(v) ? 0 : v))}
                className="no-spinner w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand"
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">
              {lang === "th" ? "ค่าส่งรวมทั้งบิล (บาท)" : "Total Delivery Fee (Baht)"}
            </span>
            <input
              name="deliveryFee"
              type="number"
              step="0.01"
              min="0"
              value={fee}
              onChange={(e) => setFee(e.target.value === "" ? "" : parseFloat(e.target.value))}
              onBlur={() => setFee((v) => (v === "" || Number.isNaN(v) ? 0 : v))}
              className="no-spinner w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand"
            />
          </label>
        </div>
        <div className="w-24">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">
              {lang === "th" ? "จำนวนคนหาร" : "Split among"}
            </span>
            <input
              name="deliveryPersonCount"
              type="number"
              step="1"
              min="1"
              value={personCount}
              onChange={(e) => setPersonCount(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
              onBlur={() => setPersonCount((v) => (v === "" || Number.isNaN(v) || v < 1 ? 1 : v))}
              className="no-spinner w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand"
            />
          </label>
        </div>
      </div>

      <div className="pt-1">
        <SubmitButton>
          {lang === "th" ? "คำนวณราคา" : "Calculate Split"}
        </SubmitButton>
      </div>
    </form>
  );
}
