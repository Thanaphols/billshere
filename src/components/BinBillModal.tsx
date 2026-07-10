"use client";

import { useState } from "react";
import { restorePost } from "@/actions/posts";
import { baht, deliveryFeeText, paymentLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

type BinItem = {
  id: string;
  itemName: string;
  who: string;
  price: number;
  amountToPay: number;
  paymentStatus: string;
};

export default function BinBillModal({
  postId,
  title,
  note,
  deliveryFee,
  deliveryPersonCount,
  items,
}: {
  postId: string;
  title: string;
  note: string | null;
  deliveryFee: number;
  deliveryPersonCount: number;
  items: BinItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { t, lang } = useI18n();

  const totalPrice = items.reduce((s, x) => s + x.price, 0);
  const totalAmount = items.reduce((s, x) => s + x.amountToPay, 0);

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-sm">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted">
            {items.length} {lang === "th" ? "รายการ" : "items"} · {baht(totalAmount)}
            {note ? ` · ${note}` : ""}
          </p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="shrink-0 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-muted hover:bg-muted/10 hover:text-brand hover:border-brand/40 transition active:scale-[.96]"
        >
          {lang === "th" ? "ดูรายละเอียด" : "Details"}
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl border border-border animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-foreground">{title}</h3>
                {note && <p className="truncate text-[10px] text-muted mt-0.5">{note}</p>}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="shrink-0 ml-2 text-muted hover:text-foreground text-xs font-semibold"
              >
                {t("close")}
              </button>
            </div>

            <div className="mt-3 max-h-72 overflow-y-auto overflow-x-hidden rounded-xl border border-border">
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-background uppercase tracking-wider text-muted">
                    <th className="w-[50%] p-2 font-semibold">
                      {lang === "th" ? "รายการ (ผู้จ่าย)" : "Item (Payer)"}
                    </th>
                    <th className="w-[25%] p-2 text-right font-semibold">
                      {lang === "th" ? "ราคา" : "Price"}
                    </th>
                    <th className="w-[25%] p-2 text-right font-semibold">
                      {lang === "th" ? "ยอดจ่าย" : "Amount"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-muted">
                        {lang === "th" ? "ไม่มีรายการ" : "No items"}
                      </td>
                    </tr>
                  ) : (
                    items.map((x) => (
                      <tr key={x.id} className="border-t border-border">
                        <td className="min-w-0 p-2">
                          <p className="truncate font-semibold text-foreground">{x.itemName}</p>
                          <p className="truncate text-[10px] text-muted">
                            {x.who} · {paymentLabel(x.paymentStatus)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap p-2 text-right text-muted">{baht(x.price)}</td>
                        <td className="whitespace-nowrap p-2 text-right font-bold text-foreground">
                          {baht(x.amountToPay)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {items.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/10 font-bold text-foreground">
                      <td className="p-2">{lang === "th" ? "ยอดรวม" : "Total"}</td>
                      <td className="whitespace-nowrap p-2 text-right">{baht(totalPrice)}</td>
                      <td className="whitespace-nowrap p-2 text-right text-brand">{baht(totalAmount)}</td>
                    </tr>
                    {/* Always shown, even when there is no delivery fee. */}
                    <tr className="border-t border-border/60 text-muted">
                      <td colSpan={2} className="p-2 font-semibold">
                        {lang === "th"
                          ? `ค่าส่ง (หาร ${deliveryPersonCount} คน)`
                          : `Delivery (split ${deliveryPersonCount} ways)`}
                      </td>
                      <td className="whitespace-nowrap p-2 text-right font-bold text-foreground">
                        {deliveryFeeText(deliveryFee, lang)}
                      </td>
                    </tr>
                    {deliveryFee > 0 && (
                      <tr className="text-muted">
                        <td colSpan={3} className="px-2 pb-2 text-[10px] font-normal">
                          {lang === "th"
                            ? "* ยอดจ่ายรวมค่าส่งแล้ว"
                            : "* Amounts already include delivery"}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                )}
              </table>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 rounded-xl border border-border bg-white py-2.5 text-xs font-bold text-muted hover:bg-muted/10 transition"
              >
                {lang === "th" ? "ปิด" : "Close"}
              </button>
              <form
                action={restorePost.bind(null, postId)}
                onSubmit={(e) => {
                  if (!confirm(t("bill.restore.confirm"))) e.preventDefault();
                }}
                className="flex-1"
              >
                <button className="w-full rounded-xl border border-brand bg-brand/5 py-2.5 text-xs font-bold text-brand hover:bg-brand/10 transition active:scale-[.98]">
                  {lang === "th" ? "กู้คืนบิลนี้" : "Restore this bill"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
