"use client";

import { useState } from "react";
import type { DiscountType } from "@prisma/client";
import { computeBill, round2, type BillRow } from "@/lib/discount";
import { baht, deliveryFeeText } from "@/lib/format";
import SubmitButton from "@/components/SubmitButton";
import Dropdown from "@/components/Dropdown";
import { useI18n } from "@/lib/i18n";

export default function DiscountSettings({
  action,
  rows,
  defaultType = "PERCENT",
  defaultValue = 0,
  defaultDeliveryFee = 0,
  defaultDeliveryPersonCount = 1,
}: {
  action: (formData: FormData) => void;
  /** Current bill rows, for the live preview (price + payer grouping). */
  rows: BillRow[];
  defaultType?: DiscountType;
  defaultValue?: number;
  defaultDeliveryFee?: number;
  defaultDeliveryPersonCount?: number;
}) {
  // Legacy NONE behaves as PERCENT (pay your own items).
  const [type, setType] = useState<DiscountType>(defaultType === "NONE" ? "PERCENT" : defaultType);
  const [discount, setDiscount] = useState<number | "">(defaultValue);
  const [fee, setFee] = useState<number | "">(defaultDeliveryFee);
  const [personCount, setPersonCount] = useState<number | "">(defaultDeliveryPersonCount);
  const { lang } = useI18n();

  const D = Number(discount) || 0;
  const S = Number(fee) || 0;
  const N = Math.max(1, Number(personCount) || 1);

  // Live preview — same pure helper the server uses.
  const preview = computeBill(rows, { discountType: type, discountValue: D, deliveryFee: S, personCount: N });
  const grandTotal = round2(preview.reduce((a, r) => a + r.amountToPay, 0));
  const itemsTotal = round2(rows.reduce((a, r) => a + r.price, 0));
  const perHeadDelivery = round2(S / N);
  const perHeadDiscount = round2(D / N);
  const equalPerPerson = Math.max(0, round2((itemsTotal - D + S) / N));

  const inputCls =
    "no-spinner w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand";

  return (
    <form action={action} className="rounded-2xl bg-surface p-4 shadow-sm space-y-3">
      <h3 className="font-semibold text-sm text-foreground">
        {lang === "th" ? "ตั้งค่าการหารและค่าส่ง" : "Split & Delivery Settings"}
      </h3>

      {/* 1. Discount (baht) + 2. Delivery (baht) */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">
              {lang === "th" ? "ส่วนลดรวม (บาท)" : "Total Discount (Baht)"}
            </span>
            <input
              name="discountValue"
              type="number"
              step="0.01"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value === "" ? "" : parseFloat(e.target.value))}
              onBlur={() => setDiscount((v) => (v === "" || Number.isNaN(v) ? 0 : v))}
              className={inputCls}
            />
          </label>
        </div>
        <div className="flex-1">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">
              {lang === "th" ? "ค่าส่งรวม (บาท)" : "Total Delivery (Baht)"}
            </span>
            <input
              name="deliveryFee"
              type="number"
              step="0.01"
              min="0"
              value={fee}
              onChange={(e) => setFee(e.target.value === "" ? "" : parseFloat(e.target.value))}
              onBlur={() => setFee((v) => (v === "" || Number.isNaN(v) ? 0 : v))}
              className={inputCls}
            />
          </label>
        </div>
      </div>

      {/* 3. Person count (divides BOTH) + 4. Mode */}
      <div className="flex items-end gap-2">
        <div className="w-28 shrink-0">
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
              className={inputCls}
            />
          </label>
        </div>
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
                { value: "FIXED", label: lang === "th" ? "หารเท่ากันทุกรายการ" : "Split equally" },
                { value: "PERCENT", label: lang === "th" ? "หารตามที่สั่ง" : "Pay your own items" },
              ]}
            />
          </label>
        </div>
      </div>

      <p className="text-[10px] text-muted">
        {lang === "th"
          ? "จำนวนคนหาร ใช้หารทั้งส่วนลดและค่าส่ง"
          : "Person count splits both the discount and the delivery fee."}
      </p>

      {/* Live preview */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-border bg-background/60 p-3 space-y-1 text-[11px]">
          <p className="font-semibold text-foreground">
            {lang === "th" ? "พรีวิว" : "Preview"}
          </p>
          <div className="flex justify-between text-muted">
            <span>{lang === "th" ? "ค่าส่งต่อคน" : "Delivery / person"}</span>
            <span className="font-semibold text-foreground">{deliveryFeeText(perHeadDelivery, lang)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>{lang === "th" ? "ส่วนลดต่อคน" : "Discount / person"}</span>
            <span className="font-semibold text-foreground">-{baht(perHeadDiscount)}</span>
          </div>
          {type === "FIXED" && (
            <div className="flex justify-between text-muted">
              <span>{lang === "th" ? "ทุกคนจ่ายคนละ" : "Everyone pays"}</span>
              <span className="font-bold text-brand">{baht(equalPerPerson)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border/60 pt-1 text-muted">
            <span>{lang === "th" ? "ยอดรวมที่เก็บได้" : "Total collected"}</span>
            <span className="font-bold text-brand">{baht(grandTotal)}</span>
          </div>
        </div>
      )}

      <div className="pt-1">
        <SubmitButton>{lang === "th" ? "คำนวณราคา" : "Calculate Split"}</SubmitButton>
      </div>
    </form>
  );
}
