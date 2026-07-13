"use client";

import { useState, useTransition } from "react";
import { baht } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { NewMenuItem } from "@/actions/posts";

export default function AddMenuItemForm({
  action,
  allUsers = [],
}: {
  action: (items: NewMenuItem[]) => Promise<void> | void;
  allUsers?: { id: string; name: string; email: string }[];
}) {
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [userId, setUserId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [assignMode, setAssignMode] = useState<"user" | "guest">("user");
  const [items, setItems] = useState<NewMenuItem[]>([]);
  const [pending, startTransition] = useTransition();
  const { t, lang } = useI18n();

  const clearFields = () => {
    setItemName("");
    setPrice("");
    setQuantity("1");
    setUserId("");
    setGuestName("");
    setAssignMode("user");
  };

  // Build a NewMenuItem from the current fields, or null if invalid.
  const draft = (): NewMenuItem | null => {
    const p = parseFloat(price);
    if (!itemName.trim() || !(p > 0)) return null;
    return {
      itemName: itemName.trim(),
      price: p,
      quantity: Math.max(1, parseInt(quantity, 10) || 1),
      userId: assignMode === "user" ? userId || null : null,
      guestName: assignMode === "guest" ? guestName.trim() || null : null,
    };
  };

  const addToList = () => {
    const d = draft();
    if (!d) return;
    setItems((prev) => [...prev, d]);
    clearFields();
  };

  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  const ownerLabel = (it: NewMenuItem) => {
    if (it.userId) return allUsers.find((u) => u.id === it.userId)?.name ?? "";
    return it.guestName ?? "";
  };

  const saveAll = () => {
    // Fold in the currently-typed row too, so a single item needs no "add" first.
    const d = draft();
    const all = d ? [...items, d] : items;
    if (all.length === 0) return;
    startTransition(async () => {
      await action(all);
      setItems([]);
      clearFields();
    });
  };

  const inputCls =
    "w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand text-sm";

  return (
    <div className="mt-3 space-y-3">
      {/* Pending items collected so far */}
      {items.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-border bg-background/60 p-2.5">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                {it.itemName}
                {it.quantity > 1 && <span className="text-muted"> ×{it.quantity}</span>}
                {ownerLabel(it) && <span className="text-muted"> · {ownerLabel(it)}</span>}
              </span>
              <span className="shrink-0 font-bold text-foreground">{baht(it.price)}</span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                aria-label="remove"
                className="shrink-0 text-red-500 hover:text-red-700 px-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        placeholder={lang === "th" ? "รายการ เช่น โกโก้เข้มข้น (กลาง)" : "Item, e.g. Cocoa (Large)"}
        className={inputCls}
      />
      <div className="flex gap-2">
        <div className="flex-[2]">
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={lang === "th" ? "ราคา (บาท)" : "Price (Baht)"}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={`no-spinner ${inputCls}`}
          />
        </div>
        <div className="flex-1">
          <input
            type="number"
            min="1"
            placeholder={lang === "th" ? "จำนวน" : "Qty"}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={`no-spinner ${inputCls} text-center`}
          />
        </div>
      </div>

      <div className="border-t border-dashed border-border pt-3 space-y-2.5">
        <span className="block text-xs font-semibold text-muted">
          {lang === "th" ? "กำหนดเจ้าของเมนู (เพิ่มทีหลังได้)" : "Assign menu owner (optional)"}
        </span>

        {/* Segment selector toggle */}
        <div className="flex rounded-xl border border-border p-0.5 bg-background text-[10px] w-full font-bold">
          <button
            type="button"
            onClick={() => setAssignMode("user")}
            className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
              assignMode === "user" ? "bg-white shadow-xs text-brand" : "text-muted font-medium"
            }`}
          >
            {lang === "th" ? "เลือกจากสมาชิก" : "Choose Member"}
          </button>
          <button
            type="button"
            onClick={() => setAssignMode("guest")}
            className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
              assignMode === "guest" ? "bg-white shadow-xs text-brand" : "text-muted font-medium"
            }`}
          >
            {lang === "th" ? "กำหนดเอง (พิมพ์ชื่อ)" : "Custom Name"}
          </button>
        </div>

        <div>
          {assignMode === "user" ? (
            <div className="relative">
              <select
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setGuestName("");
                }}
                className="w-full rounded-xl border border-border bg-white px-3 pr-10 py-3 text-sm outline-none focus:border-brand appearance-none cursor-pointer"
              >
                <option value="">{lang === "th" ? "— เลือกสมาชิกในระบบ —" : "— Choose Member —"}</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-muted">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          ) : (
            <input
              placeholder={lang === "th" ? "พิมพ์ชื่อคนจ่ายเอง (ไม่มีบัญชี)" : "Type guest name"}
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                setUserId("");
              }}
              className="w-full rounded-xl border border-border bg-white px-3 py-3 text-sm outline-none focus:border-brand"
            />
          )}
        </div>
      </div>

      {/* Add-to-list (secondary) + Save all (primary) */}
      <button
        type="button"
        onClick={addToList}
        disabled={!draft()}
        className="w-full rounded-xl border border-brand bg-brand/5 py-2.5 text-sm font-bold text-brand transition active:scale-[.98] hover:bg-brand/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        + {lang === "th" ? "เพิ่มในรายการ" : "Add to list"}
      </button>
      <button
        type="button"
        onClick={saveAll}
        disabled={pending || (items.length === 0 && !draft())}
        className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white transition active:scale-[.98] hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending
          ? lang === "th" ? "กำลังบันทึก…" : "Saving…"
          : `${t("bill.addMenu")}${items.length + (draft() ? 1 : 0) > 0 ? ` (${items.length + (draft() ? 1 : 0)})` : ""}`}
      </button>
    </div>
  );
}
