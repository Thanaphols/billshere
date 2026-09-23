"use client";

import { useState } from "react";
import type { DiscountType } from "@prisma/client";
import { computeBill, deliverySplit, round2, type BillRow } from "@/lib/discount";
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
  ownerKey,
  promptpayQrs = [],
  defaultPromptpay,
}: {
  action: (formData: FormData) => void;
  /** Current bill rows, for the live preview (price + payer grouping). */
  rows: BillRow[];
  defaultType?: DiscountType;
  defaultValue?: number;
  defaultDeliveryFee?: number;
  defaultDeliveryPersonCount?: number;
  /** ownerKey of the bill owner — absorbs the delivery rounding remainder. */
  ownerKey?: string;
  /** Owner's PromptPay numbers (main first) with a preview QR each. */
  promptpayQrs?: { number: string; qr: string }[];
  defaultPromptpay?: string | null;
}) {
  const [promptpay, setPromptpay] = useState(defaultPromptpay ?? "");
  // Both tabs live in one form (hidden, not unmounted) so one submit saves everything.
  const [tab, setTab] = useState<"split" | "payment">("split");
  const pp = promptpayQrs.find((q) => q.number === promptpay) ?? promptpayQrs[0];
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
  const preview = computeBill(rows, { discountType: type, discountValue: D, deliveryFee: S, personCount: N, ownerKey });
  const grandTotal = round2(preview.reduce((a, r) => a + r.amountToPay, 0));
  const itemsTotal = round2(rows.reduce((a, r) => a + r.price, 0));
  const { perHead: perHeadDelivery, remainder: deliveryRemainder, ownerShare: ownerDelivery } = deliverySplit(S, N);
  const perHeadDiscount = round2(D / N);
  const equalPerPerson = Math.max(0, round2((itemsTotal - D + S) / N));

  // The discount actually deducted must not exceed the food total, or the bill
  // zeroes out / reads as nonsensical. In PERCENT the D/N share is subtracted
  // once per payer group, so the effective discount is (D/N)·groupCount — this
  // is what blows past the total when N is smaller than the real payer count.
  const groupCount = new Set(rows.map((r) => r.ownerKey)).size || 1;
  const effectiveDiscount = type === "FIXED" ? D : round2((D / N) * groupCount);
  const overDiscount = itemsTotal > 0 && effectiveDiscount > itemsTotal;

  const inputCls =
    "no-spinner w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand";

  return (
    <form action={action} className="rounded-2xl bg-surface p-4 shadow-sm space-y-3">
      <h3 className="font-semibold text-sm text-foreground">
        {lang === "th" ? "ตั้งค่าบิล" : "Bill Settings"}
      </h3>

      <div className="mr-8 flex rounded-xl bg-muted/15 p-1 text-xs font-semibold">
        {([
          ["split", lang === "th" ? "ส่วนลด / ค่าส่ง" : "Discount / Delivery"],
          ["payment", lang === "th" ? "ช่องทางชำระเงิน" : "Payment"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg py-1.5 transition ${
              tab === key ? "bg-white text-brand shadow-xs" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Both tabs share one grid cell so the card keeps the taller tab's height. */}
      <div className="grid">
      <div className={`space-y-3 [grid-area:1/1] ${tab === "split" ? "" : "invisible"}`}>
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
              onWheel={(e) => e.currentTarget.blur()}
              className={`${inputCls} ${overDiscount ? "border-red-400 focus:border-red-400" : ""}`}
            />
            {overDiscount && (
              <span className="mt-1 block text-[10px] font-medium text-red-500">
                {lang === "th"
                  ? `ส่วนลดที่หักจริง ${baht(effectiveDiscount)} เกินราคารวม ${baht(itemsTotal)}`
                  : `Effective discount ${baht(effectiveDiscount)} exceeds total ${baht(itemsTotal)}`}
              </span>
            )}
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
              onWheel={(e) => e.currentTarget.blur()}
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
              onWheel={(e) => e.currentTarget.blur()}
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
                { value: "FIXED", label: lang === "th" ? "หารทั้งบิลตามจำนวนคน" : "Split equally" },
                { value: "PERCENT", label: lang === "th" ? "หารรายการตามจำนวนคน" : "Pay your own items" },
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
          {deliveryRemainder > 0 && (
            <div className="flex justify-between text-muted">
              <span>
                {lang === "th"
                  ? `เศษ ${baht(deliveryRemainder)} → เจ้าของบิลจ่าย`
                  : `Remainder ${baht(deliveryRemainder)} → bill owner pays`}
              </span>
              <span className="font-semibold text-foreground">{baht(ownerDelivery)}</span>
            </div>
          )}
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

      </div>

      <div className={`flex flex-col [grid-area:1/1] ${tab === "payment" ? "" : "invisible"}`}>
      {/* Payment method: which PromptPay this bill's QR + share slip use */}
      {pp ? (
        <div className="flex flex-1 flex-col gap-2">
          <span className="block text-xs font-semibold text-muted">
            {lang === "th" ? "ช่องทางชำระเงิน (PromptPay)" : "Payment method (PromptPay)"}
          </span>
          {promptpayQrs.length > 1 ? (
            <Dropdown
              name="promptpayNumber"
              value={pp.number}
              onChange={setPromptpay}
              placeholder="PromptPay"
              options={promptpayQrs.map((q, i) => ({
                value: q.number,
                label: i === 0 ? `${q.number} (${lang === "th" ? "หลัก" : "main"})` : q.number,
              }))}
            />
          ) : (
            <p className="text-xs font-semibold text-foreground">{pp.number}</p>
          )}
          {/* QR fills the leftover height; absolute so it never stretches the card itself. */}
          <div className="relative min-h-[140px] flex-1 rounded-xl border border-border bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pp.qr} alt="PromptPay QR" className="absolute inset-0 m-auto h-full max-w-full object-contain p-3" />
          </div>
        </div>
      ) : (
        <p className="text-xs font-semibold text-amber-600">
          {lang === "th"
            ? "ยังไม่มีเบอร์ PromptPay — เพิ่มได้ที่หน้าโปรไฟล์"
            : "No PromptPay number yet — add one in your profile."}
        </p>
      )}
      </div>
      </div>

      <div className="pt-1">
        <SubmitButton disabled={overDiscount}>
          {tab === "payment"
            ? lang === "th" ? "บันทึก" : "Save"
            : lang === "th" ? "คำนวณราคา" : "Calculate Split"}
        </SubmitButton>
      </div>
    </form>
  );
}
