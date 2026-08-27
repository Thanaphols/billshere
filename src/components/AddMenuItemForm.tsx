"use client";

import { useState, useTransition } from "react";
import { baht } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import Dropdown from "@/components/Dropdown";
import type { NewMenuItem } from "@/actions/posts";

type SubRow = {
  itemName: string;
  price: string;
  discount: string;
  assignMode: "user" | "guest";
  userId: string;
  guestName: string;
  collapsed: boolean;
};

const emptySubRow = (): SubRow => ({
  itemName: "",
  price: "",
  discount: "",
  assignMode: "user",
  userId: "",
  guestName: "",
  collapsed: false,
});

export default function AddMenuItemForm({
  action,
  allUsers = [],
}: {
  action: (items: NewMenuItem[]) => Promise<void> | void;
  allUsers?: { id: string; name: string; email: string }[];
}) {
  const [mode, setMode] = useState<"normal" | "pack">("normal");
  // Normal-mode fields (single draft + staging list).
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [userId, setUserId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [assignMode, setAssignMode] = useState<"user" | "guest">("user");
  // Primary mode (replaces the modal title): add a menu item vs. assign its owner.
  const [topTab, setTopTab] = useState<"menu" | "owner">("menu");
  const [items, setItems] = useState<NewMenuItem[]>([]);
  // Pack-mode fields.
  const [packName, setPackName] = useState("");
  const [packPrice, setPackPrice] = useState("");
  const [packId, setPackId] = useState(() => crypto.randomUUID());
  const [subRows, setSubRows] = useState<SubRow[]>(() => [emptySubRow()]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const { lang } = useI18n();

  const clearFields = () => {
    setItemName("");
    setPrice("");
    setDiscount("");
    setQuantity("1");
    setUserId("");
    setGuestName("");
    setAssignMode("user");
    setTopTab("menu");
  };

  const switchMode = (m: "normal" | "pack") => {
    setMode(m);
    setError("");
    clearFields();
    setItems([]);
    setPackName("");
    setPackPrice("");
    setPackId(crypto.randomUUID());
    setSubRows([emptySubRow()]);
    setTopTab("menu");
  };

  const inputCls =
    "w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand text-sm";

  // ---------- normal mode ----------
  const draft = (): NewMenuItem | null => {
    const p = parseFloat(price);
    if (!itemName.trim() || !(p > 0)) return null;
    return {
      itemName: itemName.trim(),
      price: p,
      discount: Math.min(p, Math.max(0, parseFloat(discount) || 0)),
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

  // Save only what's been explicitly staged — the typed-but-unstaged draft is ignored.
  const saveNormal = () => {
    if (items.length === 0) return;
    startTransition(async () => {
      try {
        await action(items);
        setItems([]);
        clearFields();
        setError("");
      } catch {
        setError(lang === "th" ? "บันทึกไม่สำเร็จ" : "Save failed");
      }
    });
  };

  const normalCount = items.length;

  // ---------- pack mode ----------
  const cap = parseFloat(packPrice) || 0;
  const updateSub = (i: number, patch: Partial<SubRow>) =>
    setSubRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  // Adding a new row collapses the others so a long list doesn't overflow the screen.
  const addSubRow = () =>
    setSubRows((prev) => [...prev.map((r) => ({ ...r, collapsed: true })), emptySubRow()]);
  const removeSubRow = (i: number) =>
    setSubRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const toggleCollapse = (i: number) =>
    setSubRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, collapsed: !r.collapsed } : r)));

  const subSum = subRows.reduce((a, r) => a + (parseFloat(r.price) || 0), 0);
  const remaining = cap - subSum;
  const overCap = remaining < -1e-9;
  const validSubs = subRows.filter((r) => r.itemName.trim() && parseFloat(r.price) > 0);
  const canSavePack = !!packName.trim() && cap > 0 && validSubs.length > 0 && !overCap;

  const savePack = () => {
    if (!packName.trim() || !(cap > 0)) {
      setError(lang === "th" ? "กรอกชื่อแพ็คและราคา" : "Enter pack name and price");
      return;
    }
    if (validSubs.length === 0) {
      setError(lang === "th" ? "เพิ่มรายการย่อยอย่างน้อย 1 รายการ" : "Add at least one sub-item");
      return;
    }
    if (overCap) {
      setError(lang === "th" ? "ราคารวมเกินราคาแพ็ค" : "Sub-items exceed pack price");
      return;
    }
    const all: NewMenuItem[] = validSubs.map((r) => ({
      itemName: r.itemName.trim(),
      price: parseFloat(r.price),
      discount: Math.min(parseFloat(r.price), Math.max(0, parseFloat(r.discount) || 0)),
      quantity: 1,
      userId: r.assignMode === "user" ? r.userId || null : null,
      guestName: r.assignMode === "guest" ? r.guestName.trim() || null : null,
      packId,
      packName: packName.trim(),
      packPrice: cap,
    }));
    startTransition(async () => {
      try {
        await action(all);
        setError("");
        setPackName("");
        setPackPrice("");
        setPackId(crypto.randomUUID());
        setSubRows([emptySubRow()]);
      } catch {
        setError(lang === "th" ? "บันทึกไม่สำเร็จ — ตรวจราคารวมของแพ็ค" : "Save failed — check pack totals");
      }
    });
  };

  // Owner picker shared by normal draft and each pack sub-row.
  const ownerPicker = (
    curMode: "user" | "guest",
    curUserId: string,
    curGuestName: string,
    onMode: (m: "user" | "guest") => void,
    onUser: (v: string) => void,
    onGuest: (v: string) => void
  ) => (
    <div className="space-y-2">
      <div className="flex rounded-xl border border-border p-0.5 bg-background text-[10px] w-full font-bold">
        <button
          type="button"
          onClick={() => onMode("user")}
          className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
            curMode === "user" ? "bg-white shadow-xs text-brand" : "text-muted font-medium"
          }`}
        >
          {lang === "th" ? "เลือกจากสมาชิก" : "Choose Member"}
        </button>
        <button
          type="button"
          onClick={() => onMode("guest")}
          className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
            curMode === "guest" ? "bg-white shadow-xs text-brand" : "text-muted font-medium"
          }`}
        >
          {lang === "th" ? "กำหนดเอง (พิมพ์ชื่อ)" : "Custom Name"}
        </button>
      </div>
      {curMode === "user" ? (
        <Dropdown
          value={curUserId}
          onChange={(v) => {
            onUser(v);
            onGuest("");
          }}
          placeholder={lang === "th" ? "— เลือกสมาชิกในระบบ —" : "— Choose Member —"}
          options={[
            { value: "", label: lang === "th" ? "— เลือกสมาชิกในระบบ —" : "— Choose Member —" },
            ...allUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
          ]}
        />
      ) : (
        <input
          placeholder={lang === "th" ? "พิมพ์ชื่อคนจ่ายเอง (ไม่มีบัญชี)" : "Type guest name"}
          value={curGuestName}
          onChange={(e) => {
            onGuest(e.target.value);
            onUser("");
          }}
          className="w-full rounded-xl border border-border bg-white px-3 py-3 text-sm outline-none focus:border-brand"
        />
      )}
    </div>
  );

  // Shared across the "add item" and "assign owner" primary tabs.
  const stagedItems = items.length > 0 && (
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
  );

  const normalButtons = (
    <>
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
        onClick={saveNormal}
        disabled={pending || normalCount === 0}
        className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white transition active:scale-[.98] hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending
          ? lang === "th" ? "กำลังบันทึก…" : "Saving…"
          : `${lang === "th" ? "บันทึก" : "Save"}${normalCount > 0 ? ` (${normalCount})` : ""}`}
      </button>
    </>
  );

  return (
    <div className="space-y-3">
      {/* Primary mode — underline tabs in place of the modal's static title. */}
      <div className="flex gap-5 border-b border-border pr-7">
        <button
          type="button"
          onClick={() => setTopTab("menu")}
          className={`-mb-px border-b-2 pb-2 text-sm font-bold transition-colors ${
            topTab === "menu" ? "border-brand text-brand" : "border-transparent text-muted"
          }`}
        >
          {lang === "th" ? "เพิ่มเมนูใหม่" : "Add item"}
        </button>
        <button
          type="button"
          onClick={() => setTopTab("owner")}
          className={`-mb-px border-b-2 pb-2 text-sm font-bold transition-colors ${
            topTab === "owner" ? "border-brand text-brand" : "border-transparent text-muted"
          }`}
        >
          {lang === "th" ? "กำหนดเจ้าของเมนู" : "Assign owner"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
          {error}
        </div>
      )}

      {topTab === "owner" ? (
        <>
          {stagedItems}
          <div className="space-y-2.5">
            <span className="block text-xs font-semibold text-muted">
              {lang === "th" ? "กำหนดเจ้าของเมนู (เพิ่มทีหลังได้)" : "Assign menu owner (optional)"}
            </span>
            {ownerPicker(assignMode, userId, guestName, setAssignMode, setUserId, setGuestName)}
          </div>
          {normalButtons}
        </>
      ) : (
        <>
          {/* Single item vs pack */}
          <div className="flex rounded-xl border border-border p-0.5 bg-background text-xs w-full font-bold">
            <button
              type="button"
              onClick={() => switchMode("normal")}
              className={`flex-1 py-2 text-center rounded-lg transition-all ${
                mode === "normal" ? "bg-white shadow-xs text-brand" : "text-muted font-medium"
              }`}
            >
              {lang === "th" ? "รายการเดี่ยว" : "Single item"}
            </button>
            <button
              type="button"
              onClick={() => switchMode("pack")}
              className={`flex-1 py-2 text-center rounded-lg transition-all ${
                mode === "pack" ? "bg-white shadow-xs text-brand" : "text-muted font-medium"
              }`}
            >
              {lang === "th" ? "แพ็ค/โปรโมชั่น" : "Promo pack"}
            </button>
          </div>

      {mode === "normal" ? (
        <>
          {stagedItems}
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
                onWheel={(e) => e.currentTarget.blur()}
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
                onWheel={(e) => e.currentTarget.blur()}
                className={`no-spinner ${inputCls} text-center`}
              />
            </div>
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={lang === "th" ? "ส่วนลดต่อรายการ (บาท) — 0 ถ้าไม่มี" : "Item discount (Baht) — 0 if none"}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            className={`no-spinner ${inputCls}`}
          />
          {normalButtons}
        </>
      ) : (
        <>
          {/* Pack header */}
          <div className="space-y-2 rounded-xl border border-brand/40 bg-brand/5 p-2.5">
            <input
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              placeholder={lang === "th" ? "ชื่อแพ็ค เช่น น้ำ 1 แถม 1" : "Pack name, e.g. Water 1+1"}
              className={inputCls}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={packPrice}
              onChange={(e) => setPackPrice(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder={lang === "th" ? "ราคาแพ็ครวม (บาท)" : "Pack total price (Baht)"}
              className={`no-spinner ${inputCls}`}
            />
            {cap > 0 && (
              <div className={`text-xs font-semibold ${overCap ? "text-red-500" : "text-muted"}`}>
                {lang === "th" ? "คงเหลือ" : "Remaining"}: {baht(remaining)} / {baht(cap)}
              </div>
            )}
          </div>

          {/* Sub-item rows */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted">
              {lang === "th" ? "รายการย่อย" : "Sub-items"}
            </span>
            <button
              type="button"
              onClick={addSubRow}
              aria-label={lang === "th" ? "เพิ่มรายการย่อย" : "Add sub-item"}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white text-lg leading-none transition active:scale-90 hover:bg-brand/90"
            >
              +
            </button>
          </div>
          <div className="space-y-2">
            {subRows.map((r, i) => {
              const rowOwner = r.assignMode === "user"
                ? allUsers.find((u) => u.id === r.userId)?.name ?? ""
                : r.guestName.trim();
              return (
                <div key={i} className="rounded-xl border border-border p-2.5">
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => toggleCollapse(i)}
                  >
                    <span className="text-[9px] text-muted shrink-0">{r.collapsed ? "▼" : "▲"}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-muted">
                      {lang === "th" ? `รายการย่อย ${i + 1}` : `Sub-item ${i + 1}`}
                      {r.collapsed && r.itemName.trim() && (
                        <span className="font-semibold text-foreground"> · {r.itemName.trim()}</span>
                      )}
                      {r.collapsed && rowOwner && <span className="text-muted"> · {rowOwner}</span>}
                    </span>
                    {r.collapsed && r.price && (
                      <span className="shrink-0 text-xs font-bold text-foreground">{baht(parseFloat(r.price) || 0)}</span>
                    )}
                    {subRows.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSubRow(i);
                        }}
                        aria-label="remove"
                        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white transition active:scale-90 hover:bg-red-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {!r.collapsed && (
                    <div className="mt-2 space-y-2">
                      <input
                        value={r.itemName}
                        onChange={(e) => updateSub(i, { itemName: e.target.value })}
                        placeholder={lang === "th" ? "รายการย่อย เช่น ขวดที่ 1" : "Sub-item, e.g. Bottle 1"}
                        className={inputCls}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={r.price}
                        onChange={(e) => updateSub(i, { price: e.target.value })}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder={lang === "th" ? "ราคา (บาท)" : "Price (Baht)"}
                        className={`no-spinner ${inputCls}`}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={r.discount}
                        onChange={(e) => updateSub(i, { discount: e.target.value })}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder={lang === "th" ? "ส่วนลด (บาท) — 0 ถ้าไม่มี" : "Discount (Baht) — 0 if none"}
                        className={`no-spinner ${inputCls}`}
                      />
                      {ownerPicker(
                        r.assignMode,
                        r.userId,
                        r.guestName,
                        (m) => updateSub(i, { assignMode: m }),
                        (v) => updateSub(i, { userId: v }),
                        (v) => updateSub(i, { guestName: v })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Create the main pack item */}
          <button
            type="button"
            onClick={savePack}
            disabled={pending || !canSavePack}
            className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white transition active:scale-[.98] hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending
              ? lang === "th" ? "กำลังบันทึก…" : "Saving…"
              : `${lang === "th" ? "สร้างรายการหลัก" : "Create pack"}${validSubs.length > 0 ? ` (${validSubs.length})` : ""}`}
          </button>
        </>
      )}
        </>
      )}
    </div>
  );
}
